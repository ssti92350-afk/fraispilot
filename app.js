/* FraisPilot — notes de frais (PWA)
   Données stockées sur l'appareil (IndexedDB). Lecture auto des tickets : Mistral OCR,
   via le serveur relais (recommandé : clé cachée + quotas) ou une clé API directe (test). */
{
'use strict';

/* ---------- Outils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const eur = n => r2(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const today = () => iso(new Date());
const fmtDate = d => { if (!d) return ''; const [y, m, j] = d.split('-'); return `${j}/${m}/${y}`; };
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const num = v => { if (typeof v === 'number') return v; const n = parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; };
const IN_FRAME = (() => { try { return window.self !== window.top; } catch { return true; } })();
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthLabel = k => { const [y, m] = k.split('-'); return `${MONTHS[+m - 1]} ${y}`; };

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  list: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  long: '<path d="M7 2h10v20l-2.5-1.5L12 22l-2.5-1.5L7 22z"/><path d="M10 6h4M10 9h4M10 12h4M10 15h4"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-8M21 20H3"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  sync: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12A8 8 0 0 1 18 6.7"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  car: '<path d="M5 17h14v-5l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>',
  plane: '<path d="M3 12l18-8-6 17-3-7z"/>',
  tag: '<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 13h2M3 9h15V6"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3l8.5-8.5"/><path d="M14.5 6.5 17 4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  file: '<path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5"/>',
  spark: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
  crown: '<path d="M3 19h18M4 8l4 4 4-7 4 7 4-4-2 10H6z"/>',
  back: '<path d="M9 6h11v12H9l-6-6z"/><path d="m12 10 4 4M16 10l-4 4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>'
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.tag}</svg>`;
const TAB_ICONS = ['briefcase', 'home', 'car', 'plane', 'wrench', 'wallet', 'user', 'heart', 'tag'];

const CATS = ['Repas', 'Hôtel', 'Carburant', 'Péage', 'Parking', 'Train', 'Avion', 'Taxi / VTC', 'Transports en commun', 'Location véhicule', 'Fournitures', 'Pièces détachées', 'Téléphone / Internet', 'Autre'];
const CAT_WORDS = {
  'Repas': ['repas', 'restaurant', 'resto', 'dejeuner', 'diner', 'sandwich', 'boulangerie', 'brasserie', 'pizzeria', 'traiteur', 'mcdo', 'burger', 'cafe'],
  'Hôtel': ['hotel', 'nuit', 'nuitee', 'hebergement', 'ibis', 'airbnb', 'campanile', 'b&b', 'kyriad'],
  'Carburant': ['carburant', 'essence', 'gasoil', 'gazole', 'diesel', 'plein', 'station', 'totalenergies', 'esso', 'sp95', 'sp98', 'shell', 'avia'],
  'Péage': ['peage', 'autoroute', 'vinci', 'sanef', 'aprr', 'cofiroute', 'bip'],
  'Parking': ['parking', 'stationnement', 'indigo', 'horodateur', 'effia'],
  'Train': ['train', 'sncf', 'tgv', 'ouigo', 'ter', 'intercites'],
  'Avion': ['avion', 'vol ', 'air france', 'easyjet', 'transavia', 'ryanair'],
  'Taxi / VTC': ['taxi', 'uber', 'vtc', 'bolt', 'g7', 'heetch'],
  'Transports en commun': ['metro', 'bus', 'ratp', 'tram', 'navigo', 'rer'],
  'Location véhicule': ['location', 'hertz', 'europcar', 'sixt', 'avis', 'ada'],
  'Fournitures': ['fourniture', 'bureau', 'papeterie', 'castorama', 'leroy', 'brico', 'manutan'],
  'Pièces détachées': ['piece', 'pieces', 'resistance', 'joint', 'fusible', 'rs components', 'farnell'],
  'Téléphone / Internet': ['telephone', 'internet', 'forfait', 'orange', 'sfr', 'bouygues', 'free mobile']
};
const guessCat = t => { const s = ' ' + norm(t) + ' '; for (const [c, w] of Object.entries(CAT_WORDS)) if (w.some(x => s.includes(x))) return c; return ''; };
const PAY = ['Carte pro', 'Carte perso', 'Espèces', 'Virement', 'Avance société', 'Autre'];
const PER = { unite: 'par dépense (× quantité)', jour: 'par jour', mois: 'par mois', an: 'par an' };

const PLANS = [
  { id: 'free', name: 'Gratuit', scans: 10, m: 0, y: 0, ads: true, perks: ['10 scans / mois avec remplissage auto', 'Onglets illimités, verrous, export', 'Publicités'] },
  { id: 'solo', name: 'Solo', scans: 200, m: 3.99, y: 39.99, perks: ['200 scans / mois', 'Sans publicité', 'Sauvegarde et export complets'] },
  { id: 'pro', name: 'Pro', scans: 500, m: 6.99, y: 69.99, perks: ['500 scans / mois', 'Sans publicité', 'Export comptable, factures PDF'] },
  { id: 'business', name: 'Business', scans: 1000, m: 11.99, y: 119.99, gmao: true, perks: ['1 000 scans / mois', 'Option GMAO incluse', 'Support prioritaire'] }
];
const GMAO_OPT = { m: 2.49, y: 24.99 };
const MISTRAL = { ocr: 'mistral-ocr-latest', chat: 'mistral-small-latest', base: 'https://api.mistral.ai/v1' };

/* ---------- Stockage (IndexedDB, avec repli en mémoire) ---------- */
const Mem = {};
const DB = {
  db: null, ok: false,
  async open() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('fraispilot', 1);
        r.onupgradeneeded = () => { const d = r.result; ['kv', 'exp', 'img'].forEach(n => d.objectStoreNames.contains(n) || d.createObjectStore(n)); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      this.ok = true;
    } catch { this.ok = false; }
  },
  req(st, mode, f) {
    if (!this.ok) { Mem[st] = Mem[st] || new Map(); return Promise.resolve(f(null, Mem[st])); }
    return new Promise((res, rej) => {
      const t = this.db.transaction(st, mode), r = f(t.objectStore(st));
      t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
      t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  get(st, k) { return this.req(st, 'readonly', (s, m) => s ? s.get(k) : m.get(k)); },
  set(st, k, v) { return this.req(st, 'readwrite', (s, m) => s ? s.put(v, k) : m.set(k, v)); },
  del(st, k) { return this.req(st, 'readwrite', (s, m) => s ? s.delete(k) : m.delete(k)); },
  all(st) { return this.req(st, 'readonly', (s, m) => s ? s.getAll() : [...m.values()]); },
  clear(st) { return this.req(st, 'readwrite', (s, m) => s ? s.clear() : m.clear()); }
};

/* ---------- État ---------- */
const DEF = () => ({
  settings: { appName: 'FraisPilot', accent: '#b8f5d0', theme: 'auto', plan: 'free', billing: 'mensuel', gmaoOpt: false, planDemo: false,
    proxyUrl: '', apiKey: '', gmaoUrl: '', gmaoToken: '', gmaoImgs: true, adClient: '', adSlot: '', autoLockMin: 5, deviceId: uid(), license: '', stripe: {} },
  account: null,
  tabs: [
    { id: 'pro', name: 'Dépenses pro', icon: 'briefcase', color: '#1f6feb', remb: true, gmao: true, lock: null, fixed: true },
    { id: 'perso', name: 'Dépenses perso', icon: 'home', color: '#e8590c', remb: false, gmao: false, lock: null, fixed: true }
  ],
  rules: [
    { id: uid(), cat: 'Repas', per: 'unite', limit: 20, tabs: ['pro'] },
    { id: uid(), cat: 'Hôtel', per: 'unite', limit: 85, tabs: ['pro'] }
  ],
  obj: { jour: 0, mois: 0, an: 0, tabs: ['pro', 'perso'] },
  quota: { month: today().slice(0, 7), used: 0 },
  inter: []
});
const KEYS = ['settings', 'account', 'tabs', 'rules', 'obj', 'quota', 'inter'];
const S = { exps: [], ses: { unlocked: false, tabs: new Set(), view: 'home', tab: 'pro', q: '', month: '', hiddenAt: 0,
  recap: { period: 'mois', from: '', to: '', tabs: null, inter: '' } } };
const save = k => DB.set('kv', k, S[k]).catch(() => {});
const saveExp = e => DB.set('exp', e.id, e).catch(() => {});
const tabById = id => S.tabs.find(t => t.id === id);
const tabOpen = id => { const t = tabById(id); return !!t && (!t.lock || S.ses.tabs.has(id)); };
const openTabs = () => S.tabs.filter(t => tabOpen(t.id));
const plan = () => PLANS.find(p => p.id === S.settings.plan) || PLANS[0];
const hasGmao = () => plan().gmao || S.settings.gmaoOpt;
const quotaNow = () => { const m = today().slice(0, 7); if (!S.quota || S.quota.month !== m) S.quota = { month: m, used: 0 }; return S.quota; };

/* ---------- Interface : messages, fenêtres ---------- */
let toastT;
function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
function modal(html, { wide = false, onClose } = {}) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.append(m); requestAnimationFrame(() => m.classList.add('in'));
  let done = false;
  const close = () => { if (done) return; done = true; m.classList.remove('in'); setTimeout(() => m.remove(), 220); onClose && onClose(); };
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  const kh = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', kh); } };
  document.addEventListener('keydown', kh);
  return { el: m, close };
}
function confirmBox(title, text, ok = 'Confirmer', danger = false) {
  return new Promise(res => {
    let v = false;
    const m = modal(`<div class="hd"><h2>${esc(title)}</h2></div><p>${text}</p>
      <div class="row end"><button class="btn" data-close>Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cOk">${esc(ok)}</button></div>`, { onClose: () => res(v) });
    $('#cOk', m.el).onclick = () => { v = true; m.close(); };
  });
}
function infoBox(title, html) { modal(`<div class="hd"><h2>${esc(title)}</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div>${html}`); }

/* ---------- Sécurité : hachage des codes ---------- */
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function hashSecret(secret, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
  return { salt: b64(salt), hash: b64(bits) };
}
const makeLock = async (method, secret) => ({ method, ...(await hashSecret(secret)) });
const checkLock = async (secret, lock) => !lock || (await hashSecret(secret, lock.salt)).hash === lock.hash;
function recoveryCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(12));
  const s = [...r].map(x => A[x % A.length]).join(''); return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function pinPad(box, onDone) {
  let v = '';
  box.innerHTML = `<div class="dots">${'<i></i>'.repeat(4)}</div><div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map(k => k === '' ? '<span></span>' : `<button type="button" class="key" data-k="${k}" aria-label="${k === 'del' ? 'Effacer' : k}">${k === 'del' ? ic('back') : k}</button>`).join('')}</div>`;
  const dots = $$('.dots i', box), dw = $('.dots', box);
  const upd = () => dots.forEach((d, i) => d.classList.toggle('on', i < v.length));
  let busy = false;
  const press = k => {
    if (busy) return;
    if (k === 'del') v = v.slice(0, -1); else if (v.length < 4) v += k;
    upd();
    if (v.length === 4) {
      busy = true; const val = v;
      setTimeout(async () => { const ok = await onDone(val); busy = false; if (!ok) { dw.classList.add('shake'); setTimeout(() => dw.classList.remove('shake'), 400); v = ''; upd(); } }, 120);
    }
  };
  box.addEventListener('click', e => { const b = e.target.closest('.key'); if (b) press(b.dataset.k); });
  const kh = e => { if (!box.isConnected) { document.removeEventListener('keydown', kh); return; } if (e.target.matches('input,textarea')) return; if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); };
  document.addEventListener('keydown', kh);
}
/* Demande le code d'un verrou (onglet ou compte). Résout true si correct. */
function askUnlock(lock, title) {
  return new Promise(res => {
    let ok = false;
    const m = modal(`<div class="hd"><h2>${esc(title)}</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div>
      ${lock.method === 'pin' ? '<p class="mute" style="text-align:center">Code à 4 chiffres</p><div id="uPad"></div>' :
        '<form id="uF" class="stack" style="display:grid;gap:12px"><input type="password" id="uPw" placeholder="Mot de passe" autocomplete="current-password"><button class="btn primary big">Déverrouiller</button></form>'}`, { onClose: () => res(ok) });
    if (lock.method === 'pin') pinPad($('#uPad', m.el), async v => { if (await checkLock(v, lock)) { ok = true; m.close(); return true; } return false; });
    else {
      setTimeout(() => $('#uPw', m.el)?.focus(), 250);
      $('#uF', m.el).onsubmit = async e => { e.preventDefault(); if (await checkLock($('#uPw', m.el).value, lock)) { ok = true; m.close(); } else { toast('Mot de passe incorrect'); $('#uPw', m.el).value = ''; } };
    }
  });
}
/* Choisir et saisir un nouveau secret (PIN ou mot de passe). Résout {method, secret} ou null. */
function secretFields(method) {
  return method === 'pin'
    ? `<label class="f">Code à 4 chiffres<input type="password" inputmode="numeric" pattern="\\d{4}" maxlength="4" name="s1" required autocomplete="new-password"></label>
       <label class="f">Confirmer le code<input type="password" inputmode="numeric" pattern="\\d{4}" maxlength="4" name="s2" required autocomplete="new-password"></label>`
    : `<label class="f">Mot de passe (6 caractères min.)<input type="password" name="s1" minlength="6" required autocomplete="new-password"></label>
       <label class="f">Confirmer le mot de passe<input type="password" name="s2" minlength="6" required autocomplete="new-password"></label>`;
}
function bindSecretForm(form) {
  const box = $('.sf', form);
  const draw = () => { box.innerHTML = secretFields(form.elements.method.value); };
  form.addEventListener('change', e => { if (e.target.name === 'method') draw(); });
  draw();
}
function readSecretForm(form) {
  const method = form.elements.method.value, s1 = form.elements.s1.value, s2 = form.elements.s2.value;
  if (method === 'pin' && !/^\d{4}$/.test(s1)) { toast('Le code doit faire 4 chiffres'); return null; }
  if (method === 'password' && s1.length < 6) { toast('6 caractères minimum'); return null; }
  if (s1 !== s2) { toast('Les deux saisies ne correspondent pas'); return null; }
  return { method, secret: s1 };
}
const methodSeg = (cur = 'pin') => `<div class="seg"><label><input type="radio" name="method" value="pin" ${cur === 'pin' ? 'checked' : ''}>Code 4 chiffres</label><label><input type="radio" name="method" value="password" ${cur === 'password' ? 'checked' : ''}>Mot de passe</label></div><div class="sf" style="display:grid;gap:14px"></div>`;

/* ---------- Écran de connexion ---------- */
const L = () => $('#lock');
function showLock() {
  S.ses.unlocked = false; S.ses.tabs.clear();
  $$('.modal').forEach(m => m.remove());
  $('#app').hidden = true; L().hidden = false;
  if (!S.account) renderSetup(); else renderLogin();
}
const markHtml = () => `<div class="mark">${ic('receipt')}</div>`;
function renderSetup() {
  L().innerHTML = `<div class="lockbox">${markHtml()}
    <h1>Bienvenue sur ${esc(S.settings.appName)}</h1>
    <p class="mute">Créez votre accès. Votre adresse mail sert à récupérer l'accès si vous oubliez votre code.</p>
    <form id="setupF">
      <label class="f">Adresse mail<input type="email" name="email" required autocomplete="email" placeholder="prenom@entreprise.fr"></label>
      ${methodSeg('pin')}
      <button class="btn primary big">Créer mon accès</button>
    </form></div>`;
  const f = $('#setupF'); bindSecretForm(f);
  f.onsubmit = async e => {
    e.preventDefault(); const s = readSecretForm(f); if (!s) return;
    const code = recoveryCode();
    S.account = { email: f.email.value.trim(), lock: await makeLock(s.method, s.secret), rec: await makeLock('code', cleanCode(code)), created: Date.now() };
    await save('account'); renderRecovery(code);
  };
}
function renderRecovery(code) {
  const mail = `mailto:${encodeURIComponent(S.account.email)}?subject=${encodeURIComponent(S.settings.appName + ' — code de secours')}&body=${encodeURIComponent(`Mon code de secours ${S.settings.appName} : ${code}\n\nÀ saisir dans « Accès oublié » pour redéfinir mon code ou mot de passe.`)}`;
  L().innerHTML = `<div class="lockbox">${markHtml()}
    <h1>Votre code de secours</h1>
    <p class="mute">Gardez-le précieusement : il permet de récupérer l'accès, même sans connexion.</p>
    <div class="code" id="recC">${esc(code)}</div>
    <div class="grid2"><a class="btn" href="${mail}">${ic('upload', 's')}S'envoyer par mail</a><button class="btn" data-act="copyRec">Copier</button></div>
    <p class="mute" style="font-size:13px">Adresse : ${esc(S.account.email)}</p>
    <label class="chk" style="justify-content:center"><input type="checkbox" id="recOk"> J'ai mis ce code de côté</label>
    <button class="btn primary big" id="recGo" disabled>Entrer dans l'application</button></div>`;
  $('#recOk').onchange = e => { $('#recGo').disabled = !e.target.checked; };
  $('#recGo').onclick = () => enterApp();
}
function renderLogin() {
  const a = S.account;
  L().innerHTML = `<div class="lockbox">${markHtml()}
    <h1>${esc(S.settings.appName)}</h1>
    ${a.lock.method === 'pin' ? '<p class="mute">Saisissez votre code</p><div id="lPad"></div>' :
      `<form id="lF" class="stack"><label class="f">Mot de passe<input type="password" id="lPw" autocomplete="current-password" required></label><button class="btn primary big">Se connecter</button></form>`}
    <button class="linkbtn" data-act="forgot">Code ou mot de passe oublié ?</button></div>`;
  if (a.lock.method === 'pin') pinPad($('#lPad'), async v => { if (await checkLock(v, a.lock)) { enterApp(); return true; } return false; });
  else {
    setTimeout(() => $('#lPw')?.focus(), 100);
    $('#lF').onsubmit = async e => { e.preventDefault(); if (await checkLock($('#lPw').value, a.lock)) enterApp(); else { toast('Mot de passe incorrect'); $('#lPw').value = ''; } };
  }
}
function renderForgot() {
  const em = S.account.email.replace(/^(.{2}).*(@.*)$/, '$1•••$2');
  L().innerHTML = `<div class="lockbox">${markHtml()}<h1>Récupérer l'accès</h1>
    <div class="card stack" style="text-align:left"><h3>Par mail</h3><p class="mute">Un code à 6 chiffres est envoyé à ${esc(em)}.</p>
      <button class="btn" data-act="recSend">${ic('upload', 's')}Recevoir un code par mail</button>
      <form id="mailF" class="stack" hidden><label class="f">Code reçu<input name="c" inputmode="numeric" maxlength="6" required></label><button class="btn primary">Valider</button></form></div>
    <div class="card stack" style="text-align:left"><h3>Avec le code de secours</h3>
      <form id="recF" class="stack"><label class="f">Code de secours<input name="c" placeholder="XXXX-XXXX-XXXX" autocapitalize="characters" required></label><button class="btn primary">Valider</button></form></div>
    <button class="linkbtn" data-act="backLogin">Retour</button></div>`;
  $('#recF').onsubmit = async e => {
    e.preventDefault();
    if (await checkLock(cleanCode(e.target.c.value), S.account.rec)) renderNewSecret(); else toast('Code de secours incorrect');
  };
  $('#mailF').onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await fetch(proxy() + '/recover/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: S.account.email, code: e.target.c.value.trim(), deviceId: S.settings.deviceId }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) renderNewSecret(); else toast(j.error || 'Code incorrect ou expiré');
    } catch { toast('Serveur injoignable'); }
  };
}
function renderNewSecret() {
  L().innerHTML = `<div class="lockbox">${markHtml()}<h1>Nouveau code d'accès</h1>
    <form id="nsF">${methodSeg(S.account.lock.method)}<button class="btn primary big">Enregistrer</button></form></div>`;
  const f = $('#nsF'); bindSecretForm(f);
  f.onsubmit = async e => {
    e.preventDefault(); const s = readSecretForm(f); if (!s) return;
    const code = recoveryCode();
    S.account.lock = await makeLock(s.method, s.secret); S.account.rec = await makeLock('code', cleanCode(code));
    await save('account'); toast('Accès redéfini. Voici votre nouveau code de secours.'); renderRecovery(code);
  };
}
const proxy = () => (S.settings.proxyUrl || '').trim().replace(/\/+$/, '');

function enterApp() {
  S.ses.unlocked = true; L().hidden = true; L().innerHTML = ''; $('#app').hidden = false;
  if (!tabOpen(S.ses.tab) && S.ses.tab !== 'all') S.ses.tab = openTabs()[0]?.id || 'all';
  renderAll();
  const p = new URLSearchParams(location.search);
  if (p.get('action') === 'scan') { history.replaceState(null, '', location.pathname); setTimeout(() => $('#inCam').click(), 300); }
  if (p.get('action') === 'add') { history.replaceState(null, '', location.pathname); openAdd(); }
}

/* ---------- Thème ---------- */
function lum(hex) { const n = parseInt(hex.slice(1), 16), f = c => (c /= 255) <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; return .2126 * f(n >> 16 & 255) + .7152 * f(n >> 8 & 255) + .0722 * f(n & 255); }
function applyTheme() {
  const st = S.settings, r = document.documentElement;
  if (st.theme === 'auto') r.removeAttribute('data-theme'); else r.dataset.theme = st.theme;
  r.style.setProperty('--accent', st.accent); r.style.setProperty('--on', lum(st.accent) > .3 ? '#0b0c0c' : '#ffffff');
  document.title = st.appName; $('#brand').textContent = st.appName;
  $('meta[name=theme-color]').content = st.accent;
}

/* ---------- Calculs : plafonds et remboursement ---------- */
function periodKey(d, per) { return per === 'jour' ? d : per === 'mois' ? d.slice(0, 7) : per === 'an' ? d.slice(0, 4) : d; }
/* Calcule pour chaque dépense : part remboursable et part hors limite.
   Les plafonds par jour / mois / an se cumulent dans l'ordre chronologique. */
function computeReimb(list = S.exps) {
  const res = new Map(), used = {};
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
  for (const e of sorted) {
    const t = tabById(e.tabId), amt = r2(e.amount);
    if (!t || !t.remb) { res.set(e.id, { remb: 0, excess: 0, na: true }); continue; }
    const rule = S.rules.find(r => r.cat === e.cat && r.limit > 0 && (!r.tabs || !r.tabs.length || r.tabs.includes(e.tabId)));
    if (!rule) { res.set(e.id, { remb: amt, excess: 0 }); continue; }
    let cap;
    if (rule.per === 'unite') cap = rule.limit * Math.max(1, +e.qty || 1);
    else { const k = rule.id + '|' + periodKey(e.date, rule.per); const u = used[k] || 0; cap = Math.max(0, rule.limit - u); used[k] = r2(u + Math.min(amt, cap)); }
    const remb = r2(Math.min(amt, cap));
    res.set(e.id, { remb, excess: r2(amt - remb), rule });
  }
  return res;
}
const PER_S = { unite: '/ dépense', jour: '/ jour', mois: '/ mois', an: '/ an' };
const ruleText = r => r ? `${r.cat} : ${eur(r.limit)} ${PER_S[r.per]}` : '';
const sum = (arr, f = e => e.amount) => r2(arr.reduce((a, e) => a + (Number(f(e)) || 0), 0));
function inRange(d, period, from, to) {
  const t = today();
  if (period === 'jour') return d === t;
  if (period === 'semaine') { const n = new Date(), day = (n.getDay() + 6) % 7, mon = new Date(n); mon.setDate(n.getDate() - day); return d >= iso(mon) && d <= t; }
  if (period === 'mois') return d.slice(0, 7) === t.slice(0, 7);
  if (period === 'moisprec') { const n = new Date(); n.setDate(1); n.setMonth(n.getMonth() - 1); return d.slice(0, 7) === iso(n).slice(0, 7); }
  if (period === 'an') return d.slice(0, 4) === t.slice(0, 4);
  if (period === 'perso') return (!from || d >= from) && (!to || d <= to);
  return true;
}
const PERIODS = { mois: 'Ce mois-ci', moisprec: 'Mois dernier', semaine: 'Cette semaine', jour: "Aujourd'hui", an: 'Cette année', tout: 'Tout', perso: 'Personnalisée' };

/* ---------- Navigation et rendu ---------- */
function nav(v) {
  S.ses.view = v;
  ['home', 'list', 'recap', 'settings'].forEach(k => { $('#v-' + k).hidden = k !== v; });
  $$('.nav [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === v));
  render(); window.scrollTo({ top: 0 });
}
function renderChrome() {
  $('#brandMk').innerHTML = ic('receipt');
  $('#bVoice').innerHTML = ic('mic'); $('#bLock').innerHTML = ic('lock');
  $('#nHome').innerHTML = ic('home') + 'Accueil'; $('#nList').innerHTML = ic('list') + 'Dépenses';
  $('#nFab').innerHTML = ic('plus'); $('#nRecap').innerHTML = ic('chart') + 'Récap'; $('#nSet').innerHTML = ic('settings') + 'Réglages';
  const p = plan();
  $('#planPill').className = 'pill' + (p.id === 'free' ? '' : ' acc');
  $('#planPill').innerHTML = p.id === 'free' ? `${quotaNow().used}/${p.scans} scans` : ic('crown', 's') + esc(p.name);
  renderAd();
}
function renderAll() { applyTheme(); renderChrome(); nav(S.ses.view); }
function render() {
  renderChrome();
  const v = S.ses.view;
  if (v === 'home') renderHome(); else if (v === 'list') renderList(); else if (v === 'recap') renderRecap(); else renderSettings();
}

/* --- Accueil --- */
const receiptArt = () => `<svg class="rcpt" viewBox="0 0 120 160" aria-hidden="true">
  <path d="M18 8h84v136l-10.5-7-10.5 7-10.5-7L60 144l-10.5-7-10.5 7-10.5-7L18 144z" fill="var(--bg)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
  <path d="M34 34h52M34 50h36M34 66h44M34 82h28" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".85"/>
  <path d="M34 108h52" stroke="currentColor" stroke-width="3" stroke-dasharray="4 5"/><path d="M58 124h28" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>`;
function objLine(val, target, lbl) {
  if (!target) return `<div class="o">Pas d'objectif ${lbl}</div>`;
  const p = Math.round(val / target * 100);
  return `<div class="bar ${p > 100 ? 'over' : ''}"><i style="width:${Math.min(100, p)}%"></i></div><div class="o">${p} % de l'objectif ${lbl} (${eur(target)})</div>`;
}
function renderHome() {
  const sel = S.obj.tabs.filter(id => tabOpen(id));
  const ex = S.exps.filter(e => sel.includes(e.tabId)), t = today();
  const mo = ex.filter(e => e.date.slice(0, 7) === t.slice(0, 7)), dy = ex.filter(e => e.date === t), yr = ex.filter(e => e.date.slice(0, 4) === t.slice(0, 4));
  const vm = sum(mo), vd = sum(dy), vy = sum(yr), vt = sum(ex);
  const n = new Date(), dim = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate(), proj = vm / n.getDate() * dim;
  const RB = computeReimb(), rm = sum(mo, e => RB.get(e.id)?.remb), xm = sum(mo, e => RB.get(e.id)?.excess);
  const byCat = {}; mo.forEach(e => { byCat[e.cat || 'Autre'] = (byCat[e.cat || 'Autre'] || 0) + (+e.amount || 0); });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]), max = cats[0]?.[1] || 1;
  const pct = S.obj.mois ? Math.round(vm / S.obj.mois * 100) : null;
  const q = quotaNow(), p = plan();
  const recent = [...ex].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
  $('#v-home').innerHTML = `
    <div class="chips" role="group" aria-label="Onglets comptés">${S.tabs.map(tb => {
      const open = tabOpen(tb.id), on = open && S.obj.tabs.includes(tb.id);
      return `<button class="chip ${on ? 'on' : ''}" data-act="homeTab" data-id="${esc(tb.id)}">${open ? `<span class="dot" style="background:${esc(tb.color)}"></span>` : ic('lock', 's')}${esc(tb.name)}</button>`; }).join('')}</div>
    <div class="hero">
      <div class="lbl">Dépensé en ${MONTHS[n.getMonth()]}</div>
      <div class="big">${eur(vm)}</div>
      <div class="sub">${pct !== null ? `${pct} % de l'objectif de ${eur(S.obj.mois)} · ` : ''}à ce rythme : ${eur(proj)} fin de mois</div>
      ${receiptArt()}
      ${S.obj.mois ? `<div class="bar ${pct > 100 ? 'over' : ''}"><i style="width:${Math.min(100, pct)}%"></i></div>` : ''}
    </div>
    <div class="stats">
      <div class="card stat"><div class="k">Aujourd'hui</div><div class="v">${eur(vd)}</div>${objLine(vd, S.obj.jour, 'du jour')}</div>
      <div class="card stat"><div class="k">Cette année</div><div class="v">${eur(vy)}</div>${objLine(vy, S.obj.an, 'annuel')}</div>
      <div class="card stat"><div class="k">Total des onglets choisis</div><div class="v">${eur(vt)}</div><div class="o">${ex.length} dépense${ex.length > 1 ? 's' : ''}</div></div>
    </div>
    <div class="card"><h3>Remboursement de ${MONTHS[n.getMonth()]}</h3>
      <div class="split"><div><small>Remboursable</small><div class="v" style="color:var(--green)">${eur(rm)}</div></div>
      <div><small>Hors limite (non remboursé)</small><div class="v" style="color:${xm > 0 ? 'var(--red)' : 'inherit'}">${eur(xm)}</div></div></div>
      ${xm > 0 ? `<p class="mute" style="margin-top:8px;font-size:14px">Le dépassement reste visible dans le récapitulatif.</p>` : ''}
      <div class="row" style="margin-top:12px"><button class="btn" data-nav="recap">${ic('chart', 's')}Voir le récapitulatif</button></div></div>
    <div class="card"><h3>Par catégorie, ce mois</h3>${cats.length ? cats.map(([c, v]) => `<div class="catrow"><span>${esc(c)}</span><div class="bar"><i style="width:${v / max * 100}%"></i></div><b>${eur(v)}</b></div>`).join('') : '<p class="mute">Aucune dépense ce mois-ci.</p>'}</div>
    <div class="card"><div class="row"><h3 class="grow" style="margin:0">Dernières dépenses</h3><button class="btn ghost" data-nav="list">Tout voir</button></div>
      <div class="list" style="margin-top:10px">${recent.length ? recent.map(e => itemHtml(e, RB)).join('') : emptyHtml()}</div></div>
    <div class="card"><div class="row"><div class="grow"><h3 style="margin:0">Scans automatiques</h3><small>${q.used} utilisé${q.used > 1 ? 's' : ''} sur ${p.scans} ce mois · plan ${esc(p.name)}</small></div>
      ${p.id !== 'business' ? `<button class="btn accent" data-act="plans">${ic('crown', 's')}Plus de scans</button>` : ''}</div>
      <div class="bar" style="margin-top:12px;color:var(--ink)"><i style="width:${Math.min(100, q.used / p.scans * 100)}%"></i></div></div>
    ${installCard()}`;
  loadThumbs($('#v-home'));
}
function emptyHtml() { return `<div class="empty">${ic('receipt')}<p>Aucune dépense pour l'instant.</p><button class="btn accent" data-act="add">${ic('camera', 's')}Scanner un ticket</button></div>`; }
function itemHtml(e, RB) {
  const t = tabById(e.tabId), r = RB.get(e.id) || {};
  const tags = [];
  if (r.excess > 0) tags.push(`<span class="pill red">${eur(r.excess)} hors limite</span>`);
  if (e.check) tags.push('<span class="pill amb">À vérifier</span>');
  if (e.dupSuspect) tags.push('<span class="pill red">Doublon possible</span>');
  if (t?.gmao && e.inter) tags.push(`<span class="pill ${e.sync === 'ok' ? 'grn' : ''}">${e.sync === 'ok' ? ic('check', 's') : ''}${esc(e.inter)}</span>`);
  if (S.ses.tab === 'all' && t) tags.push(`<span class="pill">${esc(t.name)}</span>`);
  return `<button class="item" data-act="edit" data-id="${esc(e.id)}">
    <span class="thumb" ${e.imgs?.length ? `data-thumb="${esc(e.imgs[0])}"` : ''}>${ic(e.pdf ? 'file' : 'receipt')}</span>
    <span><b>${esc(e.merchant || 'Sans nom')}</b><small>${esc(e.cat || 'Autre')} · ${fmtDate(e.date)}${e.client ? ' · ' + esc(e.client) : ''}</small>${tags.length ? `<span class="tags">${tags.join('')}</span>` : ''}</span>
    <span class="amt">${eur(e.amount)}${t?.remb ? `<small>${r.excess > 0 ? 'remb. ' + eur(r.remb) : 'remboursable'}</small>` : ''}</span></button>`;
}
const thumbCache = new Map();
async function loadThumbs(root) {
  for (const el of $$('[data-thumb]', root)) {
    const id = el.dataset.thumb;
    let u = thumbCache.get(id);
    if (!u) { const b = await DB.get('img', id).catch(() => null); if (!b || !String(b.type).startsWith('image/')) continue; u = URL.createObjectURL(b); thumbCache.set(id, u); }
    el.innerHTML = `<img src="${u}" alt="">`;
  }
}

/* --- Liste des dépenses --- */
function renderList() {
  const cur = S.ses.tab, t = tabById(cur);
  const strip = `<div class="tabs" role="tablist">
    <button class="chip ${cur === 'all' ? 'on' : ''}" data-act="tab" data-id="all">${ic('search', 's')}Tout</button>
    ${S.tabs.map(tb => `<button class="chip ${cur === tb.id ? 'on' : ''}" data-act="tab" data-id="${esc(tb.id)}">${ic(tabOpen(tb.id) ? tb.icon : 'lock', 's')}${esc(tb.name)}</button>`).join('')}
    <button class="chip" data-act="newTab" aria-label="Ajouter un onglet">${ic('plus', 's')}Onglet</button></div>`;
  if (t && !tabOpen(cur)) {
    $('#v-list').innerHTML = strip + `<div class="card locked">${ic('lock', 'l')}<h2>${esc(t.name)} est verrouillé</h2><button class="btn primary" data-act="unlockTab" data-id="${esc(cur)}">${ic('unlock', 's')}Déverrouiller</button></div>`;
    return;
  }
  const ids = cur === 'all' ? openTabs().map(x => x.id) : [cur];
  let ex = S.exps.filter(e => ids.includes(e.tabId));
  const months = [...new Set(ex.map(e => e.date.slice(0, 7)))].sort().reverse();
  if (S.ses.month) ex = ex.filter(e => e.date.startsWith(S.ses.month));
  const q = norm(S.ses.q).trim();
  if (q) ex = ex.filter(e => norm([e.merchant, e.cat, e.note, e.inter, e.client, e.pay, String(e.amount).replace('.', ','), fmtDate(e.date)].join(' ')).includes(q));
  ex.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const RB = computeReimb();
  const groups = {}; ex.forEach(e => { (groups[e.date] = groups[e.date] || []).push(e); });
  const tot = sum(ex), rb = sum(ex, e => RB.get(e.id)?.remb), xs = sum(ex, e => RB.get(e.id)?.excess);
  $('#v-list').innerHTML = strip + `
    <div class="tools">
      <div class="search">${ic('search')}<input id="q" type="search" placeholder="Rechercher (commerçant, montant, n° d'intervention…)" value="${esc(S.ses.q)}" aria-label="Rechercher"><button class="btn icon" data-act="voiceSearch" aria-label="Recherche vocale">${ic('mic')}</button></div>
      <select id="mSel" aria-label="Mois" style="width:auto"><option value="">Tous les mois</option>${months.map(m => `<option value="${m}" ${S.ses.month === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
    </div>
    <div class="row" style="font-size:14px"><span class="pill">${ex.length} dépense${ex.length > 1 ? 's' : ''}</span><span class="pill">Total ${eur(tot)}</span>${rb ? `<span class="pill grn">Remb. ${eur(rb)}</span>` : ''}${xs ? `<span class="pill red">Hors limite ${eur(xs)}</span>` : ''}
      ${t && t.id !== 'all' ? `<button class="btn ghost" data-act="editTab" data-id="${esc(t.id)}" style="margin-left:auto">${ic('pen', 's')}Onglet</button>` : ''}</div>
    <div class="list">${ex.length ? Object.entries(groups).map(([d, arr]) => `<div class="day">${new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${eur(sum(arr))}</div>${arr.map(e => itemHtml(e, RB)).join('')}`).join('') : (q ? `<div class="empty">${ic('search')}<p>Aucun résultat pour « ${esc(S.ses.q)} ».</p></div>` : emptyHtml())}</div>`;
  const qi = $('#q'); qi.oninput = () => { S.ses.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { const pos = qi.selectionStart; renderList(); const n = $('#q'); n.focus(); try { n.setSelectionRange(pos, pos); } catch {} }, 250); };
  $('#mSel').onchange = e => { S.ses.month = e.target.value; renderList(); };
  loadThumbs($('#v-list'));
}

/* --- Récapitulatif et export --- */
function recapData() {
  const R = S.ses.recap;
  if (!R.tabs) R.tabs = openTabs().map(t => t.id);
  const tabs = R.tabs.filter(id => tabOpen(id));
  const ex = S.exps.filter(e => tabs.includes(e.tabId) && inRange(e.date, R.period, R.from, R.to) && (!R.inter || e.inter === R.inter))
    .sort((a, b) => a.date.localeCompare(b.date));
  const RB = computeReimb();
  return { R, tabs, ex, RB };
}
function renderRecap() {
  const { R, ex, RB } = recapData();
  const tot = sum(ex), rb = sum(ex, e => RB.get(e.id)?.remb), xs = sum(ex, e => RB.get(e.id)?.excess);
  const byCat = {};
  ex.forEach(e => { const c = e.cat || 'Autre', o = byCat[c] = byCat[c] || { n: 0, t: 0, r: 0, x: 0 }; const r = RB.get(e.id) || {}; o.n++; o.t += +e.amount || 0; o.r += r.remb || 0; o.x += r.excess || 0; });
  const over = ex.filter(e => RB.get(e.id)?.excess > 0);
  const inters = [...new Set(S.exps.filter(e => e.inter).map(e => e.inter))].sort();
  const byInter = {};
  ex.filter(e => tabById(e.tabId)?.gmao).forEach(e => { const k = e.inter || '— sans n° —', o = byInter[k] = byInter[k] || { n: 0, t: 0, r: 0, c: e.client || '', ok: 0 }; o.n++; o.t += +e.amount || 0; o.r += RB.get(e.id)?.remb || 0; if (e.sync === 'ok') o.ok++; });
  $('#v-recap').innerHTML = `
    <h1>Récapitulatif</h1>
    <div class="card filt">
      <label class="f">Période<select id="rP">${Object.entries(PERIODS).map(([k, v]) => `<option value="${k}" ${R.period === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      ${R.period === 'perso' ? `<label class="f">Du<input type="date" id="rF" value="${esc(R.from)}"></label><label class="f">Au<input type="date" id="rT" value="${esc(R.to)}"></label>` : ''}
      <label class="f">Intervention<select id="rI"><option value="">Toutes</option>${inters.map(i => `<option ${R.inter === i ? 'selected' : ''}>${esc(i)}</option>`).join('')}</select></label>
      <div style="grid-column:1/-1"><small>Onglets inclus</small><div class="chips" style="margin-top:6px">${S.tabs.map(t => { const open = tabOpen(t.id); return `<button class="chip ${open && R.tabs.includes(t.id) ? 'on' : ''}" data-act="recTab" data-id="${esc(t.id)}">${open ? `<span class="dot" style="background:${esc(t.color)}"></span>` : ic('lock', 's')}${esc(t.name)}</button>`; }).join('')}</div></div>
    </div>
    <div class="big3">
      <div class="card"><small>Total dépensé</small><div class="v">${eur(tot)}</div><small>${ex.length} dépense${ex.length > 1 ? 's' : ''}</small></div>
      <div class="card"><small>Remboursable</small><div class="v" style="color:var(--green)">${eur(rb)}</div><small>dans la limite des plafonds</small></div>
      <div class="card"><small>Hors limite (non remboursé)</small><div class="v" style="color:${xs ? 'var(--red)' : 'inherit'}">${eur(xs)}</div><small>${over.length} dépassement${over.length > 1 ? 's' : ''}</small></div>
    </div>
    <div class="card"><div class="row"><button class="btn primary" data-act="expCsv">${ic('download', 's')}Export CSV (Excel)</button><button class="btn" data-act="expPdf">${ic('file', 's')}PDF / imprimer</button><button class="btn" data-act="expJson">${ic('download', 's')}Sauvegarde</button><button class="btn" data-act="importData">${ic('upload', 's')}Importer</button><button class="btn accent" data-act="syncGmao">${ic('sync', 's')}Synchroniser GMAO</button></div></div>
    <div class="card"><h3>Par catégorie</h3><div class="scroll"><table><thead><tr><th>Catégorie</th><th class="n">Nb</th><th class="n">Total</th><th class="n">Remboursable</th><th class="n">Hors limite</th></tr></thead><tbody>
      ${Object.entries(byCat).sort((a, b) => b[1].t - a[1].t).map(([c, o]) => `<tr><td>${esc(c)}</td><td class="n">${o.n}</td><td class="n">${eur(o.t)}</td><td class="n">${eur(o.r)}</td><td class="n ${o.x ? 'ex' : ''}">${eur(o.x)}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">Aucune dépense sur cette sélection.</td></tr>'}
      ${ex.length ? `<tr class="tot"><td>Total</td><td class="n">${ex.length}</td><td class="n">${eur(tot)}</td><td class="n">${eur(rb)}</td><td class="n ${xs ? 'ex' : ''}">${eur(xs)}</td></tr>` : ''}</tbody></table></div></div>
    ${over.length ? `<div class="card"><h3>Dépassements de plafond</h3><p class="mute" style="font-size:14px;margin-bottom:8px">Seul le montant dans la limite est compté pour le remboursement.</p><div class="scroll"><table><thead><tr><th>Date</th><th>Dépense</th><th>Plafond</th><th class="n">Payé</th><th class="n">Remb.</th><th class="n">Hors limite</th></tr></thead><tbody>
      ${over.map(e => { const r = RB.get(e.id); return `<tr><td>${fmtDate(e.date)}</td><td>${esc(e.merchant)}</td><td>${esc(ruleText(r.rule))}</td><td class="n">${eur(e.amount)}</td><td class="n">${eur(r.remb)}</td><td class="n ex">${eur(r.excess)}</td></tr>`; }).join('')}</tbody></table></div></div>` : ''}
    ${Object.keys(byInter).length ? `<div class="card"><h3>Par intervention (GMAO)</h3><div class="scroll"><table><thead><tr><th>N°</th><th>Client</th><th class="n">Nb</th><th class="n">Total</th><th class="n">Remb.</th><th>Synchro</th></tr></thead><tbody>
      ${Object.entries(byInter).map(([k, o]) => `<tr><td>${esc(k)}</td><td>${esc(o.c)}</td><td class="n">${o.n}</td><td class="n">${eur(o.t)}</td><td class="n">${eur(o.r)}</td><td>${o.ok === o.n ? '<span class="pill grn">À jour</span>' : `<span class="pill">${o.n - o.ok} à envoyer</span>`}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  $('#rP').onchange = e => { R.period = e.target.value; renderRecap(); };
  $('#rI').onchange = e => { R.inter = e.target.value; renderRecap(); };
  if ($('#rF')) { $('#rF').onchange = e => { R.from = e.target.value; renderRecap(); }; $('#rT').onchange = e => { R.to = e.target.value; renderRecap(); }; }
}

/* --- Réglages --- */
const ACCENTS = ['#b8f5d0', '#ffd43b', '#ff8787', '#74c0fc', '#b197fc', '#ffa94d', '#1f6feb', '#0b0c0c'];
function renderSettings() {
  const st = S.settings, p = plan(), q = quotaNow(), bill = st.billing === 'annuel' ? 'y' : 'm';
  const catOpts = c => CATS.map(x => `<option ${x === c ? 'selected' : ''}>${esc(x)}</option>`).join('');
  $('#v-settings').innerHTML = `<h1>Réglages</h1>
  <details class="set" open><summary>${ic('crown')}Abonnement</summary><div class="in">
    <div class="seg" style="max-width:340px"><label><input type="radio" name="bill" value="mensuel" ${bill === 'm' ? 'checked' : ''} data-k="settings.billing">Mensuel</label><label><input type="radio" name="bill" value="annuel" ${bill === 'y' ? 'checked' : ''} data-k="settings.billing">Annuel (2 mois offerts)</label></div>
    <div class="plans">${PLANS.map(pl => `<div class="plan ${pl.id === p.id ? 'cur' : ''}"><h3 style="margin:0">${esc(pl.name)}</h3>
      <div class="p">${pl.m ? eur(pl[bill]) : '0 €'}<small style="font:500 14px var(--ff)">${pl.m ? (bill === 'y' ? ' / an' : ' / mois') : ''}</small></div>
      <ul>${pl.perks.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${pl.id === p.id ? '<span class="pill acc">Plan actuel</span>' : `<button class="btn ${pl.id === 'free' ? '' : 'primary'}" data-act="buy" data-id="${pl.id}">${pl.id === 'free' ? 'Revenir au gratuit' : 'Choisir'}</button>`}</div>`).join('')}</div>
    <label class="chk"><input type="checkbox" data-k="settings.gmaoOpt" ${st.gmaoOpt || p.gmao ? 'checked' : ''} ${p.gmao ? 'disabled' : ''}> Option connexion GMAO : ${eur(GMAO_OPT[bill])} ${bill === 'y' ? '/ an' : '/ mois'} ${p.gmao ? '(incluse dans Business)' : ''}</label>
    <p class="mute" style="font-size:14px">Scans ce mois : ${q.used} / ${p.scans}. Le compteur repart à zéro le 1er de chaque mois.${st.planDemo ? ' <b>Plan activé en mode démonstration.</b>' : ''}</p>
  </div></details>

  <details class="set"><summary>${ic('spark')}Apparence</summary><div class="in">
    <label class="f">Nom de l'application<input data-k="settings.appName" value="${esc(st.appName)}" maxlength="24"></label>
    <div><small>Couleur principale</small><div class="row" style="margin-top:8px">${ACCENTS.map(c => `<button class="sw ${st.accent === c ? 'on' : ''}" style="background:${c}" data-act="accent" data-c="${c}" aria-label="Couleur ${c}"></button>`).join('')}<input type="color" value="${esc(st.accent)}" data-k="settings.accent" aria-label="Couleur personnalisée"></div></div>
    <div class="seg" style="grid-template-columns:repeat(3,1fr)">${[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, v]) => `<label><input type="radio" name="th" value="${k}" ${st.theme === k ? 'checked' : ''} data-k="settings.theme">${v}</label>`).join('')}</div>
  </div></details>

  <details class="set"><summary>${ic('list')}Onglets</summary><div class="in">
    ${S.tabs.map(t => `<div class="trow"><div class="row"><span class="chip" style="pointer-events:none"><span class="dot" style="background:${esc(t.color)}"></span>${ic(t.icon, 's')}${esc(t.name)}</span>
      <span class="mute" style="font-size:13px">${t.remb ? 'remboursable' : 'non remboursable'}${t.gmao ? ' · lié à la GMAO' : ''}${t.lock ? ' · verrouillé' : ''}</span>
      <button class="btn" data-act="editTab" data-id="${esc(t.id)}" style="margin-left:auto">${ic('pen', 's')}Modifier</button></div></div>`).join('')}
    <button class="btn" data-act="newTab">${ic('plus', 's')}Ajouter un onglet</button>
  </div></details>

  <details class="set"><summary>${ic('target')}Plafonds de remboursement</summary><div class="in">
    <p class="mute" style="font-size:14px">Seul le montant dans la limite est compté pour le remboursement ; le reste apparaît « hors limite » dans le récapitulatif.</p>
    ${S.rules.map(r => `<div class="trow"><div class="grid3">
      <label class="f">Catégorie<select data-rule="${r.id}" data-f="cat">${catOpts(r.cat)}</select></label>
      <label class="f">Plafond (€)<input type="number" min="0" step="0.01" inputmode="decimal" value="${r.limit}" data-rule="${r.id}" data-f="limit"></label>
      <label class="f">Période<select data-rule="${r.id}" data-f="per">${Object.entries(PER).map(([k, v]) => `<option value="${k}" ${r.per === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <div class="row">${S.tabs.filter(t => t.remb).map(t => `<label class="chk"><input type="checkbox" data-rule="${r.id}" data-f="tab" value="${esc(t.id)}" ${!r.tabs?.length || r.tabs.includes(t.id) ? 'checked' : ''}>${esc(t.name)}</label>`).join('')}
      <button class="btn danger" data-act="delRule" data-id="${r.id}" style="margin-left:auto">${ic('trash', 's')}Supprimer</button></div></div>`).join('')}
    <button class="btn" data-act="addRule">${ic('plus', 's')}Ajouter un plafond</button>
  </div></details>

  <details class="set"><summary>${ic('chart')}Objectifs de dépenses</summary><div class="in">
    <p class="mute" style="font-size:14px">Calculés sur les onglets choisis en haut de l'accueil. 0 = pas d'objectif.</p>
    <div class="grid3"><label class="f">Par jour (€)<input type="number" min="0" step="1" inputmode="decimal" data-k="obj.jour" value="${S.obj.jour || 0}"></label>
    <label class="f">Par mois (€)<input type="number" min="0" step="1" inputmode="decimal" data-k="obj.mois" value="${S.obj.mois || 0}"></label>
    <label class="f">Par an (€)<input type="number" min="0" step="1" inputmode="decimal" data-k="obj.an" value="${S.obj.an || 0}"></label></div>
  </div></details>

  <details class="set"><summary>${ic('wrench')}GMAO et interventions</summary><div class="in">
    ${hasGmao() ? '' : `<div class="note warn">La synchronisation GMAO fait partie de l'option GMAO (ou du plan Business). L'export par intervention reste disponible.</div>`}
    <label class="f">Adresse du service GMAO (notes de frais)<input type="url" data-k="settings.gmaoUrl" value="${esc(st.gmaoUrl)}" placeholder="https://weld-loaner-ledger.lovable.app/api/public/notes-de-frais"></label>
    <label class="f">Jeton d'accès GMAO<input type="password" data-k="settings.gmaoToken" value="${esc(st.gmaoToken)}" autocomplete="off" placeholder="fp_… (GMAO : Notes de frais › Recevoir les dépenses de FraisPilot)"></label>
    <label class="chk"><input type="checkbox" data-k="settings.gmaoImgs" ${st.gmaoImgs ? 'checked' : ''}> Joindre les justificatifs (photos) à l'envoi</label>
    <div class="row"><button class="btn" data-act="loadInter">${ic('download', 's')}Charger les interventions depuis la GMAO</button></div>
    <h3 style="margin:6px 0 0">Interventions enregistrées</h3>
    ${S.inter.length ? `<div class="scroll"><table><thead><tr><th>N°</th><th>Client</th><th>Libellé</th><th></th></tr></thead><tbody>${S.inter.map((i, k) => `<tr><td>${esc(i.num)}</td><td>${esc(i.client)}</td><td>${esc(i.label)}</td><td class="n"><button class="btn icon ghost" data-act="delInter" data-i="${k}" aria-label="Supprimer">${ic('trash', 's')}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="mute" style="font-size:14px">Aucune pour l\'instant.</p>'}
    <form id="interF" class="grid3"><input name="num" placeholder="N° (ex. ${new Date().getFullYear()}-S012)" required><input name="client" placeholder="Client"><input name="label" placeholder="Libellé (ex. HM3010DCV)"><button class="btn" style="grid-column:1/-1">${ic('plus', 's')}Ajouter l'intervention</button></form>
  </div></details>

  <details class="set"><summary>${ic('spark')}Lecture automatique (Mistral)</summary><div class="in">
    <p class="mute" style="font-size:14px">Les tickets et factures sont lus par Mistral OCR, qui remplit commerçant, date, montant, TVA et catégorie.</p>
    <label class="f">Serveur relais (recommandé)<input type="url" data-k="settings.proxyUrl" value="${esc(st.proxyUrl)}" placeholder="https://fraispilot-api.votre-compte.workers.dev"></label>
    <label class="f">ou clé API Mistral directe (tests sur votre appareil uniquement)<input type="password" data-k="settings.apiKey" value="${esc(st.apiKey)}" autocomplete="off" placeholder="Clé créée sur console.mistral.ai"></label>
    <div class="note">Pour la version publique, utilisez toujours le serveur relais : la clé reste cachée et les quotas de scans sont contrôlés côté serveur.</div>
    <div class="row"><button class="btn" data-act="testOcr">${ic('check', 's')}Tester la connexion</button></div>
  </div></details>

  <details class="set"><summary>${ic('lock')}Sécurité</summary><div class="in">
    <p style="font-size:15px">Accès : <b>${S.account?.lock.method === 'pin' ? 'code à 4 chiffres' : 'mot de passe'}</b> · mail de récupération : <b>${esc(S.account?.email)}</b></p>
    <div class="row"><button class="btn" data-act="changeSecret">${ic('pen', 's')}Changer le code / mot de passe</button><button class="btn" data-act="changeEmail">Changer l'adresse mail</button><button class="btn" data-act="newRec">Nouveau code de secours</button></div>
    <label class="f" style="max-width:260px">Verrouillage auto après (minutes en arrière-plan)<input type="number" min="0" max="120" data-k="settings.autoLockMin" value="${st.autoLockMin}"></label>
  </div></details>

  <details class="set"><summary>${ic('download')}Données</summary><div class="in">
    <div class="row"><button class="btn" data-act="expJson">${ic('download', 's')}Sauvegarde complète</button><button class="btn" data-act="importData">${ic('upload', 's')}Importer (sauvegarde ou CSV)</button><button class="btn danger" data-act="wipe">${ic('trash', 's')}Tout effacer</button></div>
    <p class="mute" style="font-size:14px">Format CSV accepté : date;commerçant;catégorie;montant;tva;onglet;intervention;client;note (séparateur ; ou ,).</p>
    <p class="mute" style="font-size:13px">${S.exps.length} dépenses · stockage ${DB.ok ? 'sur l’appareil' : 'temporaire (ce navigateur bloque le stockage)'}.</p>
  </div></details>

  <details class="set"><summary>${ic('phone')}Installer l'application</summary><div class="in">${installHelp()}</div></details>
  <details class="set"><summary>${ic('tag')}Publicité (plan gratuit)</summary><div class="in">
    <label class="f">Identifiant éditeur AdSense (ca-pub-…)<input data-k="settings.adClient" value="${esc(st.adClient)}" placeholder="ca-pub-0000000000000000"></label>
    <label class="f">Identifiant du bloc d'annonce<input data-k="settings.adSlot" value="${esc(st.adSlot)}"></label>
    <p class="mute" style="font-size:14px">Sans identifiant, le bandeau du plan gratuit présente les plans payants.</p>
  </div></details>
  <p class="mute" style="text-align:center;font-size:13px">${esc(st.appName)} · version 1.0 · appareil ${esc(st.deviceId.slice(-6))}</p>`;
  $('#interF').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    S.inter.push({ num: f.num.value.trim().toUpperCase(), client: f.client.value.trim(), label: f.label.value.trim() });
    await save('inter'); renderSettings(); openSection('GMAO'); toast('Intervention ajoutée');
  };
}
function openSection(word) { const d = $$('#v-settings details').find(x => x.querySelector('summary').textContent.includes(word)); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }

/* ---------- Installation PWA ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (S.ses.unlocked && S.ses.view === 'home') renderHome(); });
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
function installHelp() {
  return `${installEvt ? `<button class="btn primary" data-act="install">${ic('download', 's')}Installer sur cet appareil</button>` : ''}
    <ul style="margin:0;padding-left:18px;font-size:14px;display:grid;gap:6px">
      <li><b>Android / Chrome / Edge (PC)</b> : menu ⋮ puis « Installer l'application ».</li>
      <li><b>iPhone / iPad</b> : Safari, bouton Partager puis « Sur l'écran d'accueil ».</li>
      <li><b>Mac</b> : Safari, menu Fichier puis « Ajouter au Dock » (ou Chrome : icône d'installation dans la barre d'adresse).</li>
      <li><b>Play Store</b> : version emballée (Trusted Web Activity) avec paiement Google Play.</li></ul>`;
}
function installCard() {
  if (standalone() || IN_FRAME) return '';
  return `<div class="card"><div class="row"><div class="grow"><h3 style="margin:0">Installer ${esc(S.settings.appName)}</h3><small>Mobile, tablette, PC ou Mac : l'appli fonctionne même hors connexion.</small></div>
    ${installEvt ? `<button class="btn primary" data-act="install">Installer</button>` : `<button class="btn" data-act="installHelp">Comment faire</button>`}</div></div>`;
}

/* ---------- Publicité ---------- */
let adLoaded = false;
function renderAd() {
  const box = $('#ad'), p = plan();
  if (!p.ads || !S.ses.unlocked) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  const st = S.settings;
  if (st.adClient && !IN_FRAME) {
    if (box.dataset.k === st.adClient + st.adSlot) return;
    box.dataset.k = st.adClient + st.adSlot;
    box.innerHTML = `<div class="adbox" style="padding:4px;display:block"><ins class="adsbygoogle" style="display:block;height:60px" data-ad-client="${esc(st.adClient)}" data-ad-slot="${esc(st.adSlot)}" data-ad-format="horizontal" data-full-width-responsive="true"></ins></div>`;
    if (!adLoaded) { const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous'; s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(st.adClient); document.head.append(s); adLoaded = true; }
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    return;
  }
  box.dataset.k = '';
  box.innerHTML = `<div class="adbox"><span class="tag">Annonce</span><span class="grow">Plan Solo : 200 scans par mois, sans publicité — ${eur(PLANS[1].m)} / mois</span><button class="btn accent" data-act="plans" style="min-height:38px">Voir</button></div>`;
}

/* ---------- Abonnements ---------- */
async function buy(id) {
  const pl = PLANS.find(x => x.id === id); if (!pl) return;
  const st = S.settings, per = st.billing === 'annuel' ? 'yearly' : 'monthly';
  if (id === 'free') { if (await confirmBox('Revenir au plan gratuit', 'Le plan gratuit inclut 10 scans par mois et des publicités.', 'Confirmer')) { st.plan = 'free'; st.planDemo = false; await save('settings'); render(); } return; }
  // 1) Application installée depuis le Play Store : facturation Google Play obligatoire
  if ('getDigitalGoodsService' in window) {
    try {
      const svc = await window.getDigitalGoodsService('https://play.google.com/billing');
      if (svc) {
        const sku = `${id}_${per}`;
        const req = new PaymentRequest([{ supportedMethods: 'https://play.google.com/billing', data: { sku } }], { total: { label: 'Total', amount: { currency: 'EUR', value: '0' } } });
        const resp = await req.show();
        const token = resp.details.purchaseToken;
        const r = await fetch(proxy() + '/billing/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku, token, deviceId: st.deviceId }) });
        const j = await r.json().catch(() => ({}));
        await resp.complete(r.ok ? 'success' : 'fail');
        if (r.ok && j.license) { st.plan = id; st.license = j.license; st.planDemo = false; await save('settings'); render(); toast('Abonnement ' + pl.name + ' activé, merci !'); }
        else toast(j.error || 'Achat non validé par le serveur');
        return;
      }
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  // 2) Version web : lien de paiement (Stripe Payment Link) configuré sur le serveur relais
  if (proxy()) {
    try {
      const r = await fetch(proxy() + '/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: id, period: per, gmao: st.gmaoOpt, deviceId: st.deviceId, email: S.account?.email }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) { location.href = j.url; return; }
    } catch {}
  }
  // 3) Pas encore de paiement branché : activation de démonstration
  if (await confirmBox('Mode démonstration', `Aucun moyen de paiement n'est encore branché. Activer le plan <b>${esc(pl.name)}</b> en démonstration sur cet appareil ?`, 'Activer la démo')) {
    st.plan = id; st.planDemo = true; await save('settings'); render(); toast('Plan ' + pl.name + ' activé (démo)');
  }
}

/* ---------- Photos, ticket long, import ---------- */
const loadImg = b => new Promise((res, rej) => { const u = URL.createObjectURL(b), i = new Image(); i.onload = () => { res(i); setTimeout(() => URL.revokeObjectURL(u), 1000); }; i.onerror = rej; i.src = u; });
const toBlob = (c, q = .84) => new Promise(r => c.toBlob(r, 'image/jpeg', q));
async function compress(file, maxSide = 1800, maxW = 0) {
  if (!file.type.startsWith('image/')) return file;
  try {
    const im = await loadImg(file);
    const s = maxW ? Math.min(1, maxW / im.width) : Math.min(1, maxSide / Math.max(im.width, im.height));
    const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return (await toBlob(c)) || file;
  } catch { return file; }
}
/* Assemble les photos d'un ticket long, de haut en bas, en une seule image. */
async function stitch(blobs) {
  const ims = await Promise.all(blobs.map(loadImg));
  const W = Math.min(1100, Math.max(...ims.map(i => i.width)));
  const hs = ims.map(i => Math.round(i.height * W / i.width)), H = hs.reduce((a, b) => a + b, 0);
  const k = Math.min(1, 14000 / H), cw = Math.round(W * k), ch = Math.round(H * k);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch);
  let y = 0; ims.forEach((im, i) => { const h = Math.round(hs[i] * k); g.drawImage(im, 0, y, cw, h); y += h; });
  return toBlob(c, .86);
}
function openAdd() {
  const m = modal(`<div class="hd"><h2>Nouvelle dépense</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div>
    <div class="opts">
      <button class="opt main" data-go="cam">${ic('camera')}Photo du ticket<small>Remplissage automatique</small></button>
      <button class="opt" data-go="long">${ic('long')}Ticket long<small>Plusieurs photos assemblées</small></button>
      <button class="opt" data-go="files">${ic('upload')}Importer<small>Photos, factures PDF (plusieurs possibles)</small></button>
      <button class="opt" data-go="manual">${ic('pen')}Saisie manuelle<small>Sans justificatif</small></button>
      <button class="opt" data-go="voice">${ic('mic')}À la voix<small>« 18 € de repas chez Paul »</small></button>
      <button class="opt" data-go="data">${ic('download')}Importer un fichier<small>CSV ou sauvegarde</small></button>
    </div>
    <p class="mute" style="font-size:13px">Scans restants ce mois : ${Math.max(0, plan().scans - quotaNow().used)} / ${plan().scans}</p>`);
  m.el.addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    const g = b.dataset.go; m.close();
    if (g === 'cam') $('#inCam').click();
    else if (g === 'long') openLong();
    else if (g === 'files') $('#inFiles').click();
    else if (g === 'manual') openForm({});
    else if (g === 'voice') voiceCommand();
    else if (g === 'data') $('#inData').click();
  });
}
let longParts = [], longModal = null;
function openLong() {
  longParts = [];
  longModal = modal(`<div class="hd"><h2>Ticket long</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div>
    <p class="mute" style="font-size:14px">Photographiez le ticket de haut en bas, partie par partie, bord à bord. Les photos sont assemblées en une seule image, lue en un seul scan.</p>
    <div class="parts" id="lp"><p class="mute">Aucune partie pour l'instant</p></div>
    <div class="grid2"><button class="btn primary" id="lAdd">${ic('camera', 's')}Photographier la partie 1</button><button class="btn" id="lGal">${ic('image', 's')}Depuis la galerie</button></div>
    <div class="row"><button class="btn ghost" id="lUndo" disabled>Retirer la dernière</button><button class="btn accent grow" id="lGo" disabled>${ic('spark', 's')}Assembler et lire</button></div>`, { onClose: () => { longModal = null; } });
  $('#lAdd', longModal.el).onclick = () => $('#inLong').click();
  $('#lGal', longModal.el).onclick = () => $('#inLongGal').click();
  $('#lUndo', longModal.el).onclick = () => { longParts.pop(); drawLong(); };
  $('#lGo', longModal.el).onclick = async () => {
    const b = $('#lGo', longModal.el); b.disabled = true; b.innerHTML = '<span class="spin"></span>Assemblage…';
    const img = await stitch(longParts); const mm = longModal; mm.close();
    openForm({ note: `Ticket long (${longParts.length} photos)` }, { blobs: [img], auto: true });
  };
}
function drawLong() {
  if (!longModal) return; const el = longModal.el;
  $('#lp', el).innerHTML = longParts.length ? longParts.map(b => `<img src="${URL.createObjectURL(b)}" alt="">`).join('') : "<p class='mute'>Aucune partie pour l'instant</p>";
  $('#lAdd', el).innerHTML = ic('camera', 's') + `Photographier la partie ${longParts.length + 1}`;
  $('#lUndo', el).disabled = !longParts.length; $('#lGo', el).disabled = longParts.length < 1;
  const lp = $('#lp', el); lp.scrollTop = lp.scrollHeight;
}
async function onLongFiles(files) { for (const f of files) longParts.push(await compress(f, 0, 1100)); drawLong(); }
async function onFiles(files) {
  files = [...files]; if (!files.length) return;
  if (files.length === 1) { const f = files[0]; const b = await compress(f); openForm({ pdf: f.type === 'application/pdf' }, { blobs: [b], auto: true }); return; }
  // Import en série : lecture auto de chaque justificatif, enregistrement « à vérifier »
  const tabId = S.ses.tab !== 'all' && tabOpen(S.ses.tab) ? S.ses.tab : (openTabs()[0]?.id || 'pro');
  const m = modal(`<div class="hd"><h2>Import de ${files.length} justificatifs</h2></div><div class="status"><span class="spin"></span><span id="bS">Préparation…</span></div>`);
  let ok = 0, read = 0, stop = '', dups = 0;
  for (let i = 0; i < files.length; i++) {
    $('#bS', m.el).textContent = `Justificatif ${i + 1} / ${files.length}…`;
    const f = files[i], b = await compress(f);
    const e = { id: uid(), tabId, date: today(), merchant: f.name.replace(/\.[^.]+$/, ''), amount: 0, vat: 0, cat: 'Autre', qty: 1, pay: '', note: '', inter: '', client: '', imgs: [], createdAt: Date.now() + i, check: true, pdf: f.type === 'application/pdf' };
    if (!stop) {
      try { Object.assign(e, pick(await ocrBlob(b))); read++; }
      catch (err) { stop = err.code === 'quota' ? 'quota' : err.message; }
    }
    const dup = findDup(e); if (dup) { e.dupSuspect = true; e.dupOf = dup.id; dups++; }
    const imgId = uid(); await DB.set('img', imgId, b).catch(() => {}); e.imgs = [imgId];
    S.exps.push(e); await saveExp(e); ok++;
  }
  m.close(); render();
  toast(`${ok} justificatifs importés, ${read} lus automatiquement${dups ? `, ${dups} doublon(s) possible(s)` : ''}${stop === 'quota' ? ' (quota de scans atteint)' : stop ? ' (' + stop + ')' : ''}. À vérifier dans la liste.`, 5000);
}
/* Doublon probable : même jour, même montant et même commerçant (ou commerçant absent d'un côté). */
const sameMerchant = (a, b) => { const x = norm(a).replace(/[^a-z0-9]/g, ''), y = norm(b).replace(/[^a-z0-9]/g, ''); return !x || !y || x === y || x.includes(y) || y.includes(x); };
const findDup = (e, list = S.exps) => list.find(x => x.id !== e.id && x.date === e.date && Math.abs(r2(x.amount) - r2(e.amount)) < 0.005 && sameMerchant(x.merchant, e.merchant));
const dupText = d => { const t = tabById(d.tabId); return tabOpen(d.tabId) ? `<b>${esc(d.merchant || 'Sans nom')}</b>, ${eur(d.amount)} le ${fmtDate(d.date)}${t ? ` (${esc(t.name)})` : ''}` : `une dépense de ${eur(d.amount)} le ${fmtDate(d.date)}, dans un onglet verrouillé`; };
const pick = o => { const r = {}; for (const k of ['merchant', 'date', 'amount', 'vat', 'cat', 'pay', 'qty', 'note']) if (o[k] !== undefined && o[k] !== '' && o[k] !== null) r[k] = o[k]; return r; };

/* ---------- Lecture automatique Mistral ---------- */
const SCHEMA = { type: 'object', properties: {
  merchant: { type: 'string', description: 'Nom du commerçant ou du fournisseur' },
  date: { type: 'string', description: "Date d'achat au format AAAA-MM-JJ" },
  total_ttc: { type: 'number', description: 'Montant total payé TTC en euros' },
  tva: { type: 'number', description: 'Montant total de TVA (0 si absent)' },
  category: { type: 'string', enum: CATS },
  payment: { type: 'string', description: 'Moyen de paiement (CB, espèces, …)' },
  quantity: { type: 'number', description: 'Nombre de nuits, repas ou couverts si indiqué, sinon 1' },
  invoice_number: { type: 'string', description: 'Numéro de facture ou de ticket' }
}, required: ['merchant', 'date', 'total_ttc'] };
const toDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
const err = (msg, code) => Object.assign(new Error(msg), { code });
async function ocrBlob(blob) {
  const q = quotaNow(), lim = plan().scans;
  if (q.used >= lim) throw err('Quota de scans atteint', 'quota');
  const dataUrl = await toDataURL(blob), pdf = blob.type === 'application/pdf';
  let raw;
  if (proxy()) {
    const r = await fetch(proxy() + '/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-Id': S.settings.deviceId, 'X-License': S.settings.license || '' }, body: JSON.stringify({ file: dataUrl, plan: S.settings.plan }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 402) throw err(j.error || 'Quota de scans atteint', 'quota');
    if (!r.ok) throw err(j.error || 'Serveur relais : erreur ' + r.status);
    raw = j.fields || {};
    if (j.quota) { S.quota = { month: today().slice(0, 7), used: j.quota.used }; await save('quota'); renderChrome(); return clean(raw); }
  } else if (S.settings.apiKey) raw = await mistralDirect(dataUrl, pdf);
  else throw err('Lecture automatique non configurée : renseignez le serveur relais ou une clé Mistral dans Réglages.', 'config');
  q.used++; await save('quota'); renderChrome();
  return clean(raw);
}
async function mistralDirect(dataUrl, pdf) {
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.settings.apiKey.trim() };
  const r = await fetch(MISTRAL.base + '/ocr', { method: 'POST', headers: H, body: JSON.stringify({
    model: MISTRAL.ocr,
    document: pdf ? { type: 'document_url', document_url: dataUrl } : { type: 'image_url', image_url: dataUrl },
    document_annotation_format: { type: 'json_schema', json_schema: { name: 'justificatif', schema: SCHEMA, strict: false } }
  }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw err('Mistral : ' + (j.message || j.detail?.[0]?.msg || j.error || r.status));
  let a = j.document_annotation;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = null; } }
  if (a && (a.total_ttc || a.merchant)) return a;
  // Repli : texte OCR puis extraction par un modèle de chat
  const md = (j.pages || []).map(p => p.markdown).join('\n').slice(0, 12000);
  const c = await fetch(MISTRAL.base + '/chat/completions', { method: 'POST', headers: H, body: JSON.stringify({
    model: MISTRAL.chat, temperature: 0, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: 'Tu extrais les données d\'un ticket de caisse ou d\'une facture française. Réponds uniquement en JSON avec les clés : merchant, date (AAAA-MM-JJ), total_ttc (nombre), tva (nombre), category (une de : ' + CATS.join(', ') + '), payment, quantity, invoice_number.' }, { role: 'user', content: md }]
  }) });
  const cj = await c.json().catch(() => ({}));
  if (!c.ok) throw err('Mistral : ' + (cj.message || c.status));
  try { return JSON.parse(cj.choices[0].message.content); } catch { throw err('Lecture du justificatif impossible'); }
}
function normDate(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return today();
}
function mapPay(p) { const s = norm(p); if (!s) return ''; if (/esp|cash/.test(s)) return 'Espèces'; if (/vir/.test(s)) return 'Virement'; if (/cb|carte|visa|master|card|sans contact/.test(s)) return ''; return ''; }
function clean(o) {
  const cat = CATS.includes(o.category) ? o.category : (guessCat(o.merchant) || 'Autre');
  return { merchant: String(o.merchant || '').trim().slice(0, 80), date: normDate(o.date), amount: r2(num(o.total_ttc)), vat: r2(num(o.tva)), cat,
    pay: mapPay(o.payment), qty: Math.max(1, Math.round(num(o.quantity)) || 1), note: o.invoice_number ? 'N° ' + String(o.invoice_number).slice(0, 40) : '' };
}

/* ---------- Fiche dépense ---------- */
async function openForm(draft = {}, opts = {}) {
  const isNew = !draft.id || !S.exps.some(x => x.id === draft.id);
  const defTab = S.ses.tab !== 'all' && tabOpen(S.ses.tab) ? S.ses.tab : (openTabs()[0]?.id || 'pro');
  const e = { id: uid(), tabId: defTab, date: today(), merchant: '', amount: '', vat: '', cat: '', qty: 1, pay: '', note: '', inter: '', client: '', imgs: [], createdAt: Date.now(), ...structuredClone(draft) };
  const blobs = [...(opts.blobs || [])], removed = [];
  const tabOpts = openTabs().map(t => `<option value="${esc(t.id)}" ${t.id === e.tabId ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  const m = modal(`<div class="hd"><h2>${isNew ? 'Nouvelle dépense' : 'Modifier la dépense'}</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div>
    <div class="pics" id="fPics"></div>
    <div id="fStat"></div>
    <form id="fF" style="display:grid;gap:12px">
      <div class="grid2"><label class="f">Onglet<select name="tabId">${tabOpts}</select></label><label class="f">Date<input type="date" name="date" value="${esc(e.date)}" required></label></div>
      <label class="f">Commerçant / fournisseur<input name="merchant" value="${esc(e.merchant)}" autocomplete="off" placeholder="Ex. Brasserie du Port"></label>
      <div class="grid2"><label class="f">Montant TTC (€)<input name="amount" inputmode="decimal" value="${e.amount === '' ? '' : String(e.amount).replace('.', ',')}" required placeholder="0,00"></label><label class="f">dont TVA (€)<input name="vat" inputmode="decimal" value="${e.vat === '' ? '' : String(e.vat).replace('.', ',')}" placeholder="0,00"></label></div>
      <div class="grid2"><label class="f">Catégorie<select name="cat"><option value="">—</option>${CATS.map(c => `<option ${c === e.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><label class="f">Quantité (nuits, repas…)<input name="qty" type="number" min="1" step="1" value="${e.qty || 1}"></label></div>
      <label class="f">Paiement<select name="pay"><option value="">—</option>${PAY.map(p => `<option ${p === e.pay ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
      <div id="fPro" class="grid2"><label class="f">N° d'intervention<input name="inter" list="interL" value="${esc(e.inter)}" placeholder="${new Date().getFullYear()}-S001" autocapitalize="characters"></label><label class="f">Client<input name="client" value="${esc(e.client)}"></label></div>
      <datalist id="interL">${S.inter.map(i => `<option value="${esc(i.num)}">${esc(i.client)} ${esc(i.label)}</option>`).join('')}</datalist>
      <label class="f">Note<textarea name="note" rows="2">${esc(e.note)}</textarea></label>
      <div class="reimb" id="fR"></div>
      <div class="row">${isNew ? '' : `<button type="button" class="btn danger" id="fDel">${ic('trash', 's')}Supprimer</button>`}<span class="grow"></span><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">${ic('check', 's')}Enregistrer</button></div>
    </form>`, { wide: true });
  const el = m.el, f = $('#fF', el);
  const urls = [];
  const drawPics = async () => {
    let h = '';
    for (const id of e.imgs) { const b = await DB.get('img', id).catch(() => null); if (!b) continue; const u = URL.createObjectURL(b); urls.push(u); h += `<div class="pic">${String(b.type).startsWith('image/') ? `<img src="${u}" alt="">` : ic('file', 'l')}<button type="button" data-rm="s:${id}" aria-label="Retirer">${ic('x')}</button></div>`; }
    blobs.forEach((b, i) => { const u = URL.createObjectURL(b); urls.push(u); h += `<div class="pic">${String(b.type).startsWith('image/') ? `<img src="${u}" alt="">` : ic('file', 'l')}<button type="button" data-rm="n:${i}" aria-label="Retirer">${ic('x')}</button></div>`; });
    h += `<button type="button" class="addpic" id="fAdd" aria-label="Ajouter un justificatif">${ic('camera', 'l')}</button>`;
    $('#fPics', el).innerHTML = h;
    const any = e.imgs.length || blobs.length;
    if (!$('#fStat', el).dataset.busy) $('#fStat', el).innerHTML = any ? `<button type="button" class="btn accent" id="fOcr" style="width:100%">${ic('spark', 's')}Lire le justificatif et remplir</button>` : '';
  };
  const firstBlob = async () => blobs[0] || (e.imgs[0] ? await DB.get('img', e.imgs[0]).catch(() => null) : null);
  const setVal = (n, v) => { if (v === undefined || v === null || v === '') return; const i = f[n]; if (!i) return; i.value = typeof v === 'number' && n !== 'qty' ? String(v).replace('.', ',') : v; i.classList.remove('filled'); void i.offsetWidth; i.classList.add('filled'); };
  const runOcr = async () => {
    const st = $('#fStat', el), b = await firstBlob(); if (!b) return;
    st.dataset.busy = '1'; st.innerHTML = `<div class="status"><span class="spin"></span>Lecture du justificatif par Mistral…</div>`;
    try {
      const d = await ocrBlob(b);
      ['merchant', 'date', 'amount', 'vat', 'cat', 'qty', 'pay'].forEach(k => setVal(k, d[k]));
      if (d.note && !f.note.value) setVal('note', d.note);
      st.innerHTML = `<div class="status ok">${ic('check', 's')}Rempli automatiquement — vérifiez le montant avant d'enregistrer.</div>`;
      updR();
    } catch (x) {
      st.innerHTML = `<div class="status err">${esc(x.message)}</div>${x.code === 'quota' ? `<button type="button" class="btn accent" data-act="plans" style="width:100%">${ic('crown', 's')}Passer à un plan avec plus de scans</button>` : x.code === 'config' ? `<button type="button" class="btn" id="fCfg" style="width:100%">Ouvrir les réglages</button>` : ''}`;
      const c = $('#fCfg', el); if (c) c.onclick = () => { m.close(); nav('settings'); openSection('Mistral'); };
    }
    delete st.dataset.busy;
  };
  const updR = () => {
    const t = tabById(f.tabId.value);
    $('#fPro', el).hidden = !t?.gmao;
    const amt = num(f.amount.value);
    if (!t?.remb) { $('#fR', el).innerHTML = `<span class="mute">Onglet non remboursable : dépense comptée dans vos totaux uniquement.</span>`; return; }
    const tmp = { ...e, tabId: f.tabId.value, date: f.date.value || today(), amount: amt, cat: f.cat.value, qty: +f.qty.value || 1 };
    const R = computeReimb([...S.exps.filter(x => x.id !== e.id), tmp]).get(e.id) || { remb: amt, excess: 0 };
    $('#fR', el).innerHTML = R.excess > 0
      ? `Remboursable : <b style="color:var(--green)">${eur(R.remb)}</b> · hors limite : <b style="color:var(--red)">${eur(R.excess)}</b><br><small>${esc(ruleText(R.rule))}</small>`
      : `Remboursable : <b style="color:var(--green)">${eur(R.remb)}</b>${R.rule ? ` <small>(${esc(ruleText(R.rule))})</small>` : ''}`;
  };
  f.addEventListener('input', updR); f.addEventListener('change', updR);
  f.inter.addEventListener('change', () => { const i = S.inter.find(x => x.num === f.inter.value.trim().toUpperCase()); if (i && !f.client.value) f.client.value = i.client; });
  el.addEventListener('click', async ev => {
    const rm = ev.target.closest('[data-rm]');
    if (rm) { const [k, v] = rm.dataset.rm.split(':'); if (k === 's') { e.imgs = e.imgs.filter(x => x !== v); removed.push(v); } else blobs.splice(+v, 1); drawPics(); return; }
    if (ev.target.closest('#fAdd')) { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,application/pdf'; inp.multiple = true; inp.onchange = async () => { for (const fl of inp.files) blobs.push(await compress(fl)); drawPics(); }; inp.click(); return; }
    if (ev.target.closest('#fOcr')) runOcr();
  });
  if (!isNew) $('#fDel', el).onclick = async () => {
    if (!await confirmBox('Supprimer cette dépense ?', `${esc(e.merchant || 'Sans nom')} — ${eur(e.amount)}. Le justificatif sera aussi supprimé.`, 'Supprimer', true)) return;
    S.exps = S.exps.filter(x => x.id !== e.id); await DB.del('exp', e.id).catch(() => {}); for (const i of e.imgs) await DB.del('img', i).catch(() => {});
    m.close(); render(); toast('Dépense supprimée');
  };
  f.onsubmit = async ev => {
    ev.preventDefault();
    const amt = r2(num(f.amount.value)); if (!(amt > 0)) { toast('Indiquez un montant'); f.amount.focus(); return; }
    Object.assign(e, { tabId: f.tabId.value, date: f.date.value, merchant: f.merchant.value.trim(), amount: amt, vat: r2(num(f.vat.value)), cat: f.cat.value || guessCat(f.merchant.value) || 'Autre',
      qty: Math.max(1, +f.qty.value || 1), pay: f.pay.value, note: f.note.value.trim(), inter: f.inter.value.trim().toUpperCase(), client: f.client.value.trim(), check: false, dupSuspect: false, updatedAt: Date.now() });
    if (!tabById(e.tabId)?.gmao) { e.inter = ''; e.client = ''; }
    const dup = findDup(e);
    if (dup && e.dupOf !== dup.id) {
      if (!await confirmBox('Dépense déjà saisie ?', `Une dépense identique existe déjà : ${dupText(dup)}.<br>L'enregistrer quand même ?`, 'Enregistrer quand même')) return;
      e.dupOf = dup.id;
    }
    if (e.sync === 'ok' && !isNew) e.sync = 'modifié';
    for (const b of blobs) { const id = uid(); await DB.set('img', id, b).catch(() => {}); e.imgs.push(id); }
    for (const id of removed) await DB.del('img', id).catch(() => {});
    if (blobs.some(b => b.type === 'application/pdf')) e.pdf = true;
    const i = S.exps.findIndex(x => x.id === e.id); if (i >= 0) S.exps[i] = e; else S.exps.push(e);
    await saveExp(e); m.close(); urls.forEach(u => URL.revokeObjectURL(u));
    if (S.ses.view === 'home' || S.ses.tab === e.tabId || S.ses.tab === 'all') render(); else { S.ses.tab = e.tabId; nav('list'); }
    const R = computeReimb().get(e.id);
    toast(R?.excess > 0 ? `Enregistré · ${eur(R.excess)} hors limite, non remboursé` : 'Dépense enregistrée');
  };
  await drawPics(); updR();
  if (opts.auto && blobs.length) runOcr();
}

/* ---------- Onglets ---------- */
function editTab(id) {
  const t = id ? tabById(id) : { id: uid(), name: '', icon: 'tag', color: '#7048e8', remb: true, gmao: false, lock: null };
  const isNew = !id;
  const m = modal(`<div class="hd"><h2>${isNew ? 'Nouvel onglet' : 'Onglet ' + esc(t.name)}</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div>
    <form id="tF" style="display:grid;gap:12px">
      <label class="f">Nom<input name="name" value="${esc(t.name)}" required maxlength="30" placeholder="Ex. Déplacements chantier"></label>
      <div><small>Icône</small><div class="row" style="margin-top:6px">${TAB_ICONS.map(n => `<label class="chip ${t.icon === n ? 'on' : ''}" style="padding:0 12px"><input type="radio" name="icon" value="${n}" ${t.icon === n ? 'checked' : ''} hidden>${ic(n, 's')}</label>`).join('')}</div></div>
      <label class="f" style="grid-template-columns:auto 1fr;align-items:center">Couleur <input type="color" name="color" value="${esc(t.color)}"></label>
      <label class="chk"><input type="checkbox" name="remb" ${t.remb ? 'checked' : ''}> Dépenses remboursables (plafonds appliqués)</label>
      <label class="chk"><input type="checkbox" name="gmao" ${t.gmao ? 'checked' : ''}> Lié à la GMAO (n° d'intervention, synchronisation)</label>
      <div class="trow"><b>Verrou de l'onglet</b><span class="mute" style="font-size:14px">${t.lock ? (t.lock.method === 'pin' ? 'Code à 4 chiffres actif' : 'Mot de passe actif') : 'Aucun verrou'}</span>
        <div class="row"><button type="button" class="btn" id="tLock">${ic('lock', 's')}${t.lock ? 'Changer le verrou' : 'Ajouter un verrou'}</button>${t.lock ? `<button type="button" class="btn" id="tUnl">${ic('unlock', 's')}Retirer le verrou</button>` : ''}</div></div>
      <div class="row">${!isNew && !t.fixed ? `<button type="button" class="btn danger" id="tDel">${ic('trash', 's')}Supprimer</button>` : ''}<span class="grow"></span><button class="btn primary">${ic('check', 's')}Enregistrer</button></div>
    </form>`);
  const el = m.el, f = $('#tF', el);
  f.addEventListener('change', ev => { if (ev.target.name === 'icon') $$('label.chip', f).forEach(l => l.classList.toggle('on', l.querySelector('input').checked)); });
  $('#tLock', el).onclick = () => {
    const mm = modal(`<div class="hd"><h2>Verrou de l'onglet</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div><form id="lkF" style="display:grid;gap:14px">${methodSeg('pin')}<button class="btn primary big">Activer le verrou</button></form>`);
    const lf = $('#lkF', mm.el); bindSecretForm(lf);
    lf.onsubmit = async ev => { ev.preventDefault(); const s = readSecretForm(lf); if (!s) return; t.lock = await makeLock(s.method, s.secret); S.ses.tabs.add(t.id); mm.close(); toast('Verrou prêt — enregistrez l’onglet'); $('#tLock', el).innerHTML = ic('lock', 's') + 'Verrou défini'; };
  };
  const un = $('#tUnl', el); if (un) un.onclick = async () => { if (await askUnlock(t.lock, 'Code actuel de l’onglet')) { t.lock = null; un.remove(); toast('Verrou retiré — enregistrez l’onglet'); } };
  const del = $('#tDel', el); if (del) del.onclick = async () => {
    const n = S.exps.filter(x => x.tabId === t.id).length;
    if (t.lock && !S.ses.tabs.has(t.id) && !await askUnlock(t.lock, 'Code de l’onglet')) return;
    if (!await confirmBox('Supprimer l’onglet ?', `${esc(t.name)} et ses ${n} dépense${n > 1 ? 's' : ''} seront supprimés définitivement.`, 'Supprimer', true)) return;
    for (const x of S.exps.filter(x => x.tabId === t.id)) { await DB.del('exp', x.id).catch(() => {}); for (const i of x.imgs || []) await DB.del('img', i).catch(() => {}); }
    S.exps = S.exps.filter(x => x.tabId !== t.id); S.tabs = S.tabs.filter(x => x.id !== t.id);
    S.rules.forEach(r => { r.tabs = (r.tabs || []).filter(x => x !== t.id); }); S.obj.tabs = S.obj.tabs.filter(x => x !== t.id);
    await Promise.all([save('tabs'), save('rules'), save('obj')]); if (S.ses.tab === t.id) S.ses.tab = 'all';
    m.close(); render(); toast('Onglet supprimé');
  };
  f.onsubmit = async ev => {
    ev.preventDefault();
    const fe = f.elements; Object.assign(t, { name: fe.name.value.trim(), icon: fe.icon.value || 'tag', color: fe.color.value, remb: fe.remb.checked, gmao: fe.gmao.checked });
    if (isNew) { S.tabs.push(t); S.obj.tabs.push(t.id); if (S.ses.recap.tabs) S.ses.recap.tabs.push(t.id); await save('obj'); S.ses.tab = t.id; }
    await save('tabs'); m.close(); render(); toast(isNew ? 'Onglet créé' : 'Onglet enregistré');
  };
}
async function selectTab(id) {
  const t = tabById(id);
  if (t && !tabOpen(id)) { if (!await askUnlock(t.lock, 'Déverrouiller « ' + t.name + ' »')) return false; S.ses.tabs.add(id); }
  return true;
}

/* ---------- Commande et recherche vocales ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function listen(onText, onInterim) {
  if (!SR) { toast('Commande vocale indisponible sur ce navigateur (utilisez Chrome, Edge ou Safari récent).', 4000); return null; }
  const r = new SR(); r.lang = 'fr-FR'; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
  let txt = '';
  r.onresult = e => { txt = [...e.results].map(x => x[0].transcript).join(''); onInterim && onInterim(txt); };
  r.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Micro : ' + (e.error === 'not-allowed' ? 'autorisation refusée' : e.error)); };
  r.onend = () => onText(txt.trim());
  try { r.start(); } catch { return null; }
  return r;
}
function speak(t) { try { const u = new SpeechSynthesisUtterance(t); u.lang = 'fr-FR'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {} }
function voiceCommand() {
  if (!SR) { listen(() => {}); return; }
  let rec;
  const m = modal(`<div class="voice"><div class="pulse">${ic('mic')}</div><p class="vt">Je vous écoute…</p>
    <p class="mute" style="font-size:14px">« Ajoute 18,50 € de repas chez Paul » · « Cherche hôtel » · « Total du mois » · « Scanne un ticket » · « Ouvre les dépenses perso » · « Synchronise la GMAO »</p>
    <button class="btn" data-close>Fermer</button></div>`, { onClose: () => { try { rec && rec.abort(); } catch {} } });
  rec = listen(t => { const open = m.el.isConnected; m.close(); if (t && open) handleVoice(t); }, t => { const v = $('.vt', m.el); if (v) v.textContent = '« ' + t + ' »'; });
}
function voiceSearch() {
  const b = $('[data-act=voiceSearch]'); if (b) b.classList.add('accent');
  listen(t => { if (b) b.classList.remove('accent'); if (t) { S.ses.q = t; renderList(); } });
}
async function handleVoice(t) {
  const s = norm(t);
  const findTab = () => { if (/\bperso|personnel/.test(s)) return 'perso'; const x = S.tabs.find(tb => s.includes(norm(tb.name)) || s.includes(norm(tb.name).replace(/^depenses? /, ''))); return x?.id; };
  if (/^(cherche|recherche|trouve|montre|affiche les|liste)/.test(s)) {
    const q = t.replace(/^\s*\S+\s+(moi\s+)?((les|la|le|des|l')\s*)?((dé|de)penses?\s*)?/i, '').replace(/^(de|du|d'|des|chez)\s*/i, '').trim();
    S.ses.q = q; S.ses.month = ''; S.ses.tab = 'all'; nav('list'); toast('Recherche : ' + q); return;
  }
  if (/(scanne|scanner|photographie|prends? (en )?photo|nouveau ticket)/.test(s)) { $('#inCam').click(); return; }
  if (/ticket long/.test(s)) { openLong(); return; }
  if (/(synchronise|synchro|envoie).*(gmao)|^gmao/.test(s)) { S.ses.recap.period = 'tout'; syncGmao(); return; }
  if (/(exporte|export)/.test(s)) { nav('recap'); return; }
  if (/(ajoute|nouvelle depense|enregistre|note|depense de|j'ai (paye|depense))/.test(s) && /\d/.test(s)) {
    const m = s.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)?(?:\s*(?:et\s*)?(\d{1,2})\s*(?:centimes?)?(?=\s|$))?/);
    let amount = m ? parseFloat(m[1].replace(',', '.')) : 0;
    if (m && m[2] && !/[.,]/.test(m[1]) && /(€|euro)/.test(s)) amount += +m[2] / 100;
    let merchant = ''; const mm = t.match(/\bchez\s+(.+?)(?:\s+(?:pour|dans|sur|en|hier|aujourd'hui|avant-hier|le|intervention)\b|[,.]|$)/i); if (mm) merchant = mm[1].trim();
    let date = today(); if (/avant[- ]hier/.test(s)) { const d = new Date(); d.setDate(d.getDate() - 2); date = iso(d); } else if (/\bhier\b/.test(s)) { const d = new Date(); d.setDate(d.getDate() - 1); date = iso(d); }
    const im = s.match(/(\d{4})\s*-?\s*s\s*-?\s*(\d{1,4})/); const inter = im ? `${im[1]}-S${im[2].padStart(3, '0')}` : '';
    const cat = guessCat(s.replace(/\bchez\b.*$/, '')) || guessCat(s) || '';
    const tabId = findTab() || (inter ? 'pro' : undefined);
    if (tabId && !await selectTab(tabId)) return;
    const q = s.match(/(\d+)\s*(nuits?|repas|couverts|personnes)/);
    openForm({ amount: r2(amount), merchant, date, cat, inter, qty: q ? +q[1] : 1, ...(tabId ? { tabId } : {}) });
    return;
  }
  if (/(combien|total|depense)/.test(s)) {
    const per = /aujourd|jour/.test(s) ? 'jour' : /semaine/.test(s) ? 'semaine' : /annee|an\b/.test(s) ? 'an' : 'mois';
    const tid = findTab(); const ids = tid ? (tabOpen(tid) ? [tid] : []) : S.obj.tabs.filter(tabOpen);
    const v = sum(S.exps.filter(e => ids.includes(e.tabId) && inRange(e.date, per)));
    const lbl = { jour: "aujourd'hui", semaine: 'cette semaine', mois: 'ce mois-ci', an: 'cette année' }[per];
    const msg = `${lbl.charAt(0).toUpperCase() + lbl.slice(1)} : ${eur(v)}${tid ? ' (' + tabById(tid)?.name + ')' : ''}`;
    toast(msg, 4500); speak(msg.replace('€', 'euros')); return;
  }
  {
    const views = [[/accueil|tableau de bord/, 'home'], [/recap|recapitulatif|bilan/, 'recap'], [/reglage|parametre|abonnement/, 'settings']];
    for (const [re, v] of views) if (re.test(s)) { nav(v); return; }
    const tid = findTab();
    if (tid) { if (await selectTab(tid)) { S.ses.tab = tid; nav('list'); } return; }
    if (/depenses?$/.test(s)) { nav('list'); return; }
  }
  S.ses.q = t; S.ses.tab = 'all'; nav('list'); toast('Recherche : ' + t);
}

/* ---------- GMAO ---------- */
async function syncGmao() {
  if (!hasGmao()) {
    if (await confirmBox('Option GMAO', `La synchronisation vers la GMAO est incluse dans l'option GMAO (${eur(GMAO_OPT.m)} / mois) ou le plan Business. En attendant, l'export CSV par intervention reste disponible.`, 'Voir les offres')) { nav('settings'); }
    return;
  }
  const url = (S.settings.gmaoUrl || '').trim();
  if (!url) { toast('Renseignez l’adresse de la GMAO dans Réglages › GMAO', 4000); nav('settings'); openSection('GMAO'); return; }
  const { ex, RB } = recapData();
  const gm = ex.filter(e => tabById(e.tabId)?.gmao);
  const noNum = gm.filter(e => !e.inter).length;
  const pend = gm.filter(e => e.inter && e.sync !== 'ok');
  if (!pend.length) { toast(noNum ? `${noNum} dépense(s) pro sans n° d'intervention : ajoutez-le pour les envoyer.` : 'Tout est déjà synchronisé'); return; }
  const groups = {}; pend.forEach(e => { (groups[e.inter] = groups[e.inter] || []).push(e); });
  if (!await confirmBox('Synchroniser la GMAO', `${pend.length} dépense(s) sur ${Object.keys(groups).length} intervention(s) vont être envoyées à la GMAO.${noNum ? `<br><small>${noNum} dépense(s) sans n° d'intervention ne seront pas envoyées.</small>` : ''}`, 'Envoyer')) return;
  const m = modal(`<div class="status"><span class="spin"></span>Envoi vers la GMAO…</div>`);
  try {
    const interventions = [];
    for (const [num, arr] of Object.entries(groups)) {
      const deps = [];
      for (const e of arr) {
        const r = RB.get(e.id) || {};
        const d = { id: e.id, date: e.date, commercant: e.merchant, categorie: e.cat, quantite: e.qty, montant_ttc: e.amount, tva: e.vat, remboursable: r.remb, hors_limite: r.excess, paiement: e.pay, note: e.note };
        if (S.settings.gmaoImgs && e.imgs?.[0]) { const b = await DB.get('img', e.imgs[0]).catch(() => null); if (b) d.justificatif = await toDataURL(b); }
        deps.push(d);
      }
      interventions.push({ numero: num, client: arr.find(x => x.client)?.client || '', total_ttc: sum(arr), total_remboursable: sum(arr, x => RB.get(x.id)?.remb), total_hors_limite: sum(arr, x => RB.get(x.id)?.excess), depenses: deps });
    }
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(S.settings.gmaoToken ? { Authorization: 'Bearer ' + S.settings.gmaoToken } : {}) },
      body: JSON.stringify({ source: S.settings.appName, version: 1, appareil: S.settings.deviceId, utilisateur: S.account?.email, envoye_le: new Date().toISOString(), interventions }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && !(r.status === 409 && Array.isArray(j.ignorees))) throw new Error(j.error || 'GMAO : erreur ' + r.status);
    const refus = new Map((j.ignorees || []).map(x => [x.id, x.raison]));
    const now = Date.now(); let ok = 0;
    for (const e of pend) { if (refus.has(e.id)) continue; e.sync = 'ok'; e.syncAt = now; await saveExp(e); ok++; }
    m.close(); render();
    if (refus.size) infoBox('Envoi GMAO', `<p>${ok} dépense(s) reçue(s) par la GMAO, ${refus.size} refusée(s) :</p><ul>${[...refus].map(([id, why]) => { const e = pend.find(x => x.id === id); return `<li>${esc(e ? fmtDate(e.date) + ' · ' + (e.merchant || 'Sans nom') + ' · ' + eur(e.amount) : id)} — ${esc(why)}</li>`; }).join('')}</ul>`);
    else toast(`${ok} dépense(s) envoyée(s) à la GMAO`);
  } catch (x) { m.close(); toast(x.message.includes('Failed to fetch') || x.name === 'TypeError' ? 'GMAO injoignable (adresse, connexion ou autorisation CORS)' : x.message, 4500); }
}
async function loadInter() {
  const url = (S.settings.gmaoUrl || '').trim(); if (!url) { toast('Renseignez d’abord l’adresse de la GMAO'); return; }
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'interventions=1', { headers: S.settings.gmaoToken ? { Authorization: 'Bearer ' + S.settings.gmaoToken } : {} });
    const j = await r.json(); const arr = Array.isArray(j) ? j : j.interventions || [];
    let n = 0; for (const i of arr) { const num = String(i.numero || i.num || '').toUpperCase(); if (num && !S.inter.some(x => x.num === num)) { S.inter.push({ num, client: i.client || '', label: i.libelle || i.label || '' }); n++; } }
    await save('inter'); renderSettings(); openSection('GMAO'); toast(n + ' intervention(s) ajoutée(s)');
  } catch { toast('Impossible de charger les interventions depuis la GMAO', 4000); }
}

/* ---------- Export / import ---------- */
async function download(name, blob) {
  try {
    if (navigator.canShare && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      const file = new File([blob], name, { type: blob.type });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  if (IN_FRAME && blob.size < 500000 && /text|json|csv/.test(blob.type)) {
    const txt = await blob.text();
    const m = modal(`<div class="hd"><h2>${esc(name)}</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div><p class="mute" style="font-size:14px">Dans cet aperçu, le téléchargement peut être bloqué : copiez le contenu ci-dessous.</p><textarea rows="10" readonly>${esc(txt)}</textarea><button class="btn primary" id="cpy">Copier</button>`, { wide: true });
    $('#cpy', m.el).onclick = async () => { try { await navigator.clipboard.writeText(txt); toast('Copié'); } catch { $('textarea', m.el).select(); toast('Sélectionnez puis copiez'); } };
  }
}
const csvCell = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const dec = n => String(r2(n)).replace('.', ',');
function exportCsv() {
  const { ex, RB } = recapData();
  if (!ex.length) { toast('Aucune dépense sur cette sélection'); return; }
  const head = ['Date', 'Onglet', 'Commerçant', 'Catégorie', 'Quantité', 'Montant TTC', 'TVA', 'Remboursable', 'Hors limite', 'Paiement', 'N° intervention', 'Client', 'Note', 'Synchro GMAO'];
  const rows = ex.map(e => { const r = RB.get(e.id) || {}; return [fmtDate(e.date), tabById(e.tabId)?.name, e.merchant, e.cat, e.qty, dec(e.amount), dec(e.vat), dec(r.remb), dec(r.excess), e.pay, e.inter, e.client, e.note, e.sync === 'ok' ? 'oui' : '']; });
  rows.push(['TOTAL', '', '', '', '', dec(sum(ex)), dec(sum(ex, e => e.vat)), dec(sum(ex, e => RB.get(e.id)?.remb)), dec(sum(ex, e => RB.get(e.id)?.excess))]);
  const csv = '﻿' + [head, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
  download(`notes-de-frais-${today()}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}
async function exportJson() {
  const withImg = await new Promise(res => {
    let v = null;
    const m = modal(`<div class="hd"><h2>Sauvegarde complète</h2></div><p>Inclure les photos des justificatifs ? Le fichier sera plus lourd.</p>
      <div class="row end"><button class="btn" data-close>Annuler</button><button class="btn" id="wo">Sans les photos</button><button class="btn primary" id="wi">Avec les photos</button></div>`, { onClose: () => res(v) });
    $('#wo', m.el).onclick = () => { v = false; m.close(); }; $('#wi', m.el).onclick = () => { v = true; m.close(); };
  });
  if (withImg === null) return;
  const imgs = {};
  if (withImg) for (const e of S.exps) for (const id of e.imgs || []) { const b = await DB.get('img', id).catch(() => null); if (b) imgs[id] = await toDataURL(b); }
  const st = { ...S.settings, apiKey: '', gmaoToken: '' };
  const data = { app: 'FraisPilot', version: 1, exportedAt: new Date().toISOString(), settings: st, tabs: S.tabs, rules: S.rules, obj: S.obj, inter: S.inter, exps: S.exps, imgs };
  download(`sauvegarde-${S.settings.appName.toLowerCase().replace(/\W+/g, '-')}-${today()}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
}
function exportPdf() {
  const { R, ex, RB } = recapData();
  if (!ex.length) { toast('Aucune dépense sur cette sélection'); return; }
  const tot = sum(ex), rb = sum(ex, e => RB.get(e.id)?.remb), xs = sum(ex, e => RB.get(e.id)?.excess);
  $('#print').innerHTML = `<h1>${esc(S.settings.appName)} — Note de frais</h1>
    <p>${esc(PERIODS[R.period])}${R.period === 'perso' ? ` du ${fmtDate(R.from)} au ${fmtDate(R.to)}` : ''} · ${esc(R.tabs.filter(tabOpen).map(id => tabById(id)?.name).join(', '))}${R.inter ? ' · intervention ' + esc(R.inter) : ''} · édité le ${fmtDate(today())} · ${esc(S.account?.email)}</p>
    <p style="margin:10px 0"><b>Total : ${eur(tot)}</b> · Remboursable : <b>${eur(rb)}</b> · Hors limite (non remboursé) : <b class="ex">${eur(xs)}</b></p>
    <table><thead><tr><th>Date</th><th>Commerçant</th><th>Catégorie</th><th>Interv.</th><th class="n">TTC</th><th class="n">TVA</th><th class="n">Remb.</th><th class="n">Hors limite</th></tr></thead><tbody>
    ${ex.map(e => { const r = RB.get(e.id) || {}; return `<tr><td>${fmtDate(e.date)}</td><td>${esc(e.merchant)}</td><td>${esc(e.cat)}${e.qty > 1 ? ' ×' + e.qty : ''}</td><td>${esc(e.inter)}</td><td class="n">${eur(e.amount)}</td><td class="n">${eur(e.vat)}</td><td class="n">${eur(r.remb)}</td><td class="n ${r.excess ? 'ex' : ''}">${r.excess ? eur(r.excess) : ''}</td></tr>`; }).join('')}
    <tr class="tot"><td colspan="4">Total</td><td class="n">${eur(tot)}</td><td class="n">${eur(sum(ex, e => e.vat))}</td><td class="n">${eur(rb)}</td><td class="n ex">${eur(xs)}</td></tr></tbody></table>
    <p style="margin-top:28px">Plafonds appliqués : ${esc(S.rules.map(ruleText).join(' · ') || 'aucun')}</p>
    <p style="margin-top:40px">Signature du salarié : ____________________ &nbsp;&nbsp; Visa du responsable : ____________________</p>`;
  if (IN_FRAME) { toast('L’impression est bloquée dans cet aperçu : elle fonctionne dans l’appli installée.', 4500); return; }
  window.print();
}
function parseCsv(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
async function importData(file) {
  const text = (await file.text()).replace(/^﻿/, '');
  if (/\.json$/i.test(file.name) || text.trim().startsWith('{')) {
    let d; try { d = JSON.parse(text); } catch { toast('Fichier de sauvegarde illisible'); return; }
    if (!Array.isArray(d.exps)) { toast('Ce fichier n’est pas une sauvegarde FraisPilot'); return; }
    if (!await confirmBox('Importer la sauvegarde', `${d.exps.length} dépenses, ${d.tabs?.length || 0} onglets. Les dépenses existantes sont conservées ; les doublons sont remplacés.`, 'Importer')) return;
    for (const t of d.tabs || []) if (!tabById(t.id)) S.tabs.push(t);
    for (const r of d.rules || []) if (!S.rules.some(x => x.id === r.id)) S.rules.push(r);
    for (const i of d.inter || []) if (!S.inter.some(x => x.num === i.num)) S.inter.push(i);
    for (const [id, du] of Object.entries(d.imgs || {})) { const b = await (await fetch(du)).blob(); await DB.set('img', id, b).catch(() => {}); }
    for (const e of d.exps) { const i = S.exps.findIndex(x => x.id === e.id); if (i >= 0) S.exps[i] = e; else S.exps.push(e); await saveExp(e); }
    await Promise.all([save('tabs'), save('rules'), save('inter')]); render(); toast(d.exps.length + ' dépenses importées'); return;
  }
  const rows = parseCsv(text); if (rows.length < 2) { toast('CSV vide'); return; }
  const h = rows[0].map(norm), col = (...k) => h.findIndex(x => k.some(y => x.includes(y)));
  const C = { date: col('date'), m: col('commercant', 'fournisseur', 'libelle', 'marchand'), cat: col('categorie'), amt: col('montant', 'ttc', 'total'), vat: col('tva'), tab: col('onglet'), inter: col('intervention'), client: col('client'), note: col('note', 'commentaire') };
  if (C.amt < 0 || C.date < 0) { toast('Colonnes « date » et « montant » introuvables'); return; }
  const lignes = [];
  for (const r of rows.slice(1)) {
    const amt = r2(num(r[C.amt])); if (!(amt > 0) || /total/i.test(r[0])) continue;
    const tn = C.tab >= 0 ? norm(r[C.tab]) : '', t = S.tabs.find(x => tn && (norm(x.name) === tn || norm(x.name).includes(tn))) || tabById(S.ses.tab) || S.tabs[0];
    const e = { id: uid(), tabId: t.id, date: normDate(r[C.date]), merchant: C.m >= 0 ? r[C.m].trim() : '', amount: amt, vat: C.vat >= 0 ? r2(num(r[C.vat])) : 0, cat: C.cat >= 0 && CATS.includes(r[C.cat].trim()) ? r[C.cat].trim() : (guessCat((C.cat >= 0 ? r[C.cat] : '') + ' ' + (C.m >= 0 ? r[C.m] : '')) || 'Autre'),
      qty: 1, pay: '', note: C.note >= 0 ? r[C.note] : '', inter: C.inter >= 0 ? r[C.inter].trim().toUpperCase() : '', client: C.client >= 0 ? r[C.client] : '', imgs: [], createdAt: Date.now() + lignes.length };
    lignes.push(e);
  }
  const dupIds = new Set(lignes.filter((e, i) => findDup(e) || findDup(e, lignes.slice(0, i))).map(e => e.id));
  let keep = lignes;
  if (dupIds.size) {
    const choix = await new Promise(res => {
      let v = null;
      const m = modal(`<div class="hd"><h2>Dépenses déjà saisies ?</h2></div><p>${dupIds.size} ligne(s) sur ${lignes.length} ont la même date, le même montant et le même commerçant qu'une dépense existante.</p>
        <div class="row end"><button class="btn" data-close>Annuler</button><button class="btn" id="dAll">Tout importer</button><button class="btn primary" id="dNew">Seulement les nouvelles</button></div>`, { onClose: () => res(v) });
      $('#dAll', m.el).onclick = () => { v = 'all'; m.close(); }; $('#dNew', m.el).onclick = () => { v = 'new'; m.close(); };
    });
    if (!choix) return;
    if (choix === 'new') keep = lignes.filter(e => !dupIds.has(e.id));
    else keep.forEach(e => { if (dupIds.has(e.id)) e.dupSuspect = true; });
  }
  for (const e of keep) { S.exps.push(e); await saveExp(e); }
  render(); toast(keep.length + ' dépenses importées depuis le CSV' + (lignes.length - keep.length ? ` (${lignes.length - keep.length} doublon(s) écarté(s))` : ''));
}

/* ---------- Actions ---------- */
const ACT = {
  add: () => openAdd(),
  voice: () => voiceCommand(),
  voiceSearch: () => voiceSearch(),
  lockNow: () => showLock(),
  forgot: () => renderForgot(),
  backLogin: () => renderLogin(),
  copyRec: async () => { try { await navigator.clipboard.writeText($('#recC').textContent); toast('Code copié'); } catch { toast('Copie impossible : notez le code'); } },
  recSend: async b => {
    if (!proxy()) { toast('L’envoi par mail nécessite le serveur relais (non configuré). Utilisez le code de secours.', 5000); return; }
    b.disabled = true;
    try { const r = await fetch(proxy() + '/recover/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: S.account.email, deviceId: S.settings.deviceId, app: S.settings.appName }) });
      if (!r.ok) throw 0; $('#mailF').hidden = false; toast('Code envoyé par mail (valable 15 minutes)'); }
    catch { toast('Envoi impossible pour le moment'); b.disabled = false; }
  },
  homeTab: async b => {
    const id = b.dataset.id; if (!await selectTab(id)) return;
    const o = S.obj.tabs; if (o.includes(id) && tabOpen(id) && b.classList.contains('on')) S.obj.tabs = o.filter(x => x !== id); else if (!o.includes(id)) o.push(id);
    await save('obj'); renderHome();
  },
  tab: async b => { const id = b.dataset.id; if (id !== 'all' && !await selectTab(id)) return; S.ses.tab = id; S.ses.month = ''; renderList(); },
  unlockTab: async b => { if (await selectTab(b.dataset.id)) renderList(); },
  recTab: async b => { const id = b.dataset.id; if (!await selectTab(id)) return; const R = S.ses.recap; if (!R.tabs) R.tabs = []; if (R.tabs.includes(id) && b.classList.contains('on')) R.tabs = R.tabs.filter(x => x !== id); else if (!R.tabs.includes(id)) R.tabs.push(id); renderRecap(); },
  newTab: () => editTab(null),
  editTab: async b => { const id = b.dataset.id, t = tabById(id); if (t?.lock && !tabOpen(id) && !await selectTab(id)) return; editTab(id); },
  edit: async b => { const e = S.exps.find(x => x.id === b.dataset.id); if (e && await selectTab(e.tabId)) openForm(e); },
  plans: () => { $$('.modal').forEach(m => m.remove()); nav('settings'); openSection('Abonnement'); },
  buy: b => buy(b.dataset.id),
  accent: async b => { S.settings.accent = b.dataset.c; await save('settings'); applyTheme(); renderSettings(); openSection('Apparence'); },
  addRule: async () => { S.rules.push({ id: uid(), cat: 'Repas', per: 'jour', limit: 0, tabs: S.tabs.filter(t => t.remb).map(t => t.id) }); await save('rules'); renderSettings(); openSection('Plafonds'); },
  delRule: async b => { S.rules = S.rules.filter(r => r.id !== b.dataset.id); await save('rules'); renderSettings(); openSection('Plafonds'); },
  delInter: async b => { S.inter.splice(+b.dataset.i, 1); await save('inter'); renderSettings(); openSection('GMAO'); },
  loadInter: () => loadInter(),
  syncGmao: () => syncGmao(),
  expCsv: () => exportCsv(), expJson: () => exportJson(), expPdf: () => exportPdf(),
  importData: () => $('#inData').click(),
  install: async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; render(); },
  installHelp: () => infoBox('Installer l’application', installHelp()),
  testOcr: async () => {
    if (proxy()) { try { const r = await fetch(proxy() + '/health'); const j = await r.json(); toast(r.ok ? `Serveur relais OK · Mistral ${j.mistral ? 'configuré' : 'non configuré'}` : 'Serveur relais : erreur ' + r.status, 4000); } catch { toast('Serveur relais injoignable', 4000); } return; }
    if (S.settings.apiKey) { try { const r = await fetch(MISTRAL.base + '/models', { headers: { Authorization: 'Bearer ' + S.settings.apiKey.trim() } }); toast(r.ok ? 'Clé Mistral valide' : 'Clé refusée par Mistral (' + r.status + ')', 4000); } catch { toast('Mistral injoignable depuis ce navigateur', 4000); } return; }
    toast('Renseignez un serveur relais ou une clé Mistral');
  },
  changeSecret: async () => {
    if (!await askUnlock(S.account.lock, 'Code actuel')) return;
    const m = modal(`<div class="hd"><h2>Nouvel accès</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div><form id="csF" style="display:grid;gap:14px">${methodSeg(S.account.lock.method)}<button class="btn primary big">Enregistrer</button></form>`);
    const f = $('#csF', m.el); bindSecretForm(f);
    f.onsubmit = async e => { e.preventDefault(); const s = readSecretForm(f); if (!s) return; S.account.lock = await makeLock(s.method, s.secret); await save('account'); m.close(); renderSettings(); toast('Accès modifié'); };
  },
  changeEmail: async () => {
    if (!await askUnlock(S.account.lock, 'Code actuel')) return;
    const m = modal(`<div class="hd"><h2>Adresse de récupération</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div><form id="ceF" style="display:grid;gap:14px"><input type="email" name="em" required value="${esc(S.account.email)}"><button class="btn primary">Enregistrer</button></form>`);
    $('#ceF', m.el).onsubmit = async e => { e.preventDefault(); S.account.email = e.target.em.value.trim(); await save('account'); m.close(); renderSettings(); toast('Adresse enregistrée'); };
  },
  newRec: async () => {
    if (!await askUnlock(S.account.lock, 'Code actuel')) return;
    const code = recoveryCode(); S.account.rec = await makeLock('code', cleanCode(code)); await save('account');
    infoBox('Nouveau code de secours', `<div class="code">${esc(code)}</div><p class="mute">L'ancien code ne fonctionne plus. Notez celui-ci ou envoyez-le à ${esc(S.account.email)}.</p><a class="btn" href="mailto:${encodeURIComponent(S.account.email)}?subject=${encodeURIComponent('Code de secours ' + S.settings.appName)}&body=${encodeURIComponent('Code de secours : ' + code)}">S'envoyer par mail</a>`);
  },
  wipe: async () => {
    if (!await confirmBox('Tout effacer ?', 'Toutes les dépenses, photos, onglets et réglages de cet appareil seront supprimés définitivement. Faites une sauvegarde avant.', 'Tout effacer', true)) return;
    if (!await askUnlock(S.account.lock, 'Confirmez avec votre code')) return;
    await Promise.all(['kv', 'exp', 'img'].map(s => DB.clear(s).catch(() => {})));
    location.reload();
  }
};
document.addEventListener('click', e => {
  const n = e.target.closest('[data-nav]'); if (n && !e.target.closest('.modal')) { nav(n.dataset.nav); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const f = ACT[b.dataset.act]; if (f) { e.preventDefault(); f(b, e); }
});
/* Champs de réglages enregistrés automatiquement (data-k="objet.clé") */
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.k) {
    const [obj, key] = el.dataset.k.split('.');
    let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Math.max(0, +el.value || 0) : el.value;
    if (key === 'appName') v = String(v).trim() || 'FraisPilot';
    S[obj][key] = v; await save(obj);
    if (['accent', 'theme', 'appName'].includes(key)) applyTheme();
    renderChrome();
    if (['billing', 'gmaoOpt'].includes(key)) { if (key === 'gmaoOpt' && v) { S[obj][key] = false; await save(obj); buyGmao(); return; } renderSettings(); openSection('Abonnement'); }
    return;
  }
  if (el.dataset.rule) {
    const r = S.rules.find(x => x.id === el.dataset.rule); if (!r) return;
    const fld = el.dataset.f;
    if (fld === 'tab') { r.tabs = $$(`[data-rule="${r.id}"][data-f=tab]`).filter(x => x.checked).map(x => x.value); }
    else r[fld] = fld === 'limit' ? r2(Math.max(0, num(el.value))) : el.value;
    await save('rules'); toast('Plafond enregistré', 1500);
  }
});
async function buyGmao() {
  if (await confirmBox('Option GMAO', `Ajouter l'option de synchronisation GMAO pour ${eur(GMAO_OPT[S.settings.billing === 'annuel' ? 'y' : 'm'])} ${S.settings.billing === 'annuel' ? 'par an' : 'par mois'} ? Aucun paiement n'est branché : activation en démonstration.`, 'Activer (démo)')) {
    S.settings.gmaoOpt = true; S.settings.planDemo = true; await save('settings'); toast('Option GMAO activée (démo)');
  }
  renderSettings(); openSection('Abonnement');
}

/* Fichiers choisis */
$('#inCam').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const b = await compress(f); openForm({}, { blobs: [b], auto: true }); };
$('#inLong').onchange = async e => { const fs = [...e.target.files]; e.target.value = ''; await onLongFiles(fs); };
$('#inLongGal').onchange = async e => { const fs = [...e.target.files]; e.target.value = ''; await onLongFiles(fs); };
$('#inFiles').onchange = async e => { const fs = [...e.target.files]; e.target.value = ''; await onFiles(fs); };
$('#inData').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) await importData(f); };

/* Verrouillage automatique en arrière-plan */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { S.ses.hiddenAt = Date.now(); return; }
  const min = +S.settings?.autoLockMin || 0;
  if (S.ses.unlocked && min > 0 && S.ses.hiddenAt && Date.now() - S.ses.hiddenAt > min * 60000) showLock();
});

/* ---------- Démarrage ---------- */
(async () => {
  await DB.open();
  const d = DEF();
  for (const k of KEYS) { const v = await DB.get('kv', k).catch(() => undefined); S[k] = v ?? d[k]; }
  S.settings = { ...d.settings, ...S.settings };
  S.exps = (await DB.all('exp').catch(() => [])) || [];
  await save('settings');
  applyTheme(); showLock();
  if ('serviceWorker' in navigator && !IN_FRAME && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
}
