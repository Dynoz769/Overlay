// SISTEM LIVE — overlay server untuk stream Mobile Legends & Magic Chess
// Tiada dependency. Jalankan: node server.js   (default port 8799)
//
//   OBS Browser Source : http://127.0.0.1:8799/overlay.html
//   Control panel      : http://127.0.0.1:8799/control.html   (buka dalam Chrome)
//   Stream Deck        : http://127.0.0.1:8799/spell?i=1 ... (lihat README)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8799);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC = path.join(__dirname, 'public');
const STATE_FILE = path.join(__dirname, 'state.json');

const SPELL_CD = {
  flicker: 120, retribution: 35, inspire: 75, execute: 90, purify: 90,
  sprint: 100, revitalize: 100, aegis: 90, petrify: 90, vengeance: 75,
  flameshot: 50, arrival: 75,
};

const DEFAULT_STATE = {
  mode: 'ml', // 'ml' | 'mc'
  badge: 'SISTEM LIVE',
  record: { w: 0, l: 0 },
  enemies: [
    { hero: 'Lesley', spell: 'flicker', cd: 120, endsAt: 0 },
    { hero: 'Miya', spell: 'inspire', cd: 75, endsAt: 0 },
    { hero: 'Fanny', spell: 'retribution', cd: 35, endsAt: 0 },
    { hero: 'Hirara', spell: 'flicker', cd: 120, endsAt: 0 },
    { hero: 'Kaja', spell: 'flicker', cd: 120, endsAt: 0 },
  ],
  draft: { ally: [], enemy: [], bans: [], myHero: '' },
  promos: [
    { icon: 'crown', title: 'JOKI RANK', sub: 'MURAH & PANTAS' },
    { icon: 'vip', title: 'MABAR VIP', sub: 'RM5 / GAME · IMMORTAL' },
    { icon: 'album', title: 'KOMEN ALBUM', sub: 'RM4 · MAINKAN ALBUM KAU' },
  ],
  mc: { round: '1-1', hp: 100, gold: 0, level: 1, streak: 0, synergies: [] },
  show: { spells: true, promo: true, badge: true, record: true, mc: true },
  // Auto detect (auto.html). Kawasan = pecahan (0-1) dari frame yang ditangkap.
  auto: {
    ign: '',            // nama in-game kau — untuk kenal team kau di loading screen
    mainHero: '',       // hero utama — untuk ban suggestion masa fasa ban
    allyRow: 'auto',    // loading screen: 'auto' | 'top' | 'bottom'
    on: { draft: true, loading: true, kill: true, result: true, items: false, mc: true, capture: true, allyKillsOnly: true },
    items: { mode: 'inventory', slots: 6, dir: 'horizontal' },
    regions: {
      banner: { x: 0.28, y: 0.08, w: 0.44, h: 0.26 },
      result: { x: 0.15, y: 0.12, w: 0.70, h: 0.45 },
      items: { x: 0.30, y: 0.86, w: 0.40, h: 0.12 },
      mcRound: { x: 0.44, y: 0.00, w: 0.12, h: 0.07 },
      mcGold: { x: 0.80, y: 0.88, w: 0.12, h: 0.08 },
      mcHp: { x: 0.00, y: 0.15, w: 0.10, h: 0.08 },
      mcRank: { x: 0.30, y: 0.25, w: 0.40, h: 0.30 },
    },
  },
};

let state = loadState();

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return deepMerge(structuredClone(DEFAULT_STATE), s);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), () => {});
  }, 300);
}

function deepMerge(target, src) {
  for (const [k, v] of Object.entries(src || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

// ---------- Server-Sent Events ----------
const clients = new Set();
function broadcast(msg) {
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of clients) res.write(data);
}
function pushState() {
  broadcast({ type: 'state', state, now: Date.now() });
  saveState();
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 15000);

// ---------- Actions (dikongsi oleh API & URL Stream Deck) ----------
const SPELL_ALIAS = {
  flicker: 'flicker', flick: 'flicker', flik: 'flicker', fliker: 'flicker', blink: 'flicker',
  retri: 'retribution', retribution: 'retribution', retribut: 'retribution', ret: 'retribution',
  inspire: 'inspire', insp: 'inspire', execute: 'execute', exe: 'execute', purify: 'purify',
  sprint: 'sprint', revitalize: 'revitalize', heal: 'revitalize', aegis: 'aegis', shield: 'aegis',
  petrify: 'petrify', vengeance: 'vengeance', venge: 'vengeance', flameshot: 'flameshot', arrival: 'arrival',
};

function startSpell(i, spell) {
  const e = state.enemies[i];
  if (!e) return false;
  if (spell) {
    const s = SPELL_ALIAS[String(spell).toLowerCase()];
    if (s) { e.spell = s; e.cd = SPELL_CD[s]; }
  }
  e.endsAt = Date.now() + e.cd * 1000;
  broadcast({ type: 'event', event: { kind: 'spell', index: i, hero: e.hero, spell: e.spell, cd: e.cd } });
  pushState();
  return true;
}

function resetSpells(i) {
  state.enemies.forEach((e, idx) => { if (i == null || idx === i) e.endsAt = 0; });
  pushState();
}

function fire(event) {
  if (event.kind === 'win') state.record.w++;
  if (event.kind === 'lose') state.record.l++;
  if (event.kind === 'win' || event.kind === 'lose') {
    event.w = state.record.w; event.l = state.record.l;
    resetSpells();
  }
  broadcast({ type: 'event', event });
}

const ASSET_DIRS = { heroes: 'heroes', items: 'items', unknown: 'items/_unknown', template: 'templates', templates: 'templates' };

// ---------- HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff2': 'font/woff2',
};

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(body);
}
function json(res, obj, code = 200) { send(res, code, JSON.stringify(obj), 'application/json'); }

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const q = Object.fromEntries(url.searchParams);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST' });
    return res.end();
  }

  // SSE stream
  if (p === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    res.write(`data: ${JSON.stringify({ type: 'state', state, now: Date.now() })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // ----- JSON API -----
  if (p === '/api/state' && req.method === 'GET') return json(res, state);
  if (p === '/api/state' && req.method === 'POST') {
    const patch = await readBody(req);
    if (patch.__replace) { delete patch.__replace; Object.assign(state, patch); } else deepMerge(state, patch);
    pushState();
    return json(res, { ok: true });
  }
  if (p === '/api/event' && req.method === 'POST') {
    const ev = await readBody(req);
    if (!ev.kind) return json(res, { ok: false, error: 'kind diperlukan' }, 400);
    fire(ev);
    return json(res, { ok: true });
  }
  if (p === '/api/spell' && req.method === 'POST') {
    const b = await readBody(req);
    if (b.reset) { resetSpells(b.index ?? null); return json(res, { ok: true }); }
    return json(res, { ok: startSpell(Number(b.index), b.spell) });
  }

  // ----- URL ringkas untuk Stream Deck / hotkey (GET) -----
  if (p === '/spell') {
    if ('reset' in q) { resetSpells(q.i ? Number(q.i) - 1 : null); return send(res, 200, 'OK reset'); }
    const ok = startSpell(Number(q.i) - 1, q.s);
    return send(res, ok ? 200 : 400, ok ? `OK spell ${q.i}` : 'i mesti 1-5');
  }
  if (p === '/kill') { fire({ kind: 'kill', type: q.t || 'solo', hero: q.hero, victim: q.victim }); return send(res, 200, 'OK kill'); }
  if (p === '/item') { fire({ kind: 'item', id: q.id || q.n }); return send(res, 200, 'OK item'); }
  if (p === '/fullbuild') { fire({ kind: 'fullbuild' }); return send(res, 200, 'OK fullbuild'); }
  if (p === '/win') { fire({ kind: 'win' }); return send(res, 200, 'OK win'); }
  if (p === '/lose') { fire({ kind: 'lose' }); return send(res, 200, 'OK lose'); }
  if (p === '/draft') { fire({ kind: 'draft', view: q.v || 'cycle' }); return send(res, 200, 'OK draft'); }
  if (p === '/mc') { fire({ kind: 'mc', type: q.t || 'win', text: q.text, place: q.place }); return send(res, 200, 'OK mc'); }
  if (p === '/mode') { state.mode = q.m === 'mc' ? 'mc' : 'ml'; pushState(); return send(res, 200, 'OK mode ' + state.mode); }

  // ----- Gambar yang ditangkap dari skrin (auto detect) -----
  if (p === '/api/assets' && req.method === 'GET') {
    const dir = ASSET_DIRS[q.dir] || 'items';
    const full = path.join(PUBLIC, 'assets', dir);
    fs.mkdirSync(full, { recursive: true });
    return json(res, fs.readdirSync(full).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)));
  }
  if (p === '/api/capture' && req.method === 'POST') {
    // { type: 'hero'|'item'|'unknown', name, dataUrl, force }
    const b = await readBody(req);
    const m = /^data:image\/png;base64,(.+)$/.exec(b.dataUrl || '');
    const name = String(b.name || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/(^-|-$)/g, '');
    if (!m || !name) return json(res, { ok: false, error: 'dataUrl/name tak sah' }, 400);
    const dir = ASSET_DIRS[b.type === 'hero' ? 'heroes' : b.type] || 'items';
    const full = path.join(PUBLIC, 'assets', dir);
    fs.mkdirSync(full, { recursive: true });
    const file = path.join(full, name + '.png');
    if (fs.existsSync(file) && !b.force) return json(res, { ok: true, skipped: true });
    fs.writeFileSync(file, Buffer.from(m[1], 'base64'));
    if (b.type === 'unknown') broadcast({ type: 'unknown', name });
    if (b.type === 'template') broadcast({ type: 'templates' });
    return json(res, { ok: true });
  }
  if (p === '/api/asset-delete' && req.method === 'POST') {
    const b = await readBody(req);
    const dir = ASSET_DIRS[b.dir];
    const name = String(b.name || '').replace(/[^a-z0-9_-]/gi, '');
    const file = dir && name && path.join(PUBLIC, 'assets', dir, name + '.png');
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
    broadcast({ type: b.dir === 'templates' ? 'templates' : 'library' });
    return json(res, { ok: true });
  }
  if (p === '/api/label' && req.method === 'POST') {
    // tukar ikon unknown → ikon item sebenar (sekali label, lepas tu auto selamanya)
    const b = await readBody(req);
    const src = path.join(PUBLIC, 'assets', 'items', '_unknown', String(b.unknown).replace(/[^a-z0-9_-]/gi, '') + '.png');
    if (!fs.existsSync(src)) return json(res, { ok: false }, 404);
    if (b.id === '__delete') { fs.unlinkSync(src); return json(res, { ok: true }); }
    const id = String(b.id || '').replace(/[^a-z0-9_-]/gi, '');
    if (!id) return json(res, { ok: false }, 400);
    fs.renameSync(src, path.join(PUBLIC, 'assets', 'items', id + '.png'));
    broadcast({ type: 'library' });
    if (b.fire) fire({ kind: 'item', id });
    return json(res, { ok: true });
  }

  // ----- OCR engine (tesseract.js) dari node_modules -----
  const VENDOR = {
    '/vendor/tesseract/': path.join(__dirname, 'node_modules', 'tesseract.js', 'dist'),
    '/vendor/core/': path.join(__dirname, 'node_modules', 'tesseract.js-core'),
    '/vendor/lang/': path.join(__dirname, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int'),
  };
  for (const [prefix, dir] of Object.entries(VENDOR)) {
    if (p.startsWith(prefix)) {
      const full = path.normalize(path.join(dir, p.slice(prefix.length)));
      if (!full.startsWith(dir)) return send(res, 403, 'forbidden');
      return fs.readFile(full, (err, buf) => err
        ? send(res, 404, 'OCR engine tiada — jalankan "npm install" dulu')
        : send(res, 200, buf, MIME[path.extname(full)] || (full.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream')));
    }
  }

  // ----- Static -----
  let file = p === '/' ? '/control.html' : decodeURIComponent(p);
  const full = path.normalize(path.join(PUBLIC, file));
  if (!full.startsWith(PUBLIC)) return send(res, 403, 'forbidden');
  fs.readFile(full, (err, buf) => {
    if (err) return send(res, 404, 'not found');
    send(res, 200, buf, MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n  SISTEM LIVE berjalan`);
  console.log(`  Overlay (OBS) : http://${HOST}:${PORT}/overlay.html`);
  console.log(`  Control panel : http://${HOST}:${PORT}/control.html\n`);
});
