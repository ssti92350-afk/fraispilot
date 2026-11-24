/* FraisPilot — serveur relais (Cloudflare Worker)
   Rôle : garder la clé Mistral secrète, compter les scans par appareil selon le plan,
   envoyer le code de récupération par mail (Brevo), gérer les abonnements web (Stripe).

   Liaisons à créer dans Cloudflare (wrangler.toml fourni) :
     KV        : FP            (quotas, plans, codes de récupération)
     Secrets   : MISTRAL_API_KEY, BREVO_API_KEY, STRIPE_WEBHOOK_SECRET
     Variables : ALLOWED_ORIGIN (ex. https://ssti92350-afk.github.io), MAIL_FROM, APP_NAME,
                 STRIPE_LINK_SOLO_MONTHLY, STRIPE_LINK_SOLO_YEARLY, STRIPE_LINK_PRO_MONTHLY, …
*/
const PLANS = { free: 10, solo: 200, pro: 500, business: 1000 };
const CATS = ['Repas', 'Hôtel', 'Carburant', 'Péage', 'Parking', 'Train', 'Avion', 'Taxi / VTC', 'Transports en commun', 'Location véhicule', 'Fournitures', 'Pièces détachées', 'Téléphone / Internet', 'Autre'];
const SCHEMA = { type: 'object', properties: {
  merchant: { type: 'string', description: 'Nom du commerçant ou du fournisseur' },
  date: { type: 'string', description: "Date d'achat au format AAAA-MM-JJ" },
  total_ttc: { type: 'number', description: 'Montant total payé TTC en euros' },
  tva: { type: 'number', description: 'Montant total de TVA (0 si absent)' },
  category: { type: 'string', enum: CATS },
  payment: { type: 'string' },
  quantity: { type: 'number', description: 'Nombre de nuits, repas ou couverts si indiqué, sinon 1' },
  invoice_number: { type: 'string' }
}, required: ['merchant', 'date', 'total_ttc'] };

const month = () => new Date().toISOString().slice(0, 7);
const MAX_FILE = 12 * 1024 * 1024; // 12 Mo en base64

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '*').split(',').map(s => s.trim());
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0]),
      'Access-Control-Allow-Headers': 'Content-Type, X-Device-Id, X-License, X-Org-Code, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Vary': 'Origin'
    };
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...cors } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '');

    try {
      if (path === '/health') return json({ ok: true, mistral: !!env.MISTRAL_API_KEY, mail: !!env.BREVO_API_KEY });

      /* ---- Lecture d'un justificatif ---- */
      if (path === '/ocr' && req.method === 'POST') {
        const device = (req.headers.get('X-Device-Id') || '').slice(0, 64);
        if (!device) return json({ error: 'Appareil inconnu' }, 400);
        const body = await req.json();
        const file = String(body.file || '');
        if (!/^data:(image\/(jpeg|png|webp|heic|heif)|application\/pdf);base64,/.test(file)) return json({ error: 'Format non pris en charge (photo ou PDF)' }, 415);
        if (file.length > MAX_FILE) return json({ error: 'Fichier trop lourd' }, 413);

        // Plan réel lu côté serveur (jamais celui annoncé par l'appli)
        const sub = JSON.parse(await env.FP.get('plan:' + device) || 'null');
        const owner = (env.OWNER_DEVICES || '').split(',').map(s => s.trim()).filter(Boolean).includes(device);
        const plan = owner ? 'owner' : sub && sub.until > Date.now() ? sub.plan : 'free';
        const limit = owner ? Infinity : (PLANS[plan] || 10), qk = `q:${device}:${month()}`;
        const used = +(await env.FP.get(qk) || 0);
        if (used >= limit) return json({ error: `Quota de ${limit} scans atteint ce mois-ci`, quota: { used, limit } }, 402);

        const fields = await mistral(env, file);
        await env.FP.put(qk, String(used + 1), { expirationTtl: 60 * 60 * 24 * 40 });
        return json({ fields, quota: { used: used + 1, limit, plan } });
      }

      /* ---- Organisation (plan Business) : configuration diffusée à la flotte ---- */
      const om = path.match(/^\/org\/([a-z0-9-]{3,40})$/);
      if (om) {
        const rec = JSON.parse(await env.FP.get('org:' + om[1]) || 'null');
        if (req.method === 'GET') return rec?.cfg ? new Response(rec.cfg, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors, 'Access-Control-Allow-Origin': '*' } }) : json({ error: 'Organisation inconnue ou configuration pas encore publiée' }, 404);
        if (req.method === 'PUT') {
          const raw = await req.text();
          if (raw.length > 1024 * 1024) return json({ error: 'Configuration trop lourde (1 Mo au plus)' }, 413);
          const cfg = JSON.parse(raw);
          if (cfg.format !== 'fraispilot-org' || cfg.id !== om[1] || !cfg.adminLock?.salt || !cfg.adminLock?.hash) return json({ error: 'Configuration invalide' }, 400);
          // Le code administrateur de l'organisation est vérifié contre le code déjà enregistré (ou, à la création, celui de la configuration).
          const lock = rec?.adminLock || cfg.adminLock;
          if (!await codeOk(req.headers.get('X-Org-Code') || '', lock)) return json({ error: 'Code administrateur de l’organisation refusé' }, 403);
          await env.FP.put('org:' + om[1], JSON.stringify({ cfg: raw, adminLock: cfg.adminLock, name: String(cfg.name || '').slice(0, 60), updated: Date.now(), created: rec?.created || Date.now() }));
          return json({ ok: true, version: cfg.version });
        }
      }

      /* ---- Récupération d'accès par mail ---- */
      if (path === '/recover/send' && req.method === 'POST') {
        const { email, deviceId } = await req.json();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '') || !deviceId) return json({ error: 'Adresse invalide' }, 400);
        const rk = `rl:${deviceId}`, n = +(await env.FP.get(rk) || 0);
        if (n >= 5) return json({ error: 'Trop de demandes, réessayez dans une heure' }, 429);
        await env.FP.put(rk, String(n + 1), { expirationTtl: 3600 });
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
        await env.FP.put(`rec:${deviceId}:${email.toLowerCase()}`, JSON.stringify({ code, tries: 0 }), { expirationTtl: 900 });
        const app = env.APP_NAME || 'FraisPilot';
        const r = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: { name: app, email: env.MAIL_FROM }, to: [{ email }], subject: `${app} — votre code de récupération`,
            htmlContent: `<p>Votre code de récupération ${app} : <b style="font-size:22px">${code}</b></p><p>Il est valable 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>` })
        });
        if (!r.ok) return json({ error: 'Envoi du mail impossible' }, 502);
        return json({ ok: true });
      }
      if (path === '/recover/verify' && req.method === 'POST') {
        const { email, code, deviceId } = await req.json();
        const k = `rec:${deviceId}:${String(email || '').toLowerCase()}`, rec = JSON.parse(await env.FP.get(k) || 'null');
        if (!rec) return json({ error: 'Code expiré, redemandez-en un' }, 400);
        if (rec.code !== String(code || '').trim()) {
          rec.tries++; if (rec.tries >= 5) await env.FP.delete(k); else await env.FP.put(k, JSON.stringify(rec), { expirationTtl: 900 });
          return json({ error: 'Code incorrect' }, 400);
        }
        await env.FP.delete(k);
        return json({ ok: true });
      }

      /* ---- Abonnement web : lien de paiement Stripe ---- */
      if (path === '/billing/checkout' && req.method === 'POST') {
        const { plan, period, deviceId, email } = await req.json();
        const link = env[`STRIPE_LINK_${String(plan).toUpperCase()}_${String(period).toUpperCase()}`];
        if (!link) return json({ error: 'Paiement web non configuré' }, 501);
        const u = new URL(link); u.searchParams.set('client_reference_id', deviceId); if (email) u.searchParams.set('prefilled_email', email);
        return json({ url: u.toString() });
      }
      /* Webhook Stripe : active le plan de l'appareil après paiement */
      if (path === '/billing/stripe-webhook' && req.method === 'POST') {
        const raw = await req.text();
        if (!await stripeSigOk(raw, req.headers.get('Stripe-Signature') || '', env.STRIPE_WEBHOOK_SECRET)) return json({ error: 'Signature invalide' }, 400);
        const ev = JSON.parse(raw), o = ev.data?.object || {};
        if (ev.type === 'checkout.session.completed' && o.client_reference_id) {
          const plan = (o.metadata?.plan || 'solo').toLowerCase(), yearly = (o.metadata?.period || '') === 'yearly';
          await env.FP.put('plan:' + o.client_reference_id, JSON.stringify({ plan, until: Date.now() + (yearly ? 372 : 33) * 86400000, customer: o.customer, sub: o.subscription }));
        }
        return json({ received: true });
      }
      /* Achat Google Play (appli Play Store) : à brancher sur l'API Google Play Developer */
      if (path === '/billing/google' && req.method === 'POST') {
        return json({ error: 'Vérification Google Play à configurer (compte de service Play Console)' }, 501);
      }
      return json({ error: 'Introuvable' }, 404);
    } catch (e) {
      return json({ error: e.message || 'Erreur serveur' }, 500);
    }
  }
};

async function mistral(env, dataUrl) {
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.MISTRAL_API_KEY };
  const pdf = dataUrl.startsWith('data:application/pdf');
  const r = await fetch('https://api.mistral.ai/v1/ocr', { method: 'POST', headers: H, body: JSON.stringify({
    model: 'mistral-ocr-latest',
    document: pdf ? { type: 'document_url', document_url: dataUrl } : { type: 'image_url', image_url: dataUrl },
    document_annotation_format: { type: 'json_schema', json_schema: { name: 'justificatif', schema: SCHEMA, strict: false } }
  }) });
  const j = await r.json();
  if (!r.ok) throw new Error('Mistral : ' + (j.message || r.status));
  let a = j.document_annotation;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = null; } }
  if (a && (a.total_ttc || a.merchant)) return a;
  const md = (j.pages || []).map(p => p.markdown).join('\n').slice(0, 12000);
  const c = await fetch('https://api.mistral.ai/v1/chat/completions', { method: 'POST', headers: H, body: JSON.stringify({
    model: 'mistral-small-latest', temperature: 0, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: "Tu extrais les données d'un ticket de caisse ou d'une facture française. Réponds uniquement en JSON : merchant, date (AAAA-MM-JJ), total_ttc, tva, category (une de : " + CATS.join(', ') + '), payment, quantity, invoice_number.' }, { role: 'user', content: md }]
  }) });
  const cj = await c.json();
  if (!c.ok) throw new Error('Mistral : ' + (cj.message || c.status));
  return JSON.parse(cj.choices[0].message.content);
}

async function codeOk(code, lock) {
  if (!code || !lock) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(atob(lock.salt), c => c.charCodeAt(0));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: Math.min(+lock.it || 100000, 100000), hash: 'SHA-256' }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits))) === lock.hash;
}

async function sha256(t) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function stripeSigOk(payload, header, secret) {
  if (!secret) return false;
  const parts = Object.fromEntries(header.split(',').map(x => x.split('=')));
  if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - +parts.t) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(parts.t + '.' + payload));
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === parts.v1;
}
