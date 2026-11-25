/* FraisPilot — notes de frais (PWA)
   Données stockées sur l'appareil (IndexedDB). Lecture auto des tickets (OCR),
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
  { id: 'business', name: 'Business', scans: 1000, m: 11.99, y: 119.99, gmao: true, org: true, perks: ['1 000 scans / mois', 'Option GMAO incluse', 'Configuration d’organisation diffusée sur toute la flotte', 'Support prioritaire'] }
];
/* Administrateur principal : accès total (toutes les options, scans illimités côté appli). */
const OWNER_PLAN = { id: 'owner', name: 'Administrateur', scans: Infinity, m: 0, y: 0, gmao: true, org: true, perks: [] };
const OWNER_LOCK = { method: 'password', salt: 'yYWk2C2fAG+mDhbsCsPFjg==', hash: '1Lxw3Vy/Nubm/Xijd+gMi2iatNrlo9+uOYqqgFc/QUs=' };
const scansLbl = (p = plan()) => p.scans === Infinity ? 'illimités' : String(p.scans);
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
  obj: { periods: ['mois'], tabs: ['pro'], cumul: false },
  budgets: [],
  quota: { month: today().slice(0, 7), used: 0 },
  inter: [],
  org: null
});
const KEYS = ['settings', 'account', 'tabs', 'rules', 'obj', 'budgets', 'quota', 'inter', 'org'];
const S = { exps: [], ses: { unlocked: false, tabs: new Set(), view: 'home', tab: 'pro', q: '', month: '', hiddenAt: 0,
  recap: { period: 'mois', from: '', to: '', tabs: null, inter: '' } } };
const save = k => { if (SYNC_KEYS.includes(k) || k === 'settings') syncSoon(); return DB.set('kv', k, S[k]).catch(() => {}); };
const saveExp = e => { e.updatedAt = Date.now(); if (SY?.dead?.[e.id]) delete SY.dead[e.id]; syncSoon(); return DB.set('exp', e.id, e).catch(() => {}); };
const tabById = id => S.tabs.find(t => t.id === id);
const tabOpen = id => { const t = tabById(id); return !!t && (!t.lock || S.ses.tabs.has(id)); };
const openTabs = () => S.tabs.filter(t => tabOpen(t.id));
const plan = () => S.settings.owner ? OWNER_PLAN : (PLANS.find(p => p.id === S.settings.plan) || PLANS[0]);
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
async function hashSecret(secret, saltB64, it = 150000) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: it, hash: 'SHA-256' }, key, 256);
  return { salt: b64(salt), hash: b64(bits) };
}
const makeLock = async (method, secret, it) => ({ method, ...(await hashSecret(secret, null, it)), ...(it ? { it } : {}) });
const checkLock = async (secret, lock) => !lock || (await hashSecret(secret, lock.salt, lock.it || 150000)).hash === lock.hash;
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
  S.ses.unlocked = false; S.ses.tabs.clear(); S.ses.admin = null; S.ses.orgCode = '';
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
/* Service de lecture commun à tous les appareils : renseigné une fois ici (ou par l'admin / l'organisation). */
const DEFAULT_PROXY = 'https://fraispilot-api.ssti92350.workers.dev';
const proxy = () => (S.settings.proxyUrl || DEFAULT_PROXY).trim().replace(/\/+$/, '');

function enterApp() {
  S.ses.unlocked = true; L().hidden = true; L().innerHTML = ''; $('#app').hidden = false;
  if (!tabOpen(S.ses.tab) && S.ses.tab !== 'all') S.ses.tab = openTabs()[0]?.id || 'all';
  renderAll();
  const p = new URLSearchParams(location.search);
  if (p.get('action') === 'scan') { history.replaceState(null, '', location.pathname); setTimeout(() => $('#inCam').click(), 300); }
  if (p.get('action') === 'add') { history.replaceState(null, '', location.pathname); openAdd(); }
  if (p.get('org')) { const u = p.get('org'); history.replaceState(null, '', location.pathname); joinOrgUrl(u); }
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('sync')) { const c = h.get('sync'); history.replaceState(null, '', location.pathname + location.search); setTimeout(() => joinSyncLink(c), 400); }
  if (h.get('gmao') && h.get('jeton')) { history.replaceState(null, '', location.pathname + location.search); lierGmao(h.get('gmao'), h.get('jeton')); }
  setTimeout(processPending, 800);
}
/* Liaison en un geste depuis la GMAO : lien …/#gmao=<adresse>&jeton=<fp_…> (le fragment n'est jamais envoyé au serveur). */
async function lierGmao(adresse, jeton) {
  let u; try { u = new URL(adresse); } catch { toast('Lien de liaison invalide'); return; }
  if (u.protocol !== 'https:' || !/^fp_[A-Za-z0-9_-]{20,100}$/.test(jeton)) { toast('Lien de liaison invalide'); return; }
  if (!await confirmBox('Relier cet appareil à la GMAO ?', `Les dépenses pro seront envoyées à <b>${esc(u.host)}</b> avec le jeton de cet appareil.`, 'Relier')) return;
  S.settings.gmaoUrl = u.href; S.settings.gmaoToken = jeton; await save('settings');
  toast('Appareil relié à la GMAO'); render();
  try { await loadInter(); } catch {}
  processPending();
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
  $('#brandMk').innerHTML = S.org?.logo ? `<img src="${esc(S.org.logo)}" alt="">` : ic('receipt');
  $('#bSet').innerHTML = ic('settings');
  $('#bVoice').innerHTML = ic('mic'); $('#bLock').innerHTML = ic('lock');
  $('#nHome').innerHTML = ic('home') + 'Accueil'; $('#nList').innerHTML = ic('list') + 'Dépenses';
  $('#nFab').innerHTML = ic('plus'); $('#nRecap').innerHTML = ic('chart') + 'Récap'; $('#nSet').innerHTML = ic('settings') + 'Réglages';
  const np = $('#netPill'); if (np) np.hidden = navigator.onLine;
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
/* Accueil : seules les périodes et les onglets choisis sont affichés ; le cumul des onglets est un choix explicite. */
const HOME_PER = [['jour', "Aujourd'hui"], ['semaine', 'Cette semaine'], ['mois', 'Ce mois-ci'], ['an', 'Cette année'], ['tout', 'Total']];
const BUDGET_PER = { jour: 'jour', mois: 'mois', an: 'an' };
const PER_LBL = { jour: 'du jour', mois: 'mensuel', an: 'annuel' };
const budgetFor = (tabId, cat, per) => S.budgets.find(b => b.tabId === tabId && (b.cat || '') === (cat || '') && b.per === per && b.amount > 0);
function budgetLine(v, b) {
  const p = Math.round(v / b.amount * 100);
  return `<div class="bar ${p > 100 ? 'over' : ''}"><i style="width:${Math.min(100, p)}%"></i></div><div class="o">${p} % du budget ${PER_LBL[b.per]} (${eur(b.amount)})${p > 100 ? ` · dépassé de ${eur(v - b.amount)}` : ''}</div>`;
}
function statsHtml(list, tabId) {
  const n = new Date(), dim = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
  return `<div class="pgrid">${HOME_PER.filter(([k]) => S.obj.periods.includes(k)).map(([k, lbl]) => {
    const v = sum(list.filter(e => inRange(e.date, k)));
    const b = tabId && BUDGET_PER[k] ? budgetFor(tabId, '', BUDGET_PER[k]) : null;
    const extra = b ? budgetLine(v, b) : k === 'mois' && v ? `<div class="o">À ce rythme : ${eur(v / n.getDate() * dim)} fin de mois</div>` : '';
    return `<div class="pstat"><div class="k">${lbl}</div><div class="v">${eur(v)}</div>${extra}</div>`;
  }).join('')}</div>`;
}
function catBudgetsHtml(list, tabId) {
  const rows = S.budgets.filter(b => b.tabId === tabId && b.cat && b.amount > 0 && S.obj.periods.includes(b.per));
  if (!rows.length) return '';
  return `<div class="cb">${rows.map(b => { const v = sum(list.filter(e => e.cat === b.cat && inRange(e.date, b.per))); return `<div class="cbrow"><span>${esc(b.cat)} <small>${esc(PER[b.per])}</small></span><b>${eur(v)} / ${eur(b.amount)}</b>${budgetLine(v, b)}</div>`; }).join('')}</div>`;
}
function renderHome() {
  const sel = S.obj.tabs.filter(id => tabOpen(id)), periods = S.obj.periods;
  const RB = computeReimb(), t = today();
  const q = quotaNow(), p = plan();
  const cfg = `<div class="card homecfg">
    <small>Périodes affichées</small>
    <div class="chips">${HOME_PER.map(([k, lbl]) => `<button class="chip ${periods.includes(k) ? 'on' : ''}" data-act="homePer" data-id="${k}">${lbl}</button>`).join('')}</div>
    <small>Onglets affichés</small>
    <div class="chips">${S.tabs.map(tb => { const open = tabOpen(tb.id), on = open && S.obj.tabs.includes(tb.id);
      return `<button class="chip ${on ? 'on' : ''}" data-act="homeTab" data-id="${esc(tb.id)}">${open ? `<span class="dot" style="background:${esc(tb.color)}"></span>` : ic('lock', 's')}${esc(tb.name)}</button>`; }).join('')}
      <button class="chip ${S.obj.cumul ? 'on warnchip' : ''}" data-act="homeCumul">${ic('chart', 's')}Cumuler les onglets</button></div>
  </div>`;
  if (!sel.length || !periods.length) {
    $('#v-home').innerHTML = cfg + `<div class="card empty">${ic('target')}<p>Choisissez au moins une période et un onglet à afficher.</p></div>` + orgBackupCard() + installCard();
    return;
  }
  const cards = [];
  if (S.obj.cumul && sel.length > 1) {
    const all = S.exps.filter(e => sel.includes(e.tabId));
    cards.push(`<div class="card tabcard acc"><div class="tch"><h3>Cumul : ${esc(sel.map(id => tabById(id).name).join(' + '))}</h3></div>
      <p class="warnline">${ic('target', 's')}Total indicatif : il additionne des dépenses de nature différente (remboursables ou non).</p>${statsHtml(all, null)}</div>`);
  }
  sel.forEach((id, i) => {
    const tb = tabById(id), list = S.exps.filter(e => e.tabId === id);
    const mo = list.filter(e => e.date.slice(0, 7) === t.slice(0, 7));
    const rm = sum(mo, e => RB.get(e.id)?.remb), xm = sum(mo, e => RB.get(e.id)?.excess);
    cards.push(`<div class="card tabcard ${!cards.length && i === 0 ? 'acc' : ''}">
      <div class="tch"><span class="dot" style="background:${esc(tb.color)}"></span><h3>${esc(tb.name)}</h3>
        <button class="btn sm" data-act="budget" data-id="${esc(id)}">${ic('target', 's')}Budget</button></div>
      ${statsHtml(list, id)}${catBudgetsHtml(list, id)}
      ${tb.remb && periods.includes('mois') && mo.length ? `<div class="rline">Remboursable ce mois : <b>${eur(rm)}</b>${xm > 0 ? ` · hors limite : <b class="ex">${eur(xm)}</b>` : ''}</div>` : ''}
    </div>`);
  });
  const recent = S.exps.filter(e => sel.includes(e.tabId)).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
  $('#v-home').innerHTML = cfg + cards.join('') + orgBackupCard() + `
    <div class="card"><div class="row"><h3 class="grow" style="margin:0">Dernières dépenses</h3><button class="btn ghost" data-nav="list">Tout voir</button></div>
      <div class="list" style="margin-top:10px">${recent.length ? recent.map(e => itemHtml(e, RB)).join('') : emptyHtml()}</div></div>
    <div class="card"><div class="row"><div class="grow"><h3 style="margin:0">Scans automatiques</h3><small>${q.used} utilisé${q.used > 1 ? 's' : ''} sur ${scansLbl(p)} ce mois · ${esc(p.name)}</small></div>
      ${!['business', 'owner'].includes(p.id) ? `<button class="btn accent" data-act="plans">${ic('crown', 's')}Plus de scans</button>` : ''}</div>
      ${p.scans !== Infinity ? `<div class="bar" style="margin-top:12px;color:var(--ink)"><i style="width:${Math.min(100, q.used / p.scans * 100)}%"></i></div>` : ''}</div>
    ${installCard()}`;
  loadThumbs($('#v-home'));
}
function emptyHtml() { return `<div class="empty">${ic('receipt')}<p>Aucune dépense pour l'instant.</p><button class="btn accent" data-act="add">${ic('camera', 's')}Scanner un ticket</button></div>`; }
function itemHtml(e, RB) {
  const t = tabById(e.tabId), r = RB.get(e.id) || {};
  const tags = [];
  if (r.excess > 0) tags.push(`<span class="pill red">${eur(r.excess)} hors limite</span>`);
  if (e.check) tags.push('<span class="pill amb">À vérifier</span>');
  if (e.ocrPending) tags.push('<span class="pill">Lecture en attente</span>');
  if (e.dupSuspect) tags.push('<span class="pill red">Doublon possible</span>');
  if (t?.gmao && (e.inter || e.client)) tags.push(`<span class="pill ${e.sync === 'ok' ? 'grn' : ''}">${e.sync === 'ok' ? ic('check', 's') : ''}${esc(e.inter || e.client)}</span>`);
  if (S.ses.tab === 'all' && t) tags.push(`<span class="pill">${esc(t.name)}</span>`);
  return `<button class="item" data-act="edit" data-id="${esc(e.id)}">
    <span class="thumb" ${e.imgs?.length ? `data-thumb="${esc(e.imgs[0])}"` : ''}>${ic(e.pdf ? 'file' : 'receipt')}</span>
    <span><b>${esc(e.merchant || 'Sans nom')}</b><small>${esc(e.cat || 'Autre')} · ${fmtDate(e.date)}${e.client && !(t?.gmao) ? ' · ' + esc(e.client) : ''}</small>${tags.length ? `<span class="tags">${tags.join('')}</span>` : ''}</span>
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
  const years = [...new Set(ex.map(e => e.date.slice(0, 4)))].sort().reverse();
  const P = S.ses.month || 'tout';
  if (P.startsWith('m:')) ex = ex.filter(e => e.date.startsWith(P.slice(2)));
  else if (P.startsWith('y:')) ex = ex.filter(e => e.date.startsWith(P.slice(2)));
  else if (P === 'hier') { const d = new Date(); d.setDate(d.getDate() - 1); const h = iso(d); ex = ex.filter(e => e.date === h); }
  else if (P === 'semprec') { const n = new Date(), mon = new Date(n); mon.setDate(n.getDate() - (n.getDay() + 6) % 7 - 7); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); const a = iso(mon), b = iso(sun); ex = ex.filter(e => e.date >= a && e.date <= b); }
  else if (P === 'anprec') { const y = String(new Date().getFullYear() - 1); ex = ex.filter(e => e.date.startsWith(y)); }
  else if (P !== 'tout') ex = ex.filter(e => inRange(e.date, P, S.ses.from, S.ses.to));
  const opt = (v, l) => `<option value="${v}" ${P === v ? 'selected' : ''}>${l}</option>`;
  const q = norm(S.ses.q).trim();
  if (q) ex = ex.filter(e => norm([e.merchant, e.cat, e.note, e.inter, e.client, e.pay, String(e.amount).replace('.', ','), fmtDate(e.date)].join(' ')).includes(q));
  ex.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const RB = computeReimb();
  const groups = {}; ex.forEach(e => { (groups[e.date] = groups[e.date] || []).push(e); });
  const tot = sum(ex), rb = sum(ex, e => RB.get(e.id)?.remb), xs = sum(ex, e => RB.get(e.id)?.excess);
  $('#v-list').innerHTML = strip + `
    <div class="tools">
      <div class="search">${ic('search')}<input id="q" type="search" placeholder="Rechercher : commerçant, client, montant…" value="${esc(S.ses.q)}" aria-label="Rechercher"><button class="btn icon" data-act="voiceSearch" aria-label="Recherche vocale">${ic('mic')}</button></div>
      <select id="mSel" aria-label="Période" style="width:auto">
        ${opt('tout', 'Toutes les dates')}
        <optgroup label="Jour">${opt('jour', "Aujourd'hui")}${opt('hier', 'Hier')}</optgroup>
        <optgroup label="Semaine">${opt('semaine', 'Cette semaine')}${opt('semprec', 'Semaine dernière')}</optgroup>
        <optgroup label="Mois">${opt('mois', 'Ce mois-ci')}${opt('moisprec', 'Mois dernier')}${months.map(m => opt('m:' + m, monthLabel(m).replace(/^./, c => c.toUpperCase()))).join('')}</optgroup>
        <optgroup label="Année">${opt('an', 'Cette année')}${opt('anprec', 'Année dernière')}${years.map(y => opt('y:' + y, 'Année ' + y)).join('')}</optgroup>
        ${opt('perso', 'Du … au … (choisir les dates)')}
      </select>
    </div>
    ${P === 'perso' ? `<div class="grid2"><label class="f">Du<input type="date" id="pFrom" value="${esc(S.ses.from || '')}"></label><label class="f">Au<input type="date" id="pTo" value="${esc(S.ses.to || '')}"></label></div>` : ''}
    <div class="row" style="font-size:14px"><span class="pill">${ex.length} dépense${ex.length > 1 ? 's' : ''}</span><span class="pill">Total ${eur(tot)}</span>${rb ? `<span class="pill grn">Remb. ${eur(rb)}</span>` : ''}${xs ? `<span class="pill red">Hors limite ${eur(xs)}</span>` : ''}
      ${t && t.id !== 'all' ? `<button class="btn ghost" data-act="budget" data-id="${esc(t.id)}" style="margin-left:auto">${ic('target', 's')}Budget</button><button class="btn ghost" data-act="editTab" data-id="${esc(t.id)}">${ic('pen', 's')}Onglet</button>` : ''}</div>
    <div class="list">${ex.length ? Object.entries(groups).map(([d, arr]) => `<div class="day">${new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${eur(sum(arr))}</div>${arr.map(e => itemHtml(e, RB)).join('')}`).join('') : (q ? `<div class="empty">${ic('search')}<p>Aucun résultat pour « ${esc(S.ses.q)} ».</p></div>` : emptyHtml())}</div>`;
  const qi = $('#q'); qi.oninput = () => { S.ses.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { const pos = qi.selectionStart; renderList(); const n = $('#q'); n.focus(); try { n.setSelectionRange(pos, pos); } catch {} }, 250); };
  $('#mSel').onchange = e => { S.ses.month = e.target.value; renderList(); };
  const pf = $('#pFrom'), pt = $('#pTo');
  if (pf) { pf.onchange = () => { S.ses.from = pf.value; renderList(); }; pt.onchange = () => { S.ses.to = pt.value; renderList(); }; }
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
  ex.filter(e => tabById(e.tabId)?.gmao).forEach(e => { const k = e.inter || e.client || '— sans client —', o = byInter[k] = byInter[k] || { n: 0, t: 0, r: 0, c: e.client || '', ok: 0 }; o.n++; o.t += +e.amount || 0; o.r += RB.get(e.id)?.remb || 0; if (e.sync === 'ok') o.ok++; });
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
    ${Object.keys(byInter).length ? `<div class="card"><h3>Par intervention ou client (GMAO)</h3><div class="scroll"><table><thead><tr><th>N° / client</th><th>Client</th><th class="n">Nb</th><th class="n">Total</th><th class="n">Remb.</th><th>Synchro</th></tr></thead><tbody>
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
    ${st.owner ? `<div class="status ok">${ic('crown', 's')}Administrateur principal : toutes les options sont actives, sans abonnement.</div>` : ''}
    <div class="seg" style="max-width:340px"><label><input type="radio" name="bill" value="mensuel" ${bill === 'm' ? 'checked' : ''} data-k="settings.billing">Mensuel</label><label><input type="radio" name="bill" value="annuel" ${bill === 'y' ? 'checked' : ''} data-k="settings.billing">Annuel (2 mois offerts)</label></div>
    <div class="plans">${PLANS.map(pl => `<div class="plan ${pl.id === p.id ? 'cur' : ''}"><h3 style="margin:0">${esc(pl.name)}</h3>
      <div class="p">${pl.m ? eur(pl[bill]) : '0 €'}<small style="font:500 14px var(--ff)">${pl.m ? (bill === 'y' ? ' / an' : ' / mois') : ''}</small></div>
      <ul>${pl.perks.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${pl.id === p.id ? '<span class="pill acc">Plan actuel</span>' : `<button class="btn ${pl.id === 'free' ? '' : 'primary'}" data-act="buy" data-id="${pl.id}">${pl.id === 'free' ? 'Revenir au gratuit' : 'Choisir'}</button>`}</div>`).join('')}</div>
    <label class="chk"><input type="checkbox" data-k="settings.gmaoOpt" ${st.gmaoOpt || p.gmao ? 'checked' : ''} ${p.gmao ? 'disabled' : ''}> Option connexion GMAO : ${eur(GMAO_OPT[bill])} ${bill === 'y' ? '/ an' : '/ mois'} ${p.gmao ? '(incluse dans Business)' : ''}</label>
    <p class="mute" style="font-size:14px">Scans ce mois : ${q.used} / ${scansLbl(p)}. Le compteur repart à zéro le 1er de chaque mois.${st.planDemo ? ' <b>Plan activé en mode démonstration.</b>' : ''}</p>
  </div></details>

  <details class="set"><summary>${ic('spark')}Apparence</summary><div class="in">${lockNote('appearance')}<fieldset class="fs" ${dis('appearance')}>
    <label class="f">Nom de l'application<input data-k="settings.appName" value="${esc(st.appName)}" maxlength="24"></label>
    <div><small>Couleur principale</small><div class="row" style="margin-top:8px">${ACCENTS.map(c => `<button class="sw ${st.accent === c ? 'on' : ''}" style="background:${c}" data-act="accent" data-c="${c}" aria-label="Couleur ${c}"></button>`).join('')}<input type="color" value="${esc(st.accent)}" data-k="settings.accent" aria-label="Couleur personnalisée"></div></div>
    <div class="seg" style="grid-template-columns:repeat(3,1fr)">${[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, v]) => `<label><input type="radio" name="th" value="${k}" ${st.theme === k ? 'checked' : ''} data-k="settings.theme">${v}</label>`).join('')}</div>
  </fieldset></div></details>

  <details class="set"><summary>${ic('list')}Onglets</summary><div class="in">
    ${S.tabs.map(t => `<div class="trow"><div class="row"><span class="chip" style="pointer-events:none"><span class="dot" style="background:${esc(t.color)}"></span>${ic(t.icon, 's')}${esc(t.name)}</span>
      <span class="mute" style="font-size:13px">${t.remb ? 'remboursable' : 'non remboursable'}${t.gmao ? ' · lié à la GMAO' : ''}${t.lock ? ' · verrouillé' : ''}</span>
      <button class="btn" data-act="editTab" data-id="${esc(t.id)}" style="margin-left:auto">${ic('pen', 's')}Modifier</button></div></div>`).join('')}
    <button class="btn" data-act="newTab">${ic('plus', 's')}Ajouter un onglet</button>
  </div></details>

  <details class="set"><summary>${ic('target')}Plafonds de remboursement</summary><div class="in">${lockNote('rules')}<fieldset class="fs" ${dis('rules')}>
    <p class="mute" style="font-size:14px">Seul le montant dans la limite est compté pour le remboursement ; le reste apparaît « hors limite » dans le récapitulatif.</p>
    ${S.rules.map(r => `<div class="trow"><div class="grid3">
      <label class="f">Catégorie<select data-rule="${r.id}" data-f="cat">${catOpts(r.cat)}</select></label>
      <label class="f">Plafond (€)<input type="number" min="0" step="0.01" inputmode="decimal" value="${r.limit}" data-rule="${r.id}" data-f="limit"></label>
      <label class="f">Période<select data-rule="${r.id}" data-f="per">${Object.entries(PER).map(([k, v]) => `<option value="${k}" ${r.per === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <div class="row">${S.tabs.filter(t => t.remb).map(t => `<label class="chk"><input type="checkbox" data-rule="${r.id}" data-f="tab" value="${esc(t.id)}" ${!r.tabs?.length || r.tabs.includes(t.id) ? 'checked' : ''}>${esc(t.name)}</label>`).join('')}
      <button class="btn danger" data-act="delRule" data-id="${r.id}" style="margin-left:auto">${ic('trash', 's')}Supprimer</button></div></div>`).join('')}
    <button class="btn" data-act="addRule">${ic('plus', 's')}Ajouter un plafond</button>
  </fieldset></div></details>

  <details class="set"><summary>${ic('target')}Budgets</summary><div class="in">${lockNote('budgets')}
    <p class="mute" style="font-size:14px">Un budget par onglet (total, ou par type de dépense) et par jour, mois ou année. L'accueil affiche où vous en êtes ; un message prévient quand un budget est dépassé.</p>
    ${S.tabs.map(t => { const bs = S.budgets.filter(b => b.tabId === t.id && b.amount > 0); return `<div class="trow"><div class="row"><span class="chip" style="pointer-events:none"><span class="dot" style="background:${esc(t.color)}"></span>${esc(t.name)}</span>
      <span class="mute" style="font-size:13px">${bs.length ? bs.map(b => `${esc(b.cat || 'Total')} ${eur(b.amount)} ${esc(PER[b.per])}`).join(' · ') : 'Aucun budget'}</span>
      <button class="btn" data-act="budget" data-id="${esc(t.id)}" style="margin-left:auto">${ic('target', 's')}Budget</button></div></div>`; }).join('')}
  </div></details>

  <details class="set"><summary>${ic('wrench')}GMAO et interventions</summary><div class="in">${lockNote('gmao')}<fieldset class="fs" ${dis('gmao')}>
    ${hasGmao() ? '' : `<div class="note warn">La synchronisation GMAO fait partie de l'option GMAO (ou du plan Business). L'export par intervention reste disponible.</div>`}
    <label class="f">Adresse du service GMAO (notes de frais)<input type="url" data-k="settings.gmaoUrl" value="${esc(st.gmaoUrl)}" placeholder="À coller depuis la GMAO (Notes de frais › Recevoir les dépenses)"></label>
    <label class="f">Jeton d'accès GMAO<input type="password" data-k="settings.gmaoToken" value="${esc(st.gmaoToken)}" autocomplete="off" placeholder="Jeton fp_… à coller depuis la GMAO"></label>
    <label class="chk"><input type="checkbox" data-k="settings.gmaoImgs" ${st.gmaoImgs ? 'checked' : ''}> Joindre les justificatifs (photos) à l'envoi</label>
    <div class="row"><button class="btn" data-act="loadInter">${ic('download', 's')}Charger les interventions depuis la GMAO</button></div>
    <h3 style="margin:6px 0 0">Interventions enregistrées</h3>
    ${S.inter.length ? `<div class="scroll"><table><thead><tr><th>N°</th><th>Client</th><th>Libellé</th><th></th></tr></thead><tbody>${S.inter.map((i, k) => `<tr><td>${esc(i.num || '—')}</td><td>${esc(i.client)}</td><td>${esc(i.label)}</td><td class="n"><button class="btn icon ghost" data-act="delInter" data-i="${k}" aria-label="Supprimer">${ic('trash', 's')}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="mute" style="font-size:14px">Aucune pour l\'instant.</p>'}
    <form id="interF" class="grid3"><input name="client" placeholder="Client"><input name="num" placeholder="N° (facultatif, ex. ${new Date().getFullYear()}-S012)"><input name="label" placeholder="Libellé (ex. HM3010DCV)"><button class="btn" style="grid-column:1/-1">${ic('plus', 's')}Ajouter l'intervention</button></form>
  </fieldset></div></details>

  <details class="set"><summary>${ic('spark')}Lecture automatique</summary><div class="in">${lockNote('mistral')}
    <p class="mute" style="font-size:14px">Les tickets et factures photographiés sont lus automatiquement : commerçant, date, montant, TVA et catégorie se remplissent seuls.</p>
    <div class="seg" style="max-width:340px"><label><input type="radio" name="ar" value="on" ${st.autoRead !== false ? 'checked' : ''} data-act-ar ${dis('mistral')}>Activée</label><label><input type="radio" name="ar" value="off" ${st.autoRead === false ? 'checked' : ''} data-act-ar ${dis('mistral')}>Désactivée</label></div>
    <p class="mute" style="font-size:13px">${proxy() || st.apiKey ? 'Service de lecture prêt.' : 'Service de lecture pas encore configuré par l’administrateur.'} Hors connexion, les tickets sont lus dès le retour du réseau.</p>
    <label class="chk"><input type="checkbox" data-k="settings.autoSync" ${st.autoSync !== false ? 'checked' : ''}> Envoyer automatiquement les dépenses pro à la GMAO au retour du réseau</label>
  </div></details>

  <details class="set"><summary>${ic('phone')}Mes appareils (synchronisation)</summary><div class="in">${syncSectionHtml()}</div></details>

  <details class="set"><summary>${ic('lock')}Sécurité</summary><div class="in">
    <p style="font-size:15px">Accès : <b>${S.account?.lock.method === 'pin' ? 'code à 4 chiffres' : 'mot de passe'}</b> · mail de récupération : <b>${esc(S.account?.email)}</b></p>
    <div class="row"><button class="btn" data-act="changeSecret">${ic('pen', 's')}Changer le code / mot de passe</button><button class="btn" data-act="changeEmail">Changer l'adresse mail</button><button class="btn" data-act="newRec">Nouveau code de secours</button></div>
    <label class="f" style="max-width:260px">Verrouillage auto après (minutes en arrière-plan)<input type="number" min="0" max="120" data-k="settings.autoLockMin" value="${st.autoLockMin}" ${dis('security')}></label>${lockNote('security')}
  </div></details>

  <details class="set" id="secOrg"><summary>${ic('briefcase')}Organisation</summary><div class="in">${orgSectionHtml()}</div></details>


  <details class="set"><summary>${ic('download')}Données</summary><div class="in">
    <div class="row"><button class="btn" data-act="expJson">${ic('download', 's')}Sauvegarde complète</button><button class="btn" data-act="importData">${ic('upload', 's')}Importer (sauvegarde ou CSV)</button><button class="btn danger" data-act="wipe">${ic('trash', 's')}Tout effacer</button></div>
    <p class="mute" style="font-size:14px">Format CSV accepté : date;commerçant;catégorie;montant;tva;onglet;intervention;client;note (séparateur ; ou ,).</p>
    <p class="mute" style="font-size:13px">${S.exps.length} dépenses · stockage ${DB.ok ? 'sur l’appareil' : 'temporaire (ce navigateur bloque le stockage)'}.</p>
  </div></details>

  <details class="set"><summary>${ic('phone')}Installer l'application</summary><div class="in">${installHelp()}</div></details>
  <details class="set" id="secAdmin"><summary>${ic('lock')}Admin</summary><div class="in">${adminSectionHtml()}</div></details>
  <p class="mute" style="text-align:center;font-size:13px">${esc(st.appName)} · version 1.2 · appareil ${esc(st.deviceId.slice(-6))}</p>`;
  const oj = $('#orgJoinF'); if (oj) oj.onsubmit = e => { e.preventDefault(); joinOrgUrl(e.target.u.value); };
  bindAdmin();
  $('#interF').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    if (!f.num.value.trim() && !f.client.value.trim()) { toast('Indiquez au moins le client'); return; }
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
    <p class="mute" style="font-size:13px">Scans restants ce mois : ${plan().scans === Infinity ? 'illimités' : Math.max(0, plan().scans - quotaNow().used) + ' / ' + plan().scans}</p>`);
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
    if (S.settings.autoRead !== false && (!navigator.onLine || stop === 'net')) e.ocrPending = true;
    else if (S.settings.autoRead !== false && !stop) {
      try { Object.assign(e, pick(await ocrBlob(b))); read++; }
      catch (err) { if (err.name === 'TypeError') { stop = 'net'; e.ocrPending = true; } else stop = err.code === 'quota' ? 'quota' : err.message; }
    }
    const dup = findDup(e); if (dup) { e.dupSuspect = true; e.dupOf = dup.id; dups++; }
    const imgId = uid(); await DB.set('img', imgId, b).catch(() => {}); e.imgs = [imgId];
    S.exps.push(e); await saveExp(e); ok++;
  }
  m.close(); render();
  toast(`${ok} justificatifs importés, ${read} lus automatiquement${dups ? `, ${dups} doublon(s) possible(s)` : ''}${stop === 'quota' ? ' (quota de scans atteint)' : stop === 'net' || !navigator.onLine ? ' ; lecture au retour du réseau' : stop ? ' (' + stop + ')' : ''}. À vérifier dans la liste.`, 5000);
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
    if (r.status === 503 && j.pause) throw err(j.error, 'pause');
    if (!r.ok) throw err(j.error || 'Serveur relais : erreur ' + r.status);
    raw = j.fields || {};
    if (j.quota) { S.quota = { month: today().slice(0, 7), used: j.quota.used }; await save('quota'); renderChrome(); return clean(raw); }
  } else if (S.settings.apiKey) raw = await mistralDirect(dataUrl, pdf);
  else throw err('Lecture automatique pas encore configurée : voyez avec votre administrateur.', 'config');
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
  if (!r.ok) throw err('Lecture : ' + (j.message || j.detail?.[0]?.msg || j.error || r.status));
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
  if (!c.ok) throw err('Lecture : ' + (cj.message || c.status));
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
  let pendingOcr = !!draft.ocrPending;
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
      <div id="fPro" class="grid2"><label class="f">Client *<input name="client" list="cliL" value="${esc(e.client)}" placeholder="Client de l'intervention" autocomplete="off"></label><label class="f">N° d'intervention (facultatif)<input name="inter" list="interL" value="${esc(e.inter)}" placeholder="${new Date().getFullYear()}-S001" autocapitalize="characters"></label></div>
      <datalist id="cliL">${[...new Set([...S.inter.map(i => i.client), ...S.exps.map(x => x.client)].filter(Boolean))].sort().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <datalist id="interL">${S.inter.filter(i => i.num).map(i => `<option value="${esc(i.num)}">${esc(i.client)} ${esc(i.label)}</option>`).join('')}</datalist>
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
    if (!$('#fStat', el).dataset.busy && !pendingOcr) $('#fStat', el).innerHTML = any && S.settings.autoRead !== false ? `<button type="button" class="btn accent" id="fOcr" style="width:100%">${ic('spark', 's')}Lire le justificatif et remplir</button>` : '';
  };
  const firstBlob = async () => blobs[0] || (e.imgs[0] ? await DB.get('img', e.imgs[0]).catch(() => null) : null);
  const setVal = (n, v) => { if (v === undefined || v === null || v === '') return; const i = f[n]; if (!i) return; i.value = typeof v === 'number' && n !== 'qty' ? String(v).replace('.', ',') : v; i.classList.remove('filled'); void i.offsetWidth; i.classList.add('filled'); };
  const waitNet = st => { pendingOcr = true; f.amount.required = false; st.innerHTML = `<div class="status">${ic('sync', 's')}Hors connexion : le justificatif sera lu automatiquement au retour du réseau. Vous pouvez enregistrer sans montant.</div>`; };
  const runOcr = async () => {
    const st = $('#fStat', el), b = await firstBlob(); if (!b) return;
    if (!navigator.onLine) { waitNet(st); return; }
    st.dataset.busy = '1'; st.innerHTML = `<div class="status"><span class="spin"></span>Lecture du justificatif…</div>`;
    try {
      const d = await ocrBlob(b);
      ['merchant', 'date', 'amount', 'vat', 'cat', 'qty', 'pay'].forEach(k => setVal(k, d[k]));
      if (d.note && !f.note.value) setVal('note', d.note);
      st.innerHTML = `<div class="status ok">${ic('check', 's')}Rempli automatiquement — vérifiez le montant avant d'enregistrer.</div>`;
      updR();
      pendingOcr = false;
    } catch (x) {
      if (x.name === 'TypeError' || !navigator.onLine) { waitNet(st); delete st.dataset.busy; return; }
      st.innerHTML = `<div class="status err">${esc(x.message)}</div>${x.code === 'quota' ? `<button type="button" class="btn accent" data-act="plans" style="width:100%">${ic('crown', 's')}Passer à un plan avec plus de scans</button>` : x.code === 'config' ? `<button type="button" class="btn" id="fCfg" style="width:100%">Ouvrir les réglages</button>` : ''}`;
      const c = $('#fCfg', el); if (c) c.onclick = () => { m.close(); nav('settings'); openSection('Lecture'); };
    }
    delete st.dataset.busy;
  };
  const updR = () => {
    const t = tabById(f.tabId.value);
    $('#fPro', el).hidden = !t?.gmao; f.client.required = !!t?.gmao;
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
    S.exps = S.exps.filter(x => x.id !== e.id); await DB.del('exp', e.id).catch(() => {}); for (const i of e.imgs) await DB.del('img', i).catch(() => {}); markDead(e.id);
    m.close(); render(); toast('Dépense supprimée');
  };
  f.onsubmit = async ev => {
    ev.preventDefault();
    const amt = r2(num(f.amount.value)); if (!(amt > 0) && !pendingOcr) { toast('Indiquez un montant'); f.amount.focus(); return; }
    Object.assign(e, { tabId: f.tabId.value, date: f.date.value, merchant: f.merchant.value.trim(), amount: amt, vat: r2(num(f.vat.value)), cat: f.cat.value || guessCat(f.merchant.value) || 'Autre',
      qty: Math.max(1, +f.qty.value || 1), pay: f.pay.value, note: f.note.value.trim(), inter: f.inter.value.trim().toUpperCase().replace(/[\s,.;:]+$/, ''), client: f.client.value.trim().replace(/[\s,;]+$/, ''), check: false, dupSuspect: false, updatedAt: Date.now() });
    if (!tabById(e.tabId)?.gmao) { e.inter = ''; e.client = ''; }
    e.ocrPending = pendingOcr && (blobs.length > 0 || e.imgs.length > 0); if (e.ocrPending) e.check = true;
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
    const alerte = budgetAlert(e);
    toast((R?.excess > 0 ? `Enregistré · ${eur(R.excess)} hors limite, non remboursé` : 'Dépense enregistrée') + (alerte ? ' · ' + alerte : ''), alerte ? 6000 : 2800);
    if (navigator.onLine && S.settings.autoSync !== false && tabById(e.tabId)?.gmao && (e.inter || e.client) && !e.ocrPending) setTimeout(() => syncGmao(true).then(() => render()), 3000);
  };
  if (pendingOcr) f.amount.required = false;
  await drawPics(); updR();
  if (opts.auto && blobs.length && S.settings.autoRead !== false) runOcr();
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
  if (t.org && orgLocked('tabs')) {
    $$('input', f).forEach(x => { x.disabled = true; }); $('#tDel', el)?.remove();
    f.insertAdjacentHTML('afterbegin', lockNote('tabs').replace('Réglage', 'Onglet'));
  }
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
    for (const x of S.exps.filter(x => x.tabId === t.id)) { await DB.del('exp', x.id).catch(() => {}); for (const i of x.imgs || []) await DB.del('img', i).catch(() => {}); markDead(x.id); }
    S.exps = S.exps.filter(x => x.tabId !== t.id); S.tabs = S.tabs.filter(x => x.id !== t.id);
    S.rules.forEach(r => { r.tabs = (r.tabs || []).filter(x => x !== t.id); }); S.obj.tabs = S.obj.tabs.filter(x => x !== t.id); S.budgets = S.budgets.filter(b => b.tabId !== t.id); await save('budgets');
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
async function syncGmao(silent = false) {
  if (silent) return syncGmaoSilent();
  if (!hasGmao()) {
    if (await confirmBox('Option GMAO', `La synchronisation vers la GMAO est incluse dans l'option GMAO (${eur(GMAO_OPT.m)} / mois) ou le plan Business. En attendant, l'export CSV par intervention reste disponible.`, 'Voir les offres')) { nav('settings'); }
    return;
  }
  const url = (S.settings.gmaoUrl || '').trim();
  if (!url) { toast('Renseignez l’adresse de la GMAO dans Réglages › GMAO', 4000); nav('settings'); openSection('GMAO'); return; }
  const { ex, RB } = recapData();
  const gm = ex.filter(e => tabById(e.tabId)?.gmao);
  const noNum = gm.filter(e => !e.inter && !e.client).length;
  const pend = gm.filter(envoyable);
  if (!pend.length) { toast(noNum ? `${noNum} dépense(s) pro sans client : ajoutez-le pour les envoyer.` : 'Tout est déjà synchronisé'); return; }
  const groups = grouper(pend);
  if (!await confirmBox('Synchroniser la GMAO', `${pend.length} dépense(s) vont être envoyées à la GMAO.${noNum ? `<br><small>${noNum} dépense(s) sans client ne seront pas envoyées.</small>` : ''}`, 'Envoyer')) return;
  const m = modal(`<div class="status"><span class="spin"></span>Envoi vers la GMAO…</div>`);
  try {
    const { ok, refus } = await envoyerGmao(url, groups, RB, pend);
    m.close(); render();
    if (refus.size) infoBox('Envoi GMAO', `<p>${ok} dépense(s) reçue(s) par la GMAO, ${refus.size} refusée(s) :</p><ul>${[...refus].map(([id, why]) => { const e = pend.find(x => x.id === id); return `<li>${esc(e ? fmtDate(e.date) + ' · ' + (e.merchant || 'Sans nom') + ' · ' + eur(e.amount) : id)} — ${esc(why)}</li>`; }).join('')}</ul>`);
    else toast(`${ok} dépense(s) envoyée(s) à la GMAO`);
  } catch (x) { m.close(); toast(x.message.includes('Failed to fetch') || x.name === 'TypeError' ? 'GMAO injoignable (adresse, connexion ou autorisation CORS)' : x.message, 4500); }
}
async function syncGmaoSilent() {
  const url = (S.settings.gmaoUrl || '').trim(); if (!url || !hasGmao()) return;
  const pend = S.exps.filter(envoyable);
  if (!pend.length) return;
  const groups = grouper(pend);
  try { const { ok, refus } = await envoyerGmao(url, groups, computeReimb(), pend); if (ok) toast(`${ok} dépense(s) envoyée(s) à la GMAO`); if (refus.size) toast(`${refus.size} dépense(s) refusée(s) par la GMAO : ouvrez Récap › Synchroniser pour le détail`, 5000); } catch {}
}
/* Une dépense pro part dès qu'elle a un client ou un n° d'intervention : la date et le client suffisent côté GMAO. */
const envoyable = e => tabById(e.tabId)?.gmao && (e.inter || e.client) && e.sync !== 'ok' && !e.ocrPending;
const grouper = list => { const g = {}; list.forEach(e => { const k = e.inter ? 'n:' + e.inter : 'c:' + norm(e.client); (g[k] = g[k] || []).push(e); }); return g; };
async function envoyerGmao(url, groups, RB, pend) {
  {
    const interventions = [];
    for (const [num, arr] of Object.entries(groups)) {
      const deps = [];
      for (const e of arr) {
        const r = RB.get(e.id) || {};
        const d = { id: e.id, date: e.date, commercant: e.merchant, categorie: e.cat, quantite: e.qty, montant_ttc: e.amount, tva: e.vat, remboursable: r.remb, hors_limite: r.excess, paiement: e.pay, note: e.note };
        if (S.settings.gmaoImgs && e.imgs?.[0]) { const b = await DB.get('img', e.imgs[0]).catch(() => null); if (b) d.justificatif = await toDataURL(b); }
        deps.push(d);
      }
      interventions.push({ numero: arr[0].inter || '', client: arr.find(x => x.client)?.client || '', total_ttc: sum(arr), total_remboursable: sum(arr, x => RB.get(x.id)?.remb), total_hors_limite: sum(arr, x => RB.get(x.id)?.excess), depenses: deps });
    }
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(S.settings.gmaoToken ? { Authorization: 'Bearer ' + S.settings.gmaoToken } : {}) },
      body: JSON.stringify({ source: S.settings.appName, version: 1, appareil: S.settings.deviceId, utilisateur: S.account?.email, envoye_le: new Date().toISOString(), interventions }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && !(r.status === 409 && Array.isArray(j.ignorees))) throw new Error(j.error || 'GMAO : erreur ' + r.status);
    const refus = new Map((j.ignorees || []).map(x => [x.id, x.raison]));
    const now = Date.now(); let ok = 0;
    for (const e of pend) { if (refus.has(e.id)) continue; e.sync = 'ok'; e.syncAt = now; await saveExp(e); ok++; }
    return { ok, refus };
  }
}
async function loadInter() {
  const url = (S.settings.gmaoUrl || '').trim(); if (!url) { toast('Renseignez d’abord l’adresse de la GMAO'); return; }
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'interventions=1', { headers: S.settings.gmaoToken ? { Authorization: 'Bearer ' + S.settings.gmaoToken } : {} });
    const j = await r.json(); const arr = Array.isArray(j) ? j : j.interventions || [];
    let n = 0; for (const i of arr) { const num = String(i.numero || i.num || '').toUpperCase(), client = String(i.client || '').trim();
      if (num ? !S.inter.some(x => x.num === num) : client && !S.inter.some(x => !x.num && norm(x.client) === norm(client))) { S.inter.push({ num, client, label: i.libelle || i.label || '' }); n++; } }
    await save('inter'); renderSettings(); openSection('GMAO'); toast(n + ' intervention(s) ajoutée(s)');
  } catch { toast('Impossible de charger les interventions depuis la GMAO', 4000); }
}

/* ---------- Synchronisation entre mes appareils (téléphone, tablette, PC) ----------
   Un code de synchro commun relie les appareils. Tout est chiffré ici (AES-GCM, clé tirée du code) avant d'être déposé
   sur le relais, qui ne garde que des blocs illisibles. Dépenses : la plus récente modification gagne ; suppressions
   mémorisées (« dead ») pour qu'elles se propagent. Onglets, plafonds, objectifs, budgets, interventions et réglages
   communs : la version modifiée le plus récemment gagne. Le compte (code d'accès) reste propre à chaque appareil. */
const SYNC_KEYS = ['tabs', 'rules', 'obj', 'budgets', 'inter', 'set'];
const SYNC_SET = ['appName', 'accent', 'theme', 'gmaoUrl', 'gmaoToken', 'gmaoImgs', 'autoRead', 'autoSync'];
const syncVal = k => k === 'set' ? Object.fromEntries(SYNC_SET.map(f => [f, S.settings[f]])) : S[k];
let SY = null, syncK = null, syncRun = false, syncAgain = false, syncT;
const saveSY = () => DB.set('kv', 'syncst', SY).catch(() => {});
function syncCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(16)); const s = [...r].map(x => A[x % A.length]).join(''); return s.match(/.{4}/g).join('-'); }
const hexOf = a => [...a].map(b => b.toString(16).padStart(2, '0')).join('');
function b64big(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
async function syncKeys(code) {
  const c = cleanCode(code), te = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', te.encode(c), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: te.encode('fraispilot-sync-v1'), iterations: 150000, hash: 'SHA-256' }, base, 512));
  return { aes: await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']), space: hexOf(bits.slice(32, 44)), auth: hexOf(bits.slice(44, 64)) };
}
async function seal(K, u8) { const iv = crypto.getRandomValues(new Uint8Array(12)); return b64big(iv) + '.' + b64big(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, K.aes, u8))); }
async function unseal(K, txt) { const [iv, ct] = String(txt).split('.'); return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, K.aes, unb64(ct))); }
async function syncHttp(K, method, sub = '', body) {
  const r = await fetch(`${proxy()}/sync/${K.space}${sub}`, { method, headers: { 'X-Sync-Key': K.auth, ...(body ? { 'Content-Type': 'text/plain' } : {}) }, body, cache: 'no-store' });
  if (r.status === 404 && method === 'GET') return null;
  if (r.status === 403) throw Object.assign(new Error('Code de synchronisation refusé'), { code: 'auth' });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Synchronisation : erreur ' + r.status);
  return method === 'GET' ? r.text() : true;
}
/* Fusion pure (testée) : renvoie l'état commun et s'il diffère de la version distante. */
function mergeSync(loc, rem) {
  rem = rem || { exps: [], dead: {}, keys: {} };
  const ts = e => +e.updatedAt || +e.createdAt || 0, old = Date.now() - 180 * 86400000;
  const dead = { ...(rem.dead || {}) };
  for (const [id, t] of Object.entries(loc.dead || {})) dead[id] = Math.max(dead[id] || 0, t);
  for (const id of Object.keys(dead)) if (dead[id] < old) delete dead[id];
  const byId = new Map();
  for (const e of rem.exps || []) byId.set(e.id, e);
  for (const e of loc.exps || []) { const r = byId.get(e.id); if (!r || ts(e) > ts(r)) byId.set(e.id, e); }
  const exps = [...byId.values()].filter(e => !(e.id in dead) || ts(e) > dead[e.id]);
  for (const e of exps) delete dead[e.id];
  const keys = { ...(rem.keys || {}) };
  for (const [k, v] of Object.entries(loc.keys || {})) if (!keys[k] || v.t > keys[k].t) keys[k] = v;
  const remMap = new Map((rem.exps || []).map(e => [e.id, ts(e)]));
  const changed = exps.length !== remMap.size || exps.some(e => remMap.get(e.id) !== ts(e)) || Object.keys(dead).length !== Object.keys(rem.dead || {}).length
    || SYNC_KEYS.some(k => (keys[k]?.t || 0) !== (rem.keys?.[k]?.t || 0));
  return { exps, dead, keys, changed };
}
function markDead(id) { if (SY) { SY.dead[id] = Date.now(); saveSY(); syncSoon(); } }
function syncSoon(ms = 4000) { if (!SY?.code) return; clearTimeout(syncT); syncT = setTimeout(() => syncNow(true), ms); }
async function syncNow(silent = false) {
  if (!SY?.code || !navigator.onLine) return false;
  if (syncRun) { syncAgain = true; return false; }
  syncRun = true;
  try {
    syncK = syncK || await syncKeys(SY.code);
    const raw = await syncHttp(syncK, 'GET');
    const rem = raw ? JSON.parse(new TextDecoder().decode(await unseal(syncK, raw))) : null;
    const now = Date.now(), keys = {};
    for (const k of SYNC_KEYS) { const j = JSON.stringify(syncVal(k) ?? null); if (j !== SY.last[k]) { SY.t[k] = now; SY.last[k] = j; } keys[k] = { t: SY.t[k] || 0, v: syncVal(k) }; }
    const M = mergeSync({ exps: S.exps, dead: SY.dead, keys }, rem);
    /* Appliquer ici ce qui vient des autres appareils */
    let recu = 0;
    const loc = new Map(S.exps.map(e => [e.id, e])), keep = new Set(M.exps.map(e => e.id));
    for (const e of S.exps) if (!keep.has(e.id)) { await DB.del('exp', e.id).catch(() => {}); for (const i of e.imgs || []) await DB.del('img', i).catch(() => {}); recu++; }
    for (const e of M.exps) { const l = loc.get(e.id); if (l !== e) { await DB.set('exp', e.id, e).catch(() => {}); recu++; } }
    S.exps = M.exps;
    for (const k of SYNC_KEYS) {
      const r = M.keys[k]; if (!r || r.t <= (SY.t[k] || 0)) continue;
      if (k === 'set') { Object.assign(S.settings, r.v); await save('settings'); applyTheme(); } else { S[k] = r.v; await save(k); }
      SY.t[k] = r.t; SY.last[k] = JSON.stringify(syncVal(k) ?? null); recu++;
    }
    SY.dead = M.dead;
    if (M.changed || !raw) await syncHttp(syncK, 'PUT', '', await seal(syncK, new TextEncoder().encode(JSON.stringify({ v: 1, at: now, exps: M.exps, dead: M.dead, keys: M.keys }))));
    /* Justificatifs : envoyer les nouveaux, récupérer ceux qui manquent ici */
    const up = new Set(SY.up || []);
    let n = 0;
    for (const e of S.exps) for (const id of e.imgs || []) {
      if (n >= 40) break;
      const b = await DB.get('img', id).catch(() => null);
      if (b && !up.has(id)) { const u8 = new Uint8Array(await b.arrayBuffer()); if (u8.length < 2.9e6) { await syncHttp(syncK, 'PUT', '/img/' + id, (b.type || 'image/jpeg') + '|' + await seal(syncK, u8)); } up.add(id); n++; }
      else if (!b) { const t = await syncHttp(syncK, 'GET', '/img/' + id).catch(() => null); if (t) { const i = t.indexOf('|'); await DB.set('img', id, new Blob([await unseal(syncK, t.slice(i + 1))], { type: t.slice(0, i) })).catch(() => {}); up.add(id); n++; } }
    }
    SY.up = [...up].filter(id => S.exps.some(e => (e.imgs || []).includes(id)));
    SY.at = now; SY.err = ''; await saveSY();
    if (recu && S.ses.unlocked) { render(); if (!silent || raw) toast(`Synchronisé avec tes autres appareils`); }
    else if (!silent) toast('Tout est à jour sur tes appareils');
    return true;
  } catch (x) {
    SY.err = x.code === 'auth' ? 'Code refusé' : (x.name === 'TypeError' ? 'Relais injoignable' : x.message); await saveSY();
    if (!silent) toast('Synchronisation impossible : ' + SY.err, 4500);
    return false;
  } finally { syncRun = false; if (syncAgain) { syncAgain = false; syncSoon(1500); } }
}
async function startSync(code, rejoindre) {
  const c = cleanCode(code); if (c.length !== 16) { toast('Le code de synchro fait 16 caractères (ex. ABCD-EFGH-JKLM-NPQR)'); return false; }
  const K = await syncKeys(c);
  let raw = null;
  try { raw = await syncHttp(K, 'GET'); } catch (x) { toast(x.code === 'auth' ? 'Code de synchronisation refusé' : 'Relais injoignable : réessaie avec du réseau', 4500); return false; }
  if (rejoindre && !raw) { toast('Code inconnu : vérifie-le sur ton autre appareil', 4500); return false; }
  if (raw) { try { await unseal(K, raw); } catch { toast('Code de synchronisation incorrect', 4500); return false; } }
  /* En rejoignant, les réglages communs viennent des autres appareils ; les dépenses s'additionnent. */
  SY = { code: c.match(/.{4}/g).join('-'), t: {}, last: {}, dead: SY?.dead || {}, up: [], at: 0 };
  for (const k of SYNC_KEYS) SY.last[k] = JSON.stringify(syncVal(k) ?? null);
  if (!rejoindre) for (const k of SYNC_KEYS) SY.t[k] = Date.now();
  syncK = K; await saveSY();
  const m = modal(`<div class="status"><span class="spin"></span>Synchronisation…</div>`);
  const ok = await syncNow(true); m.close();
  if (ok) toast(rejoindre ? 'Appareil relié : dépenses et réglages synchronisés' : 'Synchronisation activée');
  renderSettings(); openSection('appareils');
  return ok;
}
const syncLink = () => location.origin + location.pathname + '#sync=' + encodeURIComponent(SY.code);
async function joinSyncLink(code) {
  if (SY?.code && cleanCode(SY.code) === cleanCode(code)) { syncNow(false); return; }
  if (!await confirmBox('Relier cet appareil ?', 'Tes dépenses, onglets, plafonds, budgets et réglages seront les mêmes que sur tes autres appareils. Les dépenses déjà saisies ici sont conservées et partagées.', 'Relier')) return;
  await startSync(code, true);
}
function syncSectionHtml() {
  if (!SY?.code) return `<p class="mute" style="font-size:14px">Retrouve les mêmes dépenses, onglets, plafonds et budgets sur ton téléphone, ta tablette et ton PC. Tout est chiffré sur l'appareil avant de partir : personne d'autre ne peut lire tes données.</p>
    <div class="row"><button class="btn primary" data-act="syncOn">${ic('sync', 's')}Activer sur cet appareil</button><button class="btn" data-act="syncJoin">${ic('phone', 's')}J'ai déjà un code</button></div>
    <p class="mute" style="font-size:13px">Active-la sur un premier appareil, puis ouvre le lien de liaison sur les autres.</p>`;
  return `<div class="status ${SY.err ? 'err' : 'ok'}">${ic(SY.err ? 'x' : 'check', 's')}${SY.err ? 'Dernière synchro en échec : ' + esc(SY.err) : 'Synchronisation active' + (SY.at ? ' · dernière le ' + new Date(SY.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '')}</div>
    <p style="font-size:15px">Pour ajouter un appareil : envoie-toi le lien ci-dessous (mail, message…) et ouvre-le sur l'autre appareil. Ou tape ce code dans Réglages › Mes appareils › J'ai déjà un code :</p>
    <p style="font:700 20px/1.2 ui-monospace,monospace;letter-spacing:.06em">${esc(SY.code)}</p>
    <div class="row"><button class="btn primary" data-act="syncShare">${ic('upload', 's')}Envoyer le lien de liaison</button><button class="btn" data-act="syncGo">${ic('sync', 's')}Synchroniser maintenant</button><button class="btn danger" data-act="syncOff">Arrêter sur cet appareil</button></div>
    <p class="mute" style="font-size:13px">Garde ce code pour toi : il donne accès à tes dépenses.</p>`;
}
/* Dépenses envoyées à la GMAO puis supprimées là-bas : on les retire aussi de l'appli. */
async function gmaoRetirees() {
  const url = (S.settings.gmaoUrl || '').trim(), tok = S.settings.gmaoToken; if (!url || !tok || !hasGmao()) return;
  const cand = S.exps.filter(e => e.sync === 'ok' && tabById(e.tabId)?.gmao && Date.now() - (e.syncAt || 0) > 120000);
  if (!cand.length) return;
  let j; try { const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'notes=1', { headers: { Authorization: 'Bearer ' + tok }, cache: 'no-store' }); if (!r.ok) return; j = await r.json(); } catch { return; }
  if (!Array.isArray(j?.source_ids)) return; // GMAO pas encore à jour : on ne touche à rien
  const present = new Set(j.source_ids), out = cand.filter(e => !present.has(e.id));
  if (!out.length) return;
  if (out.length > 5 && !await confirmBox('Dépenses supprimées dans la GMAO', `${out.length} dépenses envoyées à la GMAO n'y sont plus. Les retirer aussi de ${esc(S.settings.appName)} ?`, 'Retirer', true)) return;
  for (const e of out) { await DB.del('exp', e.id).catch(() => {}); for (const i of e.imgs || []) await DB.del('img', i).catch(() => {}); markDead(e.id); }
  const ids = new Set(out.map(e => e.id)); S.exps = S.exps.filter(e => !ids.has(e.id));
  toast(`${out.length} dépense(s) supprimée(s) dans la GMAO retirée(s) ici`, 4500);
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
  const data = await backupData(withImg);
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
    if (d?.format === 'fraispilot-org') {
      if (!await confirmBox('Rejoindre ' + (d.name || 'l’organisation') + ' ?', 'Cet appareil recevra la configuration contenue dans ce fichier (sans mises à jour automatiques : demandez le lien d’invitation pour cela).', 'Appliquer')) return;
      try { await applyOrgConfig(d, S.org?.id === d.id ? S.org.url : ''); toast('Configuration « ' + S.org.name + ' » appliquée'); } catch (e) { toast(e.message); }
      return;
    }
    if (!Array.isArray(d.exps)) { toast('Ce fichier n’est pas une sauvegarde FraisPilot'); return; }
    if (!await confirmBox('Importer la sauvegarde', `${d.exps.length} dépenses, ${d.tabs?.length || 0} onglets. Les dépenses existantes sont conservées ; les doublons sont remplacés.`, 'Importer')) return;
    for (const t of d.tabs || []) if (!tabById(t.id)) S.tabs.push(t);
    for (const b of d.budgets || []) if (!S.budgets.some(x => x.id === b.id)) S.budgets.push(b);
    for (const r of d.rules || []) if (!S.rules.some(x => x.id === r.id)) S.rules.push(r);
    for (const i of d.inter || []) if (!S.inter.some(x => x.num === i.num)) S.inter.push(i);
    for (const [id, du] of Object.entries(d.imgs || {})) { const b = await (await fetch(du)).blob(); await DB.set('img', id, b).catch(() => {}); }
    for (const e of d.exps) { const i = S.exps.findIndex(x => x.id === e.id); if (i >= 0) S.exps[i] = e; else S.exps.push(e); await saveExp(e); }
    await Promise.all([save('tabs'), save('rules'), save('inter'), save('budgets')]); render(); toast(d.exps.length + ' dépenses importées'); return;
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

/* ---------- Budgets ---------- */
function budgetAlert(e) {
  const msgs = [];
  for (const b of S.budgets.filter(b => b.tabId === e.tabId && b.amount > 0 && (!b.cat || b.cat === e.cat))) {
    const k = periodKey(e.date, b.per);
    const tot = sum(S.exps.filter(x => x.tabId === e.tabId && (!b.cat || x.cat === b.cat) && periodKey(x.date, b.per) === k));
    if (tot > b.amount) msgs.push(`budget ${PER_LBL[b.per]}${b.cat ? ' « ' + b.cat + ' »' : ''} dépassé (${eur(tot)} / ${eur(b.amount)})`);
  }
  return msgs.join(' · ');
}
function editBudget(tabId) {
  const t = tabById(tabId); if (!t) return;
  const locked = t.org && orgLocked('budgets');
  let rows = S.budgets.filter(b => b.tabId === tabId).map(b => ({ ...b }));
  const m = modal(`<div class="hd"><h2>Budget — ${esc(t.name)}</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div>
    ${locked ? lockNote('budgets') : ''}<p class="mute" style="font-size:14px">Budget du total de l'onglet ou d'un type de dépense, par jour, par mois ou par an. Un message vous prévient dès qu'il est dépassé.</p>
    <fieldset class="fs" ${locked ? 'disabled' : ''}><div id="bRows" style="display:grid;gap:10px"></div><button type="button" class="btn" id="bAdd">${ic('plus', 's')}Ajouter un budget</button></fieldset>
    <div class="row end"><button class="btn" data-close>Annuler</button><button class="btn primary" id="bSave" ${locked ? 'disabled' : ''}>${ic('check', 's')}Enregistrer</button></div>`, { wide: true });
  const el = m.el;
  const draw = () => {
    $('#bRows', el).innerHTML = rows.length ? rows.map((r, i) => `<div class="trow"><div class="grid3">
      <label class="f">Type de dépense<select data-i="${i}" data-f="cat"><option value="">Total de l'onglet</option>${CATS.map(c => `<option ${c === r.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="f">Période<select data-i="${i}" data-f="per">${['jour', 'mois', 'an'].map(k => `<option value="${k}" ${r.per === k ? 'selected' : ''}>${PER[k]}</option>`).join('')}</select></label>
      <label class="f">Montant (€)<input data-i="${i}" data-f="amount" inputmode="decimal" placeholder="0,00" value="${r.amount ? String(r.amount).replace('.', ',') : ''}"></label></div>
      <div class="row end"><button type="button" class="btn danger" data-del="${i}">${ic('trash', 's')}Retirer</button></div></div>`).join('') : '<p class="mute">Aucun budget pour cet onglet.</p>';
  };
  const upd = ev => { const x = ev.target; if (x.dataset.i === undefined) return; const r = rows[+x.dataset.i]; if (r) r[x.dataset.f] = x.dataset.f === 'amount' ? r2(num(x.value)) : x.value; };
  el.addEventListener('input', upd); el.addEventListener('change', upd);
  el.addEventListener('click', ev => {
    const d = ev.target.closest('[data-del]'); if (d) { rows.splice(+d.dataset.del, 1); draw(); return; }
    if (ev.target.closest('#bAdd')) { rows.push({ id: uid(), tabId, cat: '', per: 'mois', amount: 0 }); draw(); $$('#bRows input', el).pop()?.focus(); }
  });
  $('#bSave', el).onclick = async () => {
    const seen = new Map(); rows.filter(r => r.amount > 0).forEach(r => seen.set((r.cat || '') + '|' + r.per, r));
    S.budgets = S.budgets.filter(b => b.tabId !== tabId).concat([...seen.values()]);
    await save('budgets'); m.close(); render(); toast('Budget enregistré');
  };
  draw();
}

/* ---------- Organisation (plan Business) : configuration diffusée à toute la flotte ---------- */
const ORG_ITEMS = { appearance: 'Apparence', tabs: 'Onglets', rules: 'Plafonds de remboursement', budgets: 'Budgets', gmao: 'GMAO et interventions', mistral: 'Lecture automatique (service et activation)', security: 'Verrouillage automatique', backup: 'Sauvegarde' };
const ORG_MODES = { off: 'Non diffusé', propose: 'Proposé (modifiable)', impose: 'Imposé' };
const APP_URL = IN_FRAME ? 'https://ssti92350-afk.github.io/fraispilot/' : location.origin + location.pathname;
const orgAdminHere = () => !!S.ses.admin;
const orgLocked = key => !!(S.org && S.org.modes?.[key] === 'impose' && !orgAdminHere());
const lockNote = key => orgLocked(key) ? `<div class="note">${ic('lock', 's')} Réglage imposé par ${esc(S.org.name)}.</div>` : '';
const dis = key => orgLocked(key) ? 'disabled' : '';
function orgSectionHtml() {
  const o = S.org;
  const fmt = t => t ? new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais';
  return `${o ? `<div class="trow"><div class="row">${o.logo ? `<img src="${esc(o.logo)}" alt="" class="orglogo">` : ''}<div class="grow"><b>${esc(o.name)}</b><br><small class="mute">Configuration du ${fmt(o.version)} · vérifiée ${o.lastCheck ? 'le ' + fmt(o.lastCheck) : 'jamais'}</small></div></div>
      <small class="mute">${Object.entries(o.modes || {}).filter(([, v]) => v !== 'off').map(([k, v]) => `${ORG_ITEMS[k]} : ${v === 'impose' ? 'imposé' : 'proposé'}`).join(' · ')}</small>
      ${o.backup ? `<small class="mute">Sauvegarde : ${o.backup.method === 'url' ? 'envoi au serveur de l’entreprise' : 'fichier à déposer sur le Drive ou le serveur'}${o.backup.everyDays ? `, tous les ${o.backup.everyDays} jours` : ''} · dernière : ${fmt(o.lastBackup)}</small>` : ''}
      <div class="row">${o.url ? `<button class="btn" data-act="orgCheck">${ic('sync', 's')}Vérifier les mises à jour</button>` : ''}${o.backup ? `<button class="btn" data-act="orgBackup">${ic('upload', 's')}Sauvegarder maintenant</button>` : ''}<button class="btn danger" data-act="orgLeave">Quitter</button></div></div>`
    : `<p class="mute" style="font-size:14px">Votre entreprise vous a envoyé un lien ou un fichier de configuration ? Rejoignez-la pour recevoir ses onglets, plafonds, budgets et réglages GMAO.</p>
      <form id="orgJoinF" class="row"><input name="u" placeholder="Lien d'invitation ou adresse de configuration" style="flex:1 1 220px" required autocomplete="off"><button class="btn primary">Rejoindre</button></form>
      <button class="btn" data-act="importData">${ic('upload', 's')}Importer un fichier de configuration</button>`}
    ${S.ses.admin ? '' : '<p class="mute" style="font-size:13px">La configuration de l’organisation se gère dans la rubrique Admin.</p>'}`;
}
function orgSummary(k) {
  const st = S.settings;
  return { appearance: `${st.appName}, couleur ${st.accent}`, tabs: S.tabs.map(t => t.name).join(', '), rules: S.rules.length ? S.rules.map(ruleText).join(' · ') : 'aucun',
    budgets: S.budgets.length ? S.budgets.length + ' budget(s)' : 'aucun', gmao: st.gmaoUrl || 'adresse non renseignée', mistral: `${st.autoRead === false ? 'désactivée' : 'activée'}${proxy() ? '' : ', service non renseigné'}`,
    security: st.autoLockMin ? `après ${st.autoLockMin} min` : 'désactivé', backup: '' }[k];
}
function buildOrgConfig(d) {
  const st = S.settings;
  const adminLock = S.ses.newOrgLock || st.orgAdminLock || S.org?.adminLock || null;
  return { format: 'fraispilot-org', v: 1, id: d.id, name: d.name, logo: d.logo || '', version: Date.now(), updatedAt: new Date().toISOString(), modes: d.modes, adminLock,
    data: {
      appearance: { appName: st.appName, accent: st.accent, theme: st.theme },
      tabs: S.tabs.map(({ id, name, icon, color, remb, gmao, fixed }) => ({ id, name, icon, color, remb, gmao, fixed: !!fixed })),
      rules: S.rules.map(({ id, cat, per, limit, tabs }) => ({ id, cat, per, limit, tabs })),
      budgets: S.budgets.map(({ id, tabId, cat, per, amount }) => ({ id, tabId, cat, per, amount })),
      gmao: { url: st.gmaoUrl, imgs: !!st.gmaoImgs, inter: S.inter },
      mistral: { proxyUrl: st.proxyUrl, autoRead: st.autoRead !== false },
      security: { autoLockMin: st.autoLockMin },
      backup: { method: d.backup.method, url: d.backup.url, token: d.backup.token, everyDays: +d.backup.everyDays || 0 }
    } };
}
async function applyOrgConfig(cfg, url) {
  if (!cfg || cfg.format !== 'fraispilot-org' || !cfg.id || !cfg.data) throw new Error('Configuration d’organisation invalide');
  const M = cfg.modes || {}, D = cfg.data, first = !S.org || S.org.id !== cfg.id;
  const go = k => M[k] && M[k] !== 'off' && D[k] && (M[k] === 'impose' || first);
  const st = S.settings;
  if (go('appearance')) { const a = D.appearance; if (a.appName) st.appName = String(a.appName).slice(0, 24); if (/^#[0-9a-f]{6}$/i.test(a.accent)) st.accent = a.accent; if (['auto', 'light', 'dark'].includes(a.theme)) st.theme = a.theme; }
  if (go('tabs')) for (const t of D.tabs || []) {
    const v = { name: String(t.name || 'Onglet').slice(0, 30), icon: TAB_ICONS.includes(t.icon) ? t.icon : 'tag', color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#7048e8', remb: !!t.remb, gmao: !!t.gmao, org: true };
    const x = tabById(t.id); if (x) Object.assign(x, v); else { S.tabs.push({ id: String(t.id), ...v, lock: null, fixed: !!t.fixed }); if (!S.obj.tabs.includes(t.id)) S.obj.tabs.push(t.id); }
  }
  if (go('rules')) S.rules = S.rules.filter(r => !r.org && !(D.rules || []).some(x => x.id === r.id)).concat((D.rules || []).map(r => ({ id: r.id, cat: r.cat, per: PER[r.per] ? r.per : 'unite', limit: r2(r.limit), tabs: r.tabs || [], org: true })));
  if (go('budgets')) S.budgets = S.budgets.filter(b => !b.org && !(D.budgets || []).some(x => x.id === b.id)).concat((D.budgets || []).map(b => ({ id: b.id, tabId: b.tabId, cat: b.cat || '', per: ['jour', 'mois', 'an'].includes(b.per) ? b.per : 'mois', amount: r2(b.amount), org: true })));
  if (go('gmao')) { if (D.gmao.url) st.gmaoUrl = D.gmao.url; st.gmaoImgs = !!D.gmao.imgs; for (const i of D.gmao.inter || []) if (i.num && !S.inter.some(x => x.num === i.num)) S.inter.push(i); }
  if (go('mistral')) { if (D.mistral.proxyUrl) st.proxyUrl = D.mistral.proxyUrl; if (typeof D.mistral.autoRead === 'boolean') st.autoRead = D.mistral.autoRead; }
  if (go('security')) st.autoLockMin = Math.max(0, Math.min(120, +D.security.autoLockMin || 0));
  const al = cfg.adminLock && cfg.adminLock.salt && cfg.adminLock.hash ? { method: 'password', salt: cfg.adminLock.salt, hash: cfg.adminLock.hash, it: +cfg.adminLock.it || 100000 } : null;
  S.org = { adminLock: al, id: cfg.id, name: String(cfg.name || 'Organisation').slice(0, 60), logo: /^data:image\//.test(cfg.logo || '') ? cfg.logo : '', url: url ?? S.org?.url ?? '', version: cfg.version || Date.now(), modes: M,
    backup: M.backup && M.backup !== 'off' && D.backup ? D.backup : null, lastCheck: Date.now(), lastBackup: (!first && S.org?.lastBackup) || 0 };
  await Promise.all(['settings', 'tabs', 'rules', 'budgets', 'inter', 'obj', 'org'].map(save));
  applyTheme(); render();
}
function orgUrlFrom(u) { try { const x = new URL(u.trim()); return x.searchParams.get('org') || x.href; } catch { return ''; } }
async function fetchOrg(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('Configuration introuvable (' + r.status + ')');
  return r.json();
}
async function joinOrgUrl(u) {
  const url = orgUrlFrom(u); if (!url) { toast('Lien d’invitation invalide'); return; }
  let cfg; try { cfg = await fetchOrg(url); } catch (e) { toast(e.message.includes('fetch') ? 'Configuration injoignable (adresse, connexion ou autorisation CORS du serveur)' : e.message, 5000); return; }
  if (cfg?.format !== 'fraispilot-org') { toast('Ce lien ne contient pas de configuration FraisPilot'); return; }
  const imposes = Object.entries(cfg.modes || {}).filter(([, v]) => v === 'impose').map(([k]) => ORG_ITEMS[k]);
  if (!await confirmBox('Rejoindre ' + (cfg.name || 'l’organisation') + ' ?', `Cet appareil recevra la configuration de l'organisation et ses mises à jour.${imposes.length ? `<br><small>Imposé : ${esc(imposes.join(', '))}.</small>` : ''}<br><small>Vos dépenses restent sur cet appareil.</small>`, 'Rejoindre')) return;
  try { await applyOrgConfig(cfg, url); toast('Configuration « ' + S.org.name + ' » appliquée'); } catch (e) { toast(e.message); }
}
async function checkOrg(silent) {
  const o = S.org; if (!o?.url) return;
  if (silent && Date.now() - (o.lastCheck || 0) < 3600000) return;
  try {
    const cfg = await fetchOrg(o.url);
    if ((cfg.version || 0) > (o.version || 0)) { await applyOrgConfig(cfg, o.url); toast('Configuration mise à jour par ' + S.org.name, 4000); }
    else { o.lastCheck = Date.now(); await save('org'); if (!silent) { toast('Configuration à jour'); renderSettings(); openSection('Organisation'); } }
  } catch { if (!silent) toast('Mise à jour impossible : serveur de l’organisation injoignable', 4000); }
}
function orgBackupDue() { const b = S.org?.backup; return !!(b && b.everyDays > 0 && Date.now() - (S.org.lastBackup || 0) > b.everyDays * 86400000); }
function orgBackupCard() {
  if (!orgBackupDue()) return '';
  return `<div class="card"><div class="row"><div class="grow"><h3 style="margin:0">Sauvegarde à faire</h3><small>${esc(S.org.name)} demande une sauvegarde tous les ${S.org.backup.everyDays} jours${S.org.backup.method === 'url' ? ' (envoi automatique au serveur de l’entreprise)' : ' (fichier à déposer sur le Drive ou le serveur de l’entreprise)'}.</small></div>
    <button class="btn primary" data-act="orgBackup">${ic('upload', 's')}Sauvegarder</button></div></div>`;
}
async function backupData(withImg) {
  const imgs = {};
  if (withImg) for (const e of S.exps) for (const id of e.imgs || []) { const b = await DB.get('img', id).catch(() => null); if (b) imgs[id] = await toDataURL(b); }
  const st = { ...S.settings, apiKey: '', gmaoToken: '', orgAdminLock: null };
  return { app: 'FraisPilot', version: 1, exportedAt: new Date().toISOString(), utilisateur: S.account?.email, appareil: S.settings.deviceId, organisation: S.org?.id || '', settings: st, tabs: S.tabs, rules: S.rules, obj: S.obj, budgets: S.budgets, inter: S.inter, exps: S.exps, imgs };
}
async function runOrgBackup(silent = false) {
  const b = S.org?.backup; if (!b) return;
  const m = silent ? { close() {} } : modal(`<div class="status"><span class="spin"></span>Préparation de la sauvegarde…</div>`);
  try {
    const data = await backupData(true);
    const name = `sauvegarde-${(S.account?.email || 'fraispilot').replace(/[^\w.-]+/g, '_')}-${today()}.json`;
    if (b.method === 'url' && b.url) {
      const r = await fetch(b.url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(b.token ? { Authorization: 'Bearer ' + b.token } : {}) }, body: JSON.stringify({ fichier: name, ...data }) });
      if (!r.ok) throw new Error('Serveur de sauvegarde : erreur ' + r.status);
      m.close(); toast('Sauvegarde envoyée au serveur de ' + S.org.name);
    } else {
      m.close(); await download(name, new Blob([JSON.stringify(data)], { type: 'application/json' }));
      toast('Enregistrez le fichier sur le Drive ou le serveur de ' + S.org.name, 5000);
    }
    S.org.lastBackup = Date.now(); await save('org'); render();
  } catch (e) { m.close(); if (!silent) toast(e.message.includes('fetch') ? 'Serveur de sauvegarde injoignable' : e.message, 5000); }
}
async function smallLogo(file) {
  const im = await loadImg(file), k = Math.min(1, 160 / Math.max(im.width, im.height));
  const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/png');
}
function openOrgAdmin() {
  const st = S.settings;
  const d = st.orgDraft ? structuredClone(st.orgDraft) : { id: '', name: S.org?.name || '', logo: S.org?.logo || '', url: '',
    modes: { appearance: 'impose', tabs: 'impose', rules: 'impose', budgets: 'propose', gmao: 'impose', mistral: 'impose', security: 'impose', backup: 'impose' },
    backup: { method: 'fichier', url: '', token: '', everyDays: 7 } };
  const m = modal(`<div class="hd"><h2>Configuration de l'organisation</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div>
    <p class="mute" style="font-size:14px">La configuration diffusée est celle de cet appareil : réglez d'abord apparence, onglets, plafonds, budgets et GMAO, puis publiez. Chaque appareil de la flotte la reçoit et se met à jour à l'ouverture. Aucun mot de passe ni jeton personnel n'est diffusé.</p>
    <form id="oaF" style="display:grid;gap:12px">
      <div class="grid2"><label class="f">Nom de l'organisation<input name="name" required maxlength="60" value="${esc(d.name)}" placeholder="Ex. Entreprise Démo"></label>
      <label class="f">Logo<input type="file" name="logo" accept="image/*"></label></div>
      ${d.logo ? `<img src="${esc(d.logo)}" alt="" class="orglogo" id="oaLogo">` : '<img alt="" class="orglogo" id="oaLogo" hidden>'}
      <div style="display:grid;gap:8px">${Object.entries(ORG_ITEMS).filter(([k]) => k !== 'backup').map(([k, lbl]) => `<div class="trow oarow"><div><b>${esc(lbl)}</b><br><small class="mute">${esc(orgSummary(k))}</small></div>
        <select name="m_${k}" aria-label="Diffusion : ${esc(lbl)}">${Object.entries(ORG_MODES).map(([v, l]) => `<option value="${v}" ${d.modes[k] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`).join('')}</div>
      <div class="trow"><b>Sauvegarde des appareils</b>
        <div class="grid2"><label class="f">Méthode<select name="bm"><option value="off" ${d.modes.backup === 'off' ? 'selected' : ''}>Aucune sauvegarde imposée</option><option value="fichier" ${d.modes.backup !== 'off' && d.backup.method === 'fichier' ? 'selected' : ''}>Fichier à déposer sur le Drive ou le serveur (partage du téléphone)</option><option value="url" ${d.modes.backup !== 'off' && d.backup.method === 'url' ? 'selected' : ''}>Envoi automatique au serveur de l'entreprise</option></select></label>
        <label class="f">Rappel tous les (jours)<input name="bd" type="number" min="0" max="90" value="${+d.backup.everyDays || 0}"></label></div>
        <div class="grid2"><label class="f">Adresse du serveur de sauvegarde<input name="bu" type="url" value="${esc(d.backup.url)}" placeholder="https://serveur.entreprise.fr/sauvegardes"></label>
        <label class="f">Jeton d'envoi (facultatif)<input name="bt" type="password" value="${esc(d.backup.token)}" autocomplete="off"></label></div>
        <small class="mute">L'envoi automatique exige un serveur qui accepte les envois de l'appli (POST JSON, autorisation CORS). Sinon, le fichier se dépose sur le Drive ou le NAS depuis le partage du téléphone.</small></div>
      <div class="trow"><b>Diffusion</b>
        <label class="f">Adresse de diffusion personnalisée (facultatif)<input name="du" type="url" value="${esc(d.url)}" placeholder="${proxy() ? esc(proxy() + '/org/…') : 'https://serveur.entreprise.fr/fraispilot.json'}"></label>
        <small class="mute">Vide : la configuration est publiée sur le serveur relais FraisPilot. Sinon, exportez le fichier et déposez-le à cette adresse sur votre serveur.</small></div>
      <div class="row"><button type="button" class="btn" id="oaExp">${ic('download', 's')}Exporter le fichier</button><button type="button" class="btn" id="oaLink">${ic('upload', 's')}Copier le lien d'invitation</button><span class="grow"></span><button class="btn primary">${ic('sync', 's')}Publier pour toute la flotte</button></div>
    </form>`, { wide: true });
  const el = m.el, f = $('#oaF', el);
  f.elements.logo.onchange = async () => { const fl = f.elements.logo.files[0]; if (!fl) return; d.logo = await smallLogo(fl); const i = $('#oaLogo', el); i.src = d.logo; i.hidden = false; };
  const read = () => {
    const E = f.elements; d.name = E.name.value.trim();
    if (!d.id) d.id = (norm(d.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'org') + '-' + uid().slice(-5);
    Object.keys(ORG_ITEMS).forEach(k => { if (k !== 'backup') d.modes[k] = E['m_' + k].value; });
    d.modes.backup = E.bm.value === 'off' ? 'off' : 'impose'; d.backup = { method: E.bm.value === 'url' ? 'url' : 'fichier', url: E.bu.value.trim(), token: E.bt.value, everyDays: +E.bd.value || 0 };
    d.url = E.du.value.trim();
    return d;
  };
  const distUrl = () => d.url || (proxy() ? proxy() + '/org/' + d.id : '');
  const keep = async () => { st.orgDraft = structuredClone(d); await save('settings'); };
  $('#oaExp', el).onclick = async () => { if (!f.reportValidity()) return; read(); await keep(); download(`organisation-${d.id}.json`, new Blob([JSON.stringify(buildOrgConfig(d), null, 1)], { type: 'application/json' })); };
  $('#oaLink', el).onclick = async () => {
    if (!f.reportValidity()) return; read(); await keep();
    const u = distUrl(); if (!u) { toast('Renseignez une adresse de diffusion ou le serveur relais (Réglages › Lecture automatique)', 5000); return; }
    const link = APP_URL + '?org=' + encodeURIComponent(u);
    try { await navigator.clipboard.writeText(link); toast('Lien d’invitation copié : envoyez-le aux membres de l’organisation'); } catch { infoBox('Lien d’invitation', `<textarea rows="3" readonly>${esc(link)}</textarea>`); }
  };
  f.onsubmit = async ev => {
    ev.preventDefault(); read(); await keep();
    const cfg = buildOrgConfig(d);
    try {
      let url = d.url;
      if (!cfg.adminLock) throw new Error('Créez d’abord le code administrateur de l’organisation (rubrique Admin).');
      if (!url) {
        if (!proxy()) throw new Error('Publication : renseignez le service de lecture (rubrique Admin) ou une adresse de diffusion personnalisée.');
        let code = S.ses.orgCode;
        if (!code || !(await checkLock(code, st.orgAdminLock || S.org?.adminLock))) { code = await askOrgCode('Code administrateur de l’organisation'); if (!code) return; if (!(await checkLock(code, st.orgAdminLock || S.org?.adminLock || cfg.adminLock))) throw new Error('Code administrateur de l’organisation incorrect'); S.ses.orgCode = code; }
        const r = await fetch(proxy() + '/org/' + encodeURIComponent(d.id), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Org-Code': code }, body: JSON.stringify(cfg) });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Publication refusée (' + r.status + ')');
        url = proxy() + '/org/' + d.id;
      }
      if (S.ses.newOrgLock) { st.orgAdminLock = S.ses.newOrgLock; S.ses.orgCode = S.ses.newOrgCode; S.ses.newOrgLock = null; await save('settings'); }
      await applyOrgConfig(cfg, url);
      m.close(); renderSettings(); openSection('Organisation');
      toast(d.url ? 'Configuration prête : exportez le fichier et déposez-le à l’adresse de diffusion' : 'Configuration publiée : la flotte la reçoit à la prochaine ouverture', 5000);
    } catch (e) { toast(e.message.includes('fetch') ? 'Serveur relais injoignable' : e.message, 5000); }
  };
}

/* ---------- Admin : un seul accès pour tous les administrateurs, ouvert uniquement par code ---------- */
async function adminRole(code) {
  if (await checkLock(cleanCode(code), OWNER_LOCK)) return 'owner';
  for (const l of [S.org?.adminLock, S.settings.orgAdminLock]) if (l && await checkLock(code, l)) return 'org';
  return null;
}
function adminSectionHtml() {
  const a = S.ses.admin, st = S.settings;
  if (!a) {
    const canCreate = plan().org && !S.org?.adminLock && !st.orgAdminLock;
    return `<p class="mute" style="font-size:14px">Réservé aux administrateurs (administrateur principal ou de l'organisation). Seul le code administrateur donne accès.</p>
      <form id="adF" class="row"><input name="c" type="password" autocomplete="off" placeholder="Code administrateur" style="flex:1 1 200px" required><button class="btn primary">${ic('unlock', 's')}Ouvrir</button></form>
      ${canCreate ? `<details><summary class="linkbtn" style="display:inline-block">Première utilisation : créer le code administrateur de l'organisation</summary>
        <form id="adNewF" style="display:grid;gap:10px;margin-top:8px"><input name="c1" type="password" minlength="8" placeholder="Nouveau code (8 caractères minimum)" required autocomplete="new-password"><input name="c2" type="password" minlength="8" placeholder="Confirmer le code" required autocomplete="new-password"><button class="btn">Créer le code</button></form></details>` : ''}`;
  }
  return `<div class="status ok">${ic('check', 's')}${a === 'owner' ? 'Administrateur principal' : (S.org?.name ? 'Administrateur de l’organisation « ' + esc(S.org.name) + ' »' : 'Administrateur de l’organisation (pas encore diffusée)')} : accès ouvert jusqu'au verrouillage de l'appli.</div>
    <div class="trow"><b>Service de lecture automatique</b>
      <p class="mute" style="font-size:13px">Renseigné une seule fois : tous les appareils de l'organisation le reçoivent avec la configuration diffusée.</p>
      <label class="f">Adresse du service<input type="url" data-k="settings.proxyUrl" value="${esc(st.proxyUrl)}" placeholder="${esc(DEFAULT_PROXY || 'https://fraispilot-api.votre-compte.workers.dev')}"></label>
      <label class="f">Clé directe (essai sur cet appareil uniquement)<input type="password" data-k="settings.apiKey" value="${esc(st.apiKey)}" autocomplete="off"></label>
      <div class="row"><button class="btn" data-act="testOcr">${ic('check', 's')}Tester</button></div></div>
    ${plan().org ? `<div class="trow"><b>Organisation</b><p class="mute" style="font-size:14px">Réglez cet appareil (apparence, onglets, plafonds, budgets, GMAO, lecture automatique…), puis diffusez la configuration à toute la flotte en une fois.</p>
      <div class="row"><button class="btn primary" data-act="orgAdmin">${ic('briefcase', 's')}Configurer et diffuser</button><button class="btn" data-act="orgCode">Changer le code administrateur</button></div></div>` : ''}
    ${a === 'owner' ? `<div class="trow"><b>Administrateur principal</b><p class="mute" style="font-size:13px">Toutes les options et scans illimités sur cet appareil. Identifiant à déclarer dans le service de lecture (OWNER_DEVICES) : <code>${esc(st.deviceId)}</code></p>
      <label class="f">Publicité : identifiant éditeur AdSense<input data-k="settings.adClient" value="${esc(st.adClient)}" placeholder="ca-pub-0000000000000000"></label>
      <label class="f">Identifiant du bloc d'annonce<input data-k="settings.adSlot" value="${esc(st.adSlot)}"></label>
      <button class="btn" data-act="ownerOff">Retirer les droits administrateur de cet appareil</button></div>` : ''}
    <button class="btn" data-act="adminClose">${ic('lock', 's')}Fermer l'admin</button>`;
}
function bindAdmin() {
  const f = $('#adF');
  if (f) f.onsubmit = async e => {
    e.preventDefault(); const c = e.target.c.value, role = await adminRole(c);
    if (!role) { toast('Code incorrect'); e.target.c.value = ''; return; }
    S.ses.admin = role; if (role === 'org') S.ses.orgCode = c;
    if (role === 'owner' && !S.settings.owner) { S.settings.owner = true; S.settings.planDemo = false; await save('settings'); }
    render(); openSection('Admin'); toast('Admin ouvert');
  };
  const n = $('#adNewF');
  if (n) n.onsubmit = async e => {
    e.preventDefault(); const a = e.target.c1.value, b = e.target.c2.value;
    if (a.length < 8) { toast('8 caractères minimum'); return; } if (a !== b) { toast('Les deux codes diffèrent'); return; }
    S.settings.orgAdminLock = await makeLock('password', a, 100000); await save('settings');
    S.ses.admin = 'org'; S.ses.orgCode = a; render(); openSection('Admin'); toast('Code administrateur créé : gardez-le précieusement');
  };
}
function askOrgCode(title) {
  return new Promise(res => {
    let v = null;
    const m = modal(`<div class="hd"><h2>${esc(title)}</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div>
      <form id="ocF" style="display:grid;gap:12px"><input name="c" type="password" autocomplete="off" required placeholder="Code administrateur de l'organisation"><button class="btn primary">Valider</button></form>`, { onClose: () => res(v) });
    setTimeout(() => $('#ocF input', m.el)?.focus(), 250);
    $('#ocF', m.el).onsubmit = e => { e.preventDefault(); v = e.target.c.value; m.close(); };
  });
}

/* ---------- Hors connexion : tout fonctionne, puis lecture et envois au retour du réseau ---------- */
let pendingRun = false;
async function processPending() {
  if (pendingRun || !navigator.onLine || !S.ses.unlocked) return;
  pendingRun = true;
  try {
    if (S.settings.autoRead !== false) {
      let n = 0;
      for (const e of S.exps.filter(x => x.ocrPending && x.imgs?.length)) {
        const b = await DB.get('img', e.imgs[0]).catch(() => null);
        if (!b) { e.ocrPending = false; await saveExp(e); continue; }
        try {
          const d = await ocrBlob(b);
          if (!e.merchant || e.merchant === e.fileName) e.merchant = d.merchant || e.merchant;
          if (!(e.amount > 0)) e.amount = d.amount; if (!(e.vat > 0)) e.vat = d.vat;
          if (!e.cat || e.cat === 'Autre') e.cat = d.cat; if (d.date) e.date = d.date; if (!e.pay) e.pay = d.pay;
          if (d.qty > 1 && (e.qty || 1) === 1) e.qty = d.qty; if (d.note && !e.note) e.note = d.note;
          e.ocrPending = false; e.check = true; await saveExp(e); n++;
        } catch (x) { if (x.code === 'quota' || x.code === 'config' || x.code === 'pause' || x.name === 'TypeError') break; }
      }
      if (n) toast(`${n} justificatif(s) lu(s) au retour du réseau : à vérifier`, 4500);
    }
    if (S.settings.autoSync !== false) await syncGmao(true);
    await gmaoRetirees();
    await syncNow(true);
    if (S.org?.url) await checkOrg(true);
    if (S.org?.backup?.method === 'url' && S.org.backup.url && orgBackupDue()) await runOrgBackup(true);
  } finally { pendingRun = false; if (S.ses.unlocked) render(); }
}
window.addEventListener('online', () => { if (S.ses.unlocked) { renderChrome(); processPending(); } });
window.addEventListener('offline', () => { if (S.ses.unlocked) renderChrome(); });
setInterval(() => { if (S.ses.unlocked && !document.hidden) syncNow(true); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.ses.unlocked) setTimeout(() => { gmaoRetirees().then(() => syncNow(true)); }, 500); });

/* ---------- Actions ---------- */
const ACT = {
  syncOn: async () => { await startSync(syncCode(), false); },
  syncJoin: async () => {
    const c = await new Promise(res => { let v = ''; const m = modal(`<div class="hd"><h2>Relier cet appareil</h2></div><p>Tape le code affiché sur ton autre appareil (Réglages › Mes appareils).</p><form id="sjF"><input name="c" placeholder="ABCD-EFGH-JKLM-NPQR" autocapitalize="characters" autocomplete="off" style="font:600 18px ui-monospace,monospace"><div class="row end" style="margin-top:12px"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Relier</button></div></form>`, { onClose: () => res(v) }); $('#sjF', m.el).onsubmit = e => { e.preventDefault(); v = e.target.c.value; m.close(); }; });
    if (c) await startSync(c, true);
  },
  syncGo: async () => { await gmaoRetirees(); await syncNow(false); renderSettings(); openSection('appareils'); },
  syncShare: async () => {
    const link = syncLink();
    try { if (navigator.share) { await navigator.share({ title: S.settings.appName + ' — relier un appareil', text: 'Ouvre ce lien sur ton autre appareil pour retrouver tes dépenses :', url: link }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(link); toast('Lien copié : colle-le dans un mail ou un message pour toi'); } catch { infoBox('Lien de liaison', `<textarea rows="3" readonly>${esc(link)}</textarea>`); }
  },
  syncOff: async () => {
    if (!await confirmBox('Arrêter la synchronisation ?', 'Cet appareil garde ses dépenses actuelles mais ne recevra plus celles de tes autres appareils.', 'Arrêter', true)) return;
    SY = null; syncK = null; await DB.del('kv', 'syncst').catch(() => {}); renderSettings(); openSection('appareils'); toast('Synchronisation arrêtée sur cet appareil');
  },
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
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'erreur ' + r.status); $('#mailF').hidden = false; toast('Code envoyé par mail (valable 15 minutes)'); }
    catch (e) { toast('Envoi impossible : ' + (e.name === 'TypeError' ? 'service injoignable' : e.message), 6000); b.disabled = false; }
  },
  homeTab: async b => {
    const id = b.dataset.id; if (!await selectTab(id)) return;
    const o = S.obj.tabs; if (o.includes(id) && tabOpen(id) && b.classList.contains('on')) S.obj.tabs = o.filter(x => x !== id); else if (!o.includes(id)) o.push(id);
    await save('obj'); renderHome();
  },
  tab: async b => { const id = b.dataset.id; if (id !== 'all' && !await selectTab(id)) return; S.ses.tab = id; S.ses.month = ''; renderList(); },
  unlockTab: async b => { if (await selectTab(b.dataset.id)) renderList(); },
  recTab: async b => { const id = b.dataset.id; if (!await selectTab(id)) return; const R = S.ses.recap; if (!R.tabs) R.tabs = []; if (R.tabs.includes(id) && b.classList.contains('on')) R.tabs = R.tabs.filter(x => x !== id); else if (!R.tabs.includes(id)) R.tabs.push(id); renderRecap(); },
  homePer: async b => { const id = b.dataset.id, P = S.obj.periods; S.obj.periods = P.includes(id) ? P.filter(x => x !== id) : [...P, id]; await save('obj'); renderHome(); },
  homeCumul: async () => {
    if (!S.obj.cumul && !await confirmBox('Cumuler les onglets ?', 'Le cumul additionne les dépenses de tous les onglets affichés, par exemple professionnelles et personnelles.<br><b>Ce total mélange des dépenses de nature différente</b> : il est indicatif et ne correspond pas à un montant à rembourser.', 'Afficher le cumul')) return;
    S.obj.cumul = !S.obj.cumul; await save('obj'); renderHome();
  },
  budget: async b => { const id = b.dataset.id; if (!await selectTab(id)) return; editBudget(id); },
  ownerOn: () => {
    const m = modal(`<div class="hd"><h2>Administrateur principal</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div><form id="owF" style="display:grid;gap:12px"><label class="f">Code administrateur<input name="c" type="password" autocomplete="off" autocapitalize="characters" required placeholder="VAL-XXXX-XXXX-XXXX"></label><button class="btn primary big">Activer</button></form>`);
    setTimeout(() => $('#owF input', m.el)?.focus(), 250);
    $('#owF', m.el).onsubmit = async e => { e.preventDefault(); if (!await checkLock(cleanCode(e.target.c.value), OWNER_LOCK)) { toast('Code incorrect'); e.target.c.value = ''; return; }
      S.settings.owner = true; S.settings.planDemo = false; await save('settings'); m.close(); render(); toast('Accès administrateur principal activé'); };
  },
  ownerOff: async () => { if (!await confirmBox('Retirer les droits administrateur ?', 'Cet appareil reviendra au plan choisi dans Abonnement.', 'Retirer')) return; S.settings.owner = false; S.ses.admin = null; await save('settings'); render(); },
  orgAdmin: () => { if (!S.ses.admin) { toast('Ouvrez d’abord la rubrique Admin avec votre code'); return; } openOrgAdmin(); },
  adminClose: () => { S.ses.admin = null; S.ses.orgCode = ''; render(); openSection('Admin'); toast('Admin fermé'); },
  orgCode: async () => {
    if (!S.ses.admin) return;
    const m = modal(`<div class="hd"><h2>Code administrateur de l'organisation</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ic('x')}</button></div>
      <form id="ncF" style="display:grid;gap:10px"><input name="c1" type="password" minlength="8" placeholder="Nouveau code (8 caractères minimum)" required autocomplete="new-password"><input name="c2" type="password" minlength="8" placeholder="Confirmer" required autocomplete="new-password"><button class="btn primary">Enregistrer</button>
      <small class="mute">Publiez ensuite la configuration : le nouveau code remplace l'ancien sur toute la flotte.</small></form>`);
    $('#ncF', m.el).onsubmit = async e => { e.preventDefault(); const a = e.target.c1.value; if (a !== e.target.c2.value) { toast('Les deux codes diffèrent'); return; }
      S.ses.newOrgLock = await makeLock('password', a, 100000); S.ses.newOrgCode = a; m.close(); toast('Nouveau code prêt : publiez la configuration pour l’appliquer'); };
  },
  orgCheck: () => checkOrg(false),
  orgBackup: () => runOrgBackup(),
  orgLeave: async () => { if (!await confirmBox('Quitter ' + S.org.name + ' ?', 'Les réglages déjà reçus restent sur cet appareil et redeviennent modifiables. Les mises à jour de l’organisation ne seront plus reçues.', 'Quitter', true)) return; S.org = null; S.tabs.forEach(t => delete t.org); S.rules.forEach(r => delete r.org); S.budgets.forEach(b => delete b.org); await Promise.all(['org', 'tabs', 'rules', 'budgets'].map(save)); render(); },
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
    if (proxy()) { try { const r = await fetch(proxy() + '/health'); const j = await r.json(); toast(r.ok ? `Service de lecture ${j.mistral ? 'prêt' : 'joignable, clé non configurée'}` : 'Service de lecture : erreur ' + r.status, 4000); } catch { toast('Serveur relais injoignable', 4000); } return; }
    if (S.settings.apiKey) { try { const r = await fetch(MISTRAL.base + '/models', { headers: { Authorization: 'Bearer ' + S.settings.apiKey.trim() } }); toast(r.ok ? 'Clé valide' : 'Clé refusée (' + r.status + ')', 4000); } catch { toast('Service injoignable depuis ce navigateur', 4000); } return; }
    toast('Renseignez l’adresse du service de lecture');
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
  if (el.name === 'ar' && el.hasAttribute('data-act-ar')) { S.settings.autoRead = el.value === 'on'; await save('settings'); toast(S.settings.autoRead ? 'Lecture automatique activée' : 'Lecture automatique désactivée'); return; }
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
  if (!Array.isArray(S.obj?.periods)) S.obj = { periods: ['mois'], tabs: (S.obj?.tabs || ['pro']).slice(0, 1), cumul: false };
  if (!Array.isArray(S.budgets)) S.budgets = [];
  S.exps = (await DB.all('exp').catch(() => [])) || [];
  SY = await DB.get('kv', 'syncst').catch(() => null) || null;
  if (SY && !SY.dead) SY.dead = {};
  await save('settings');
  applyTheme(); showLock();
  if ('serviceWorker' in navigator && !IN_FRAME && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
}
