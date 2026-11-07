// AUTO DETECT — tangkap skrin game, baca dengan OCR, dan trigger overlay sendiri.
//   Draft pick   : baca nama hero ally (kiri) & enemy (kanan) → kad Enemy Pick, Ban Suggestion
//   Loading      : 10 hero → Win Prediction + Power Spike, isi spell timer, TANGKAP GAMBAR hero
//   In-game      : banner kill (Savage, Maniac, First Blood…) & VICTORY / DEFEAT
//   Item         : ikon baru dalam slot → kad item (ikon ditangkap dari skrin)
//   Magic Chess  : round / HP / gold / kedudukan akhir
(function () {
  const D = window.MLDATA;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({}));
  const patch = (p) => post('/api/state', p);
  const fire = (ev) => { log(`▶ ${ev.kind}${ev.type ? ' · ' + ev.type : ''}${ev.id ? ' · ' + ev.id : ''}${ev.hero ? ' · ' + ev.hero : ''}${ev.view ? ' · ' + ev.view : ''}`, 'ev'); return post('/api/event', ev); };

  // ---------- log ----------
  function log(t, cls = '') {
    const d = document.createElement('div');
    const vt = typeof video !== 'undefined' && video.src && !video.srcObject ? ` [video ${video.currentTime.toFixed(1)}s]` : '';
    d.className = cls; d.textContent = `${new Date().toLocaleTimeString()}${vt}  ${t}`;
    $('log').prepend(d);
    while ($('log').children.length > 200) $('log').lastChild.remove();
  }

  // ---------- state server ----------
  let S = null;
  const es = new EventSource('/events');
  es.onopen = () => { $('conn').textContent = 'tersambung'; $('conn').className = 'conn ok'; };
  es.onerror = () => { $('conn').textContent = 'terputus'; $('conn').className = 'conn'; };
  es.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.type === 'state') { const first = !S; S = msg.state; if (first) initForm(); $('stMode').textContent = S.mode === 'mc' ? 'Magic Chess' : 'Mobile Legends'; }
    if (msg.type === 'library') loadLibrary();
    if (msg.type === 'unknown') loadUnknown();
  };
  const A = () => S.auto;

  // ---------- teks util ----------
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  // jarak minimum `pat` sebagai substring dalam `text` (algoritma Sellers)
  function fuzzyIn(text, pat) {
    let prev = Array.from({ length: pat.length + 1 }, (_, i) => i), best = prev[pat.length];
    for (const ch of text) {
      const cur = [0];
      for (let i = 1; i <= pat.length; i++) cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + (pat[i - 1] === ch ? 0 : 1));
      best = Math.min(best, cur[pat.length]); prev = cur;
    }
    return best;
  }
  const tol = (n) => (n >= 8 ? 2 : n >= 5 ? 1 : 0);
  const has = (text, word) => fuzzyIn(text, word) <= tol(word.length);

  const HERO_KEYS = D.HEROES.map((h) => ({ h, k: norm(h.name) }));
  // cari hero dalam senarai perkataan OCR (dengan bbox)
  function findHeroes(words) {
    const out = [];
    const used = new Set();
    for (let span = 3; span >= 1; span--) {
      for (let i = 0; i + span <= words.length; i++) {
        if ([...Array(span).keys()].some((o) => used.has(i + o))) continue;
        const ws = words.slice(i, i + span);
        if (ws.some((w) => w.confidence < 35)) continue;
        // perkataan dalam span mesti satu baris
        if (span > 1 && Math.abs(ws[0].bbox.y0 - ws[span - 1].bbox.y0) > (ws[0].bbox.y1 - ws[0].bbox.y0)) continue;
        const txt = norm(ws.map((w) => w.text).join(''));
        if (txt.length < 3) continue;
        let best = null, bd = 9;
        for (const { h, k } of HERO_KEYS) {
          if (span === 1 && h.name.includes(' ') && k.length > txt.length + 2) continue;
          const d = txt === k ? 0 : lev(txt, k);
          if (d <= tol(k.length) && d < bd) { best = h; bd = d; }
        }
        if (best) {
          [...Array(span).keys()].forEach((o) => used.add(i + o));
          const b = { x0: Math.min(...ws.map((w) => w.bbox.x0)), y0: Math.min(...ws.map((w) => w.bbox.y0)), x1: Math.max(...ws.map((w) => w.bbox.x1)), y1: Math.max(...ws.map((w) => w.bbox.y1)) };
          out.push({ hero: best.name, bbox: b, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 });
        }
      }
    }
    return out;
  }

  // ---------- sumber video ----------
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true;
  const frame = document.createElement('canvas');
  const fctx = frame.getContext('2d', { willReadFrequently: true });
  let stream = null, running = false;

  async function startStream(s) {
    stop();
    stream = s; video.srcObject = s; video.src = '';
    await video.play();
    s.getVideoTracks()[0].addEventListener('ended', stop);
    begin();
  }
  async function pickScreen() {
    try { await startStream(await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10 }, audio: false })); return true; }
    catch (e) { log('Tangkap skrin dibatalkan: ' + e.message, 'err'); return false; }
  }
  $('srcScreen').onclick = pickScreen;
  // klik preview kosong = pilih sumber
  $('preview').addEventListener('click', () => { if (!running && !editReg) pickScreen(); });
  $('srcCam').onclick = async () => {
    try { await startStream(await navigator.mediaDevices.getUserMedia({ video: { deviceId: $('camSel').value ? { exact: $('camSel').value } : undefined, width: 1920, height: 1080 } })); }
    catch (e) { log('Kamera gagal: ' + e.message, 'err'); }
  };
  async function listCams() {
    try {
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      $('camSel').innerHTML = '<option value="">— atau pilih kamera (OBS Virtual Camera) —</option>' + devs.map((d, i) => `<option value="${d.deviceId}">${esc(d.label || 'Kamera ' + (i + 1))}</option>`).join('');
    } catch { /* tiada izin */ }
  }
  listCams();
  $('srcFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    stop();
    video.srcObject = null; video.src = URL.createObjectURL(f);
    await video.play().catch((err) => log('Video tak boleh main: ' + err.message, 'err'));
    video.onended = () => log('Video habis.');
    begin();
    log('Mod test: guna video ' + f.name);
  };
  $('stopBtn').onclick = stop;
  function stop() {
    if (typeof setSrc === 'function' && $('stSrc')) setSrc(false);
    running = false;
    stream?.getTracks().forEach((t) => t.stop()); stream = null;
    video.pause();
    $('stPhase').textContent = '—';
  }
  function begin() { running = true; resetGame('mula'); setSrc(true); log('Sumber skrin aktif — auto detect berjalan.', 'ev'); }
  function setSrc(on) {
    $('stSrc').textContent = on ? 'aktif ✔' : 'TIADA — tekan "Tangkap tetingkap / skrin"';
    $('stSrc').parentElement.className = on ? '' : 'src-off';
  }

  function grab() {
    if (!running || video.readyState < 2 || !video.videoWidth) return false;
    const W = 1280, H = Math.round((video.videoHeight / video.videoWidth) * W);
    if (frame.width !== W || frame.height !== H) { frame.width = W; frame.height = H; $('preview').height = H; }
    fctx.drawImage(video, 0, 0, W, H);
    $('stRes').textContent = `${video.videoWidth}×${video.videoHeight}`;
    return true;
  }

  // crop kawasan → canvas (pilihan: threshold supaya tulisan terang jadi hitam atas putih)
  function cropCanvas(r, opts = {}) {
    const W = frame.width, H = frame.height;
    const sx = Math.max(0, Math.round(r.x * W)), sy = Math.max(0, Math.round(r.y * H));
    const sw = Math.max(1, Math.min(W - sx, Math.round(r.w * W))), sh = Math.max(1, Math.min(H - sy, Math.round(r.h * H)));
    const scale = opts.height ? Math.min(4, opts.height / sh) : opts.scale || 1;
    const c = document.createElement('canvas');
    c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    x.drawImage(frame, sx, sy, sw, sh, 0, 0, c.width, c.height);
    if (opts.threshold || opts.mask) {
      // tukar piksel "tulisan" → hitam, lain → putih (Tesseract suka hitam atas putih)
      const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
      const T = opts.threshold || 170;
      const isText = {
        lum: (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b > T,
        gold: (r, g, b) => r > 150 && g > 90 && r > b + 50,             // tulisan emas/oren (VICTORY, SAVAGE)
        white: (r, g, b) => r > 190 && g > 190 && b > 190,               // tulisan putih
        red: (r, g, b) => r > 150 && r > g + 60 && r > b + 50,           // tulisan merah (DEFEAT)
        dark: (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b < T,         // tulisan gelap atas latar terang
      }[opts.mask || 'lum'];
      for (let i = 0; i < d.length; i += 4) {
        const v = isText(d[i], d[i + 1], d[i + 2]) ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      x.putImageData(img, 0, 0);
    }
    if (opts.pad) {
      const p = document.createElement('canvas'), m = opts.pad;
      p.width = c.width + m * 2; p.height = c.height + m * 2;
      const px = p.getContext('2d'); px.fillStyle = '#fff'; px.fillRect(0, 0, p.width, p.height); px.drawImage(c, m, m);
      return p;
    }
    return c;
  }

  // warna dominan kawasan: biru (ally) vs merah (enemy)
  function teamColor(r) {
    const c = cropCanvas(r, { scale: 0.25 });
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let blue = 0, red = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 2] > d[i] + 40 && d[i + 2] > 90) blue++;
      else if (d[i] > d[i + 2] + 40 && d[i] > 110 && d[i + 1] < d[i] * 0.75) red++;
    }
    return blue >= red ? 'ally' : 'enemy';
  }

  // ---------- OCR (2 worker: skrin penuh & kawasan kecil) ----------
  let wFull = null, wReg = null;
  async function initOCR() {
    try {
      const opt = { workerPath: '/vendor/tesseract/worker.min.js', corePath: '/vendor/core/', langPath: '/vendor/lang', gzip: true };
      [wFull, wReg] = await Promise.all([Tesseract.createWorker('eng', 1, opt), Tesseract.createWorker('eng', 1, opt)]);
      await wFull.setParameters({ tessedit_pageseg_mode: '11' });
      await wReg.setParameters({ tessedit_pageseg_mode: '6' });
      $('stOcr').textContent = 'sedia';
      log('OCR engine sedia.');
    } catch (e) {
      $('stOcr').textContent = 'GAGAL';
      log('OCR gagal dimuat — jalankan "npm install" dalam folder overlay. ' + e.message, 'err');
    }
  }
  initOCR();
  async function ocr(worker, canvas) {
    const t0 = performance.now();
    const { data } = await worker.recognize(canvas);
    $('stOcr').textContent = `${Math.round(performance.now() - t0)} ms`;
    return data;
  }

  // ---------- keadaan permainan ----------
  const G = {};
  function resetGame(why) {
    Object.assign(G, {
      phase: 'idle', ally: [], enemy: [], hits: {}, banShown: false, loadingDone: false, resultFired: false,
      lastKill: 0, lastKillType: '', items: new Set(), slotPrev: [], slotStable: [], slotCount: [], loadingMiss: 0,
      mcRound: '', mcHp: null, mcRankFired: false,
    });
    if (why) log(`Reset game (${why})`);
    setPhase('idle');
  }
  function setPhase(p) {
    if (G.phase !== p) log(`Fasa → ${p}`, 'warn');
    G.phase = p;
    $('stPhase').textContent = p; $('stPhase').className = 'phase-' + p;
  }

  // ---------- 1) Skrin penuh: tentukan fasa, draft, loading ----------
  const DRAFT_RE = /(team\s*(ban|pick)|banning|picking|ban\s*phase|pick\s*phase|lock\s*in|enemy\s*team|ally\s*team|swap\s*hero)/i;
  async function scanFull() {
    // 2 versi: gambar asal (bagus untuk UI draft) + threshold (bagus untuk tulisan putih atas gambar)
    const d1 = await ocr(wFull, cropCanvas({ x: 0, y: 0, w: 1, h: 1 }));
    const d2 = await ocr(wFull, cropCanvas({ x: 0, y: 0, w: 1, h: 1 }, { threshold: 170 }));
    const text = (d1.text || '') + '\n' + (d2.text || '');
    const words = [...(d1.words || []), ...(d2.words || [])].filter((w) => w.text.trim());
    const W = frame.width, H = frame.height;
    lastBoxes = words.map((w) => w.bbox);

    // tukar mode automatik (perlu 2 scan berturut supaya tak tersalah)
    const vote = modeVote(text);
    G.voteMC = vote === 'mc' ? (G.voteMC || 0) + 1 : 0;
    G.voteML = vote === 'ml' ? (G.voteML || 0) + 1 : 0;
    const canSwitch = S.modeAuto !== false; // mode dipilih manual dalam control panel → jangan tukar
    if (canSwitch && G.voteMC >= 2 && S.mode !== 'mc') { S.mode = 'mc'; patch({ mode: 'mc' }); log('Magic Chess Go Go dikesan → mode MC', 'warn'); }
    if (canSwitch && G.voteML >= 2 && S.mode !== 'ml') { S.mode = 'ml'; patch({ mode: 'ml' }); log('Mobile Legends dikesan → mode ML', 'warn'); }
    if (S.mode === 'mc') { if (A().on.mc) mcFromFull(d1, d2, text); return; }

    const heroes = [...new Map([...findHeroes(d1.words || []), ...findHeroes(d2.words || [])].map((h) => [h.hero + Math.round(h.cy / 40), h])).values()];
    const isDraft = DRAFT_RE.test(text);
    if (isDraft && S.mode !== 'ml' && S.modeAuto !== false) patch({ mode: 'ml' });

    if (isDraft && A().on.draft) {
      if (G.phase !== 'draft') { if (G.phase !== 'idle' || G.ally.length || G.resultFired) resetGame('draft baru'); setPhase('draft'); resetML(); }
      handleDraft(text, heroes, W);
      return;
    }

    // loading screen: banyak hero dalam 2 baris — pisah ikut jurang paling besar antara kedudukan Y
    let top = [], bot = [];
    if (heroes.length >= 6) {
      const ys = heroes.map((h) => h.cy).sort((a, b) => a - b);
      let gap = 0, cut = 0;
      for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > gap) { gap = ys[i] - ys[i - 1]; cut = (ys[i] + ys[i - 1]) / 2; }
      if (gap > H * 0.06) { top = heroes.filter((h) => h.cy < cut); bot = heroes.filter((h) => h.cy >= cut); }
    }
    if (A().on.loading && heroes.length >= 6 && top.length >= 2 && bot.length >= 2) {
      if (G.phase !== 'loading') setPhase('loading');
      G.loadingMiss = 0;
      handleLoading(words, top, bot, H);
      return;
    }
    if (G.phase === 'draft' || G.phase === 'loading') {
      if (++G.loadingMiss >= 2) { setPhase('game'); G.gameStart = Date.now(); }
    }
    // kalau terlepas fasa: VICTORY/DEFEAT dikesan pada scan pantas
    if (G.phase === 'game' || G.phase === 'idle') mlFromFull(d1, d2);
  }

  // ---------- HUD Mobile Legends: masa, skor kill, KDA, gold → analisis game ----------
  const ML_EMPTY = { minute: 0, sec: 0, allyKills: 0, enemyKills: 0, kda: null, gold: 0, turtles: { ally: 0, enemy: 0 }, lords: { ally: 0, enemy: 0 } };
  function resetML() { G.mlNext = 3; G.gameStart = null; S.ml = structuredClone(ML_EMPTY); patch({ ml: structuredClone(ML_EMPTY) }); }
  function mlFromFull(d1, d2) {
    const W = frame.width, H = frame.height;
    const words = [...(d1.words || []), ...(d2.words || [])].filter((w) => w.text.trim());
    const lines = [...(d1.lines || []), ...(d2.lines || [])];
    const p = {};
    // masa game "08:35" di tengah atas
    let tw = null, td = 1e9;
    for (const w of words) {
      const m = w.text.trim().match(/^(\d{1,2})[:.](\d{2})$/);
      if (!m || w.bbox.y0 > H * 0.15 || +m[2] > 59) continue;
      const dist = Math.abs((w.bbox.x0 + w.bbox.x1) / 2 - W / 2);
      if (dist < td && dist < W * 0.2) { td = dist; tw = { w, min: +m[1], sec: +m[2] }; }
    }
    if (tw) {
      p.minute = tw.min; p.sec = tw.sec;
      // skor kill: nombor kiri (team kau, biru) & kanan (musuh, merah) sebaris dengan masa
      const cy = (tw.w.bbox.y0 + tw.w.bbox.y1) / 2, h = tw.w.bbox.y1 - tw.w.bbox.y0;
      const nums = words.filter((w) => /^\d{1,2}$/.test(w.text.trim()) && Math.abs((w.bbox.y0 + w.bbox.y1) / 2 - cy) < h * 1.2);
      const left = nums.filter((w) => w.bbox.x1 <= tw.w.bbox.x0 && tw.w.bbox.x0 - w.bbox.x1 < W * 0.15).sort((a, b) => b.bbox.x1 - a.bbox.x1)[0];
      const right = nums.filter((w) => w.bbox.x0 >= tw.w.bbox.x1 && w.bbox.x0 - tw.w.bbox.x1 < W * 0.15).sort((a, b) => a.bbox.x0 - b.bbox.x0)[0];
      if (left) p.allyKills = +left.text;
      if (right) p.enemyKills = +right.text;
    } else if (G.gameStart) {
      const s = Math.floor((Date.now() - G.gameStart) / 1000);   // anggaran kalau masa tak dapat dibaca
      p.minute = Math.floor(s / 60); p.sec = s % 60;
    }
    // KDA "5/2/7" — tulisan kecil, jadi terima hanya bila 2 bacaan setuju (2 versi OCR, atau scan sebelum)
    const kdaOf = (ls) => { for (const l of ls || []) { if (l.bbox.y0 > H * 0.3) continue; const m = l.text.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})/); if (m) return `${+m[1]}/${+m[2]}/${+m[3]}`; } return null; };
    const k1 = kdaOf(d1.lines), k2 = kdaOf(d2.lines);
    const kOk = (k1 && (k1 === k2 || k1 === G.kdaPrev)) ? k1 : (k2 && k2 === G.kdaPrev) ? k2 : null;
    G.kdaPrev = k1 || k2;
    if (kOk) { const [k, dd, a] = kOk.split('/').map(Number); p.kda = { k, d: dd, a }; }
    // gold (nombor sebelah ikon syiling)
    let gH = 0;
    for (const w of words) {
      const t = w.text.trim(); if (!/^\D?\d{2,5}$/.test(t)) continue;
      const h = w.bbox.y1 - w.bbox.y0; if (h <= gH) continue;
      let val = null;
      if (coinInside(w.bbox) && t.length >= 3) val = t.slice(1).replace(/\D/g, '');
      else if (/^\d{2,5}$/.test(t) && coinRatio(w.bbox) > 0.12) val = t;
      if (val) { gH = h; p.gold = +val; }
    }
    if (!Object.keys(p).length) return;
    // kill tak boleh turun dalam satu game — abaikan bacaan salah
    if (p.allyKills != null && p.allyKills < (S.ml?.allyKills || 0)) delete p.allyKills;
    if (p.enemyKills != null && p.enemyKills < (S.ml?.enemyKills || 0)) delete p.enemyKills;
    S.ml = { ...(S.ml || {}), ...p };
    patch({ ml: p });
    $('stML').textContent = `${String(S.ml.minute).padStart(2, '0')}:${String(S.ml.sec).padStart(2, '0')} · Kill ${S.ml.allyKills}-${S.ml.enemyKills}${S.ml.kda ? ` · KDA ${S.ml.kda.k}/${S.ml.kda.d}/${S.ml.kda.a}` : ''}${S.ml.gold ? ` · 💰${S.ml.gold}` : ''}`;
    // analisis setiap 3 minit game
    if (G.mlNext == null) G.mlNext = 3;
    if (S.ml.minute >= G.mlNext) { G.mlNext = (Math.floor(S.ml.minute / 3) + 1) * 3; mlAnalysis(`minit ${S.ml.minute}`); }
  }
  let mlT;
  function mlAnalysis(why) {
    clearTimeout(mlT);
    mlT = setTimeout(() => {
      const a = window.MLANALYSIS.analyze(S);
      log(`📊 Analisis ML (${why}): Menang ${a.win}% · ${a.plan}`, 'ev');
      fire({ kind: 'ml', type: 'analysis' });
    }, 2500);
  }

  function confirm(key) { G.hits[key] = (G.hits[key] || 0) + 1; return G.hits[key] >= 2; }

  function handleDraft(text, heroes, W) {
    if (/ban/i.test(text) && !G.banShown) {
      G.banShown = true;
      patch({ draft: { myHero: A().mainHero || '' } }).then(() => fire({ kind: 'draft', view: 'ban' }));
    }
    let changed = false;
    for (const h of heroes) {
      const side = h.cx < W * 0.36 ? 'ally' : h.cx > W * 0.64 ? 'enemy' : null;
      if (!side || G[side].includes(h.hero) || G[side].length >= 5) continue;
      if (!confirm(side + h.hero)) continue;
      G[side].push(h.hero); changed = true;
      log(`Draft: ${side} pick ${h.hero}`, 'ev');
      if (side === 'enemy') {
        patch({ draft: { enemy: G.enemy } }).then(() => fire({ kind: 'draft', view: 'pick', hero: h.hero, side: 'enemy' }));
      }
    }
    if (changed) { patch({ draft: { ally: G.ally, enemy: G.enemy } }); $('stDraft').textContent = `${G.ally.join(', ') || '-'}  VS  ${G.enemy.join(', ') || '-'}`; }
  }

  function handleLoading(words, top, bot, H) {
    if (G.loadingDone) return;
    if (top.length + bot.length < 8 && !confirm('loading')) return;
    const uniq = (arr) => [...new Map(arr.sort((a, b) => a.cx - b.cx).map((h) => [h.hero, h])).values()].slice(0, 5);
    const T = uniq(top), B = uniq(bot);

    // tentukan baris team kita
    let allyRow = A().allyRow;
    let ignWord = null;
    if (A().ign) {
      const ign = norm(A().ign);
      for (let i = 0; i < words.length && !ignWord; i++) {
        for (let span = 1; span <= 3; span++) {
          const t = norm(words.slice(i, i + span).map((w) => w.text).join(''));
          if (t.length >= 3 && lev(t, ign) <= tol(ign.length)) { ignWord = words[i]; break; }
        }
      }
    }
    if (allyRow === 'auto') {
      if (ignWord) { const iy = (ignWord.bbox.y0 + ignWord.bbox.y1) / 2; const dist = (row) => Math.min(...row.map((h) => Math.abs(h.cy - iy))); allyRow = dist(T) < dist(B) ? 'top' : 'bottom'; }
      else {
        const ov = (row) => row.filter((h) => G.ally.includes(h.hero)).length - row.filter((h) => G.enemy.includes(h.hero)).length;
        allyRow = ov(T) > ov(B) ? 'top' : 'bottom';
      }
    }
    const allyH = allyRow === 'top' ? T : B, enemyH = allyRow === 'top' ? B : T;
    G.ally = allyH.map((h) => h.hero); G.enemy = enemyH.map((h) => h.hero).filter((n) => !G.ally.includes(n)); // hero sama tak boleh ada di 2 team
    let myHero = A().mainHero || '';
    if (ignWord) {
      const ix = (ignWord.bbox.x0 + ignWord.bbox.x1) / 2;
      myHero = allyH.slice().sort((a, b) => Math.abs(a.cx - ix) - Math.abs(b.cx - ix))[0]?.hero || myHero;
    }
    G.loadingDone = true;
    resetML();
    G.items.clear(); G.slotStable = []; $('stItems').textContent = 0;
    $('stDraft').textContent = `${G.ally.join(', ')}  VS  ${G.enemy.join(', ')}`;
    log(`Loading: ALLY ${G.ally.join(', ')} | ENEMY ${G.enemy.join(', ')} | hero aku: ${myHero || '?'}`, 'ev');

    // spell timer: hero musuh + spell default ikut lane
    const enemies = [0, 1, 2, 3, 4].map((i) => {
      const old = S.enemies[i] || {};
      const h = D.findHero(G.enemy[i]);
      if (!h) return old;
      const spell = h.lane === 'jungle' ? 'retribution' : 'flicker';
      return { hero: h.name, spell, cd: spell === 'retribution' ? 35 : 120, endsAt: 0 };
    });
    patch({ draft: { ally: G.ally, enemy: G.enemy, myHero }, enemies }).then(() => {
      fire({ kind: 'draft', view: 'predict' });
      fire({ kind: 'draft', view: 'spike' });
    });

    if (A().on.capture) captureHeroes([...allyH, ...enemyH]);
  }

  // potong potret hero (atas nama di kad loading screen) dan simpan sebagai gambar hero
  async function captureHeroes(list) {
    const have = new Set(await fetch('/api/assets?dir=heroes').then((r) => r.json()).catch(() => []));
    const W = frame.width;
    for (const h of list) {
      const slug = D.findHero(h.hero)?.slug; if (!slug || have.has(slug)) continue;
      const side = Math.round(W * 0.11);
      const x = Math.max(0, Math.min(W - side, Math.round(h.cx - side / 2)));
      const y = Math.max(0, Math.round(h.bbox.y0 - side - 6));
      const c = document.createElement('canvas'); c.width = c.height = 256;
      c.getContext('2d').drawImage(frame, x, y, side, Math.min(side, h.bbox.y0 - y), 0, 0, 256, 256);
      await post('/api/capture', { type: 'hero', name: slug, dataUrl: c.toDataURL('image/png') });
      log(`📸 Gambar hero ditangkap: ${h.hero}`, 'ev');
    }
    loadHeroLib();
  }

  // ---------- 2) Kawasan pantas: banner kill & VICTORY / DEFEAT ----------
  // Cara utama: TEMPLATE MATCHING. Banner ML sama bentuk setiap kali, jadi sekali dah simpan
  // gambar banner dari skrin kau, ia dikenal dengan tepat. Template dipelajari:
  //   (a) automatik bila OCR berjaya baca tulisan banner, atau
  //   (b) kau klik gambar dalam buffer 6 saat terakhir (panel "Ajar banner").
  // OCR kekal sebagai backup.
  const KILL_WORDS = [
    ['firstblood', 'first_blood'], ['doublekill', 'double'], ['triplekill', 'triple'], ['megakill', 'mega'],
    ['maniac', 'maniac'], ['savage', 'savage'], ['killingspree', 'spree'], ['rampage', 'monster'], ['monsterkill', 'monster'],
    ['unstoppable', 'monster'], ['godlike', 'godlike'], ['legendary', 'legendary'], ['shutdown', 'shutdown'],
    ['wipedout', 'wipe'], ['lord', 'lord'], ['turtle', 'turtle'], ['slainanenemy', 'solo'], ['hasslain', 'solo'],
  ];
  const KILL_TYPES = { first_blood: 'First Blood', solo: 'Solo kill / slain', double: 'Double Kill', triple: 'Triple Kill', mega: 'Mega Kill', maniac: 'Maniac', savage: 'Savage', spree: 'Killing Spree', monster: 'Monster/Rampage', godlike: 'Godlike', legendary: 'Legendary', shutdown: 'Shut Down', wipe: 'Wiped Out', lord: 'Lord', turtle: 'Turtle', death: 'Aku mati' };
  const RESULT_TYPES = { win: 'VICTORY', lose: 'DEFEAT' };

  const TV_W = 96, TV_H = 36;
  function zvec(ctxSrc, sx, sy, sw, sh) {
    const c = document.createElement('canvas'); c.width = TV_W; c.height = TV_H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(ctxSrc, sx, sy, sw, sh, 0, 0, TV_W, TV_H);
    const d = x.getImageData(0, 0, TV_W, TV_H).data, v = new Float32Array(TV_W * TV_H);
    let m = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) { v[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; m += v[j]; }
    m /= v.length;
    let sd = 0; for (let j = 0; j < v.length; j++) { v[j] -= m; sd += v[j] * v[j]; }
    sd = Math.sqrt(sd / v.length) || 1;
    for (let j = 0; j < v.length; j++) v[j] /= sd;
    return v;
  }
  const ncc = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s / a.length; };
  const rectPx = (r) => ({ sx: r.x * frame.width, sy: r.y * frame.height, sw: r.w * frame.width, sh: r.h * frame.height });
  function regionVec(r) { const p = rectPx(r); return zvec(frame, p.sx, p.sy, p.sw, p.sh); }
  function regionPng(r, width = 384) {
    const p = rectPx(r), c = document.createElement('canvas');
    c.width = width; c.height = Math.max(1, Math.round((p.sh / p.sw) * width));
    c.getContext('2d').drawImage(frame, p.sx, p.sy, p.sw, p.sh, 0, 0, c.width, c.height);
    return c;
  }

  let templates = []; // { name, group, type, v }
  async function loadTemplates() {
    const names = await fetch('/api/assets?dir=templates').then((r) => r.json()).catch(() => []);
    templates = (await Promise.all(names.map(async (name) => {
      const [group, type] = name.split('__');
      const img = await loadImg(`assets/templates/${name}.png`);
      return img && { name, group, type, v: zvec(img, 0, 0, img.width, img.height) };
    }))).filter(Boolean);
    renderTemplates();
  }
  async function saveTemplate(group, type, canvas, why) {
    const name = `${group}__${type}__${Date.now().toString(36)}`;
    await post('/api/capture', { type: 'template', name, dataUrl: canvas.toDataURL('image/png') });
    log(`🧠 Template ${group === 'kill' ? KILL_TYPES[type] : RESULT_TYPES[type]} disimpan (${why})`, 'ev');
    loadTemplates();
  }
  function bestTemplate(group, v) {
    let best = { type: null, score: 0 };
    for (const t of templates) if (t.group === group) { const s = ncc(v, t.v); if (s > best.score) best = { type: t.type, score: s }; }
    return best;
  }
  const hasTemplate = (group, type) => templates.some((t) => t.group === group && t.type === type);

  // buffer 6 saat terakhir — untuk "Ajar banner"
  const BUF = { banner: [], result: [] };
  function pushBuf(key, r, v) {
    const c = regionPng(r, 240);
    BUF[key].push({ t: Date.now(), c, v });
    if (BUF[key].length > 12) BUF[key].shift();
  }

  function goldFrac(r) {
    const c = cropCanvas(r, { scale: 0.25 }), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] > 90 && d[i] > d[i + 2] + 50) n++;
    return n / (d.length / 4);
  }

  function doResult(type, how) {
    G.resultFired = true;
    log(`Keputusan: ${RESULT_TYPES[type]} (${how})`, 'warn');
    fire({ kind: type });
    setPhase('idle');
    setTimeout(() => resetGame('lepas keputusan'), 60000);
  }
  function doKill(type, how) {
    const team = teamColor(A().regions.banner);
    G.lastKill = Date.now();
    // kira Turtle / Lord setiap team (termasuk musuh) untuk analisis
    if (type === 'lord' || type === 'turtle') {
      const key = type + 's';
      const cur = { ally: 0, enemy: 0, ...(S.ml?.[key] || {}) };
      cur[team]++;
      S.ml = { ...(S.ml || {}), [key]: cur };
      patch({ ml: { [key]: cur } });
    }
    if (['lord', 'savage', 'wipe', 'maniac', 'shutdown'].includes(type)) mlAnalysis(type);
    if (A().on.allyKillsOnly && team === 'enemy' && type !== 'shutdown') { log(`Banner musuh (${type}, ${how}) — abaikan`); return; }
    log(`Kill: ${type} (${how})`, 'warn');
    if (type === 'death') { log('Aku mati — tiada overlay'); return; }
    if (G.phase === 'idle') setPhase('game');
    fire({ kind: 'kill', type });
  }

  const TPL_KILL = 0.8, TPL_RESULT = 0.82;
  const killAllowed = () => A().on.kill && G.phase !== 'draft' && G.phase !== 'loading' && Date.now() - G.lastKill > 4000;
  const resAllowed = () => A().on.result && !G.resultFired;
  // (a) template — laju (tiada OCR), jalan setiap tick 250ms
  let lastBuf = 0;
  function scanTemplates() {
    const R = A().regions;
    const bv = regionVec(R.banner), rv = regionVec(R.result);
    if (Date.now() - lastBuf > 500) { lastBuf = Date.now(); pushBuf('banner', R.banner, bv); pushBuf('result', R.result, rv); }
    const killOk = killAllowed(), resOk = resAllowed();
    if (resOk) {
      // skrin keputusan kekal beberapa saat → perlu 2 frame berturut (elak tersalah)
      const m = bestTemplate('result', rv);
      if (m.score >= TPL_RESULT && m.type === G.resPrev) return doResult(m.type, `template ${m.score.toFixed(2)}`);
      G.resPrev = m.score >= TPL_RESULT ? m.type : null;
    }
    if (killOk) { const m = bestTemplate('kill', bv); if (m.score >= TPL_KILL) return doKill(m.type, `template ${m.score.toFixed(2)}`); }
  }

  // (b) OCR backup — kalau berjaya, simpan template supaya lain kali terus kenal
  async function scanFast() {
    const R = A().regions;
    const killOk = killAllowed(), resOk = resAllowed();
    if (resOk) {
      const texts = [];
      for (const o of [{ height: 120, mask: 'lum', threshold: 200 }, { height: 80, mask: 'gold' }, { height: 110, mask: 'lum', threshold: 165 }]) {
        texts.push(norm((await ocr(wReg, cropCanvas(R.result, { ...o, pad: 20 }))).text));
      }
      const t = texts.join(' ');
      const dWin = fuzzyIn(t, 'victory'), dLose = fuzzyIn(t, 'defeat');
      const win = dWin <= 1 || (dWin <= 2 && goldFrac(R.result) > 0.05);
      const lose = !win && dLose <= 1;
      if (win || lose) {
        const type = win ? 'win' : 'lose';
        if (Math.min(dWin, dLose) <= 1 && !hasTemplate('result', type)) saveTemplate('result', type, regionPng(R.result), 'auto dari OCR');
        return doResult(type, `OCR "${t.slice(0, 30)}"`);
      }
    }
    if (killOk) {
      const t = norm((await ocr(wReg, cropCanvas(R.banner, { height: 110, threshold: 165, pad: 20 }))).text)
        + norm((await ocr(wReg, cropCanvas(R.banner, { height: 70, mask: 'white', pad: 20 }))).text);
      if (t.length < 3) return;
      // ketat: maks 1 huruf salah (OCR backup ni juga mengajar template, jadi elak salah baca)
      const hit = KILL_WORDS.find(([w]) => (w.length <= 6 ? t.includes(w) : fuzzyIn(t, w) <= 1));
      if (!hit) return;
      if (!hasTemplate('kill', hit[1])) saveTemplate('kill', hit[1], regionPng(R.banner), 'auto dari OCR');
      doKill(hit[1], `OCR "${t.slice(0, 30)}"`);
    }
  }

  // ---------- panel "Ajar banner" ----------
  let teachKey = 'banner', teachPick = null, teachFrozen = false;
  function renderTeachTypes() {
    const types = teachKey === 'banner' ? KILL_TYPES : RESULT_TYPES;
    $('teachType').innerHTML = Object.entries(types).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('');
  }
  function renderStrip() {
    if (teachFrozen) return;
    const strip = $('teachStrip');
    strip.replaceChildren(...BUF[teachKey].map((b, i) => { b.c.dataset.i = i; b.c.title = new Date(b.t).toLocaleTimeString(); return b.c; }));
  }
  setInterval(renderStrip, 1000);
  $('teachTabs').onclick = (e) => {
    const k = e.target.dataset.teach; if (!k) return;
    teachKey = k; teachPick = null; teachFrozen = false;
    [...$('teachTabs').children].forEach((b) => b.classList.toggle('on', b.dataset.teach === k));
    renderTeachTypes(); renderStrip();
  };
  $('teachStrip').onclick = (e) => {
    const i = e.target.dataset.i; if (i === undefined) return;
    teachFrozen = true; teachPick = BUF[teachKey][Number(i)];
    [...$('teachStrip').children].forEach((c) => c.classList.toggle('pick', c === e.target));
  };
  $('teachSave').onclick = async () => {
    if (!teachPick) return log('Klik dulu gambar banner dalam strip (strip berhenti bila kau pilih).', 'err');
    await saveTemplate(teachKey === 'banner' ? 'kill' : 'result', $('teachType').value, teachPick.c, 'diajar manual');
    teachPick = null; teachFrozen = false;
  };
  $('teachResume').onclick = () => { teachPick = null; teachFrozen = false; renderStrip(); };
  function renderTemplates() {
    $('tplList').innerHTML = templates.map((t) => `<div title="${esc(t.name)}"><img src="assets/templates/${esc(t.name)}.png"><span>${esc(t.group === 'kill' ? KILL_TYPES[t.type] : RESULT_TYPES[t.type])}</span><button class="sm" data-del="${esc(t.name)}">✕</button></div>`).join('') || '<span class="hint">Belum ada — akan dipelajari automatik, atau ajar dari strip di atas.</span>';
  }
  $('tplList').onclick = async (e) => {
    const n = e.target.dataset.del; if (!n) return;
    await post('/api/asset-delete', { dir: 'templates', name: n }); loadTemplates();
  };
  renderTeachTypes();
  es.addEventListener('message', (m) => { if (JSON.parse(m.data).type === 'templates') loadTemplates(); });

  // ---------- 3) Item: ikon baru dalam slot ----------
  const TH = 24;
  let library = []; // { id, v: Float32Array }
  let unknowns = [];
  function thumbOf(srcCanvas, sx = 0, sy = 0, sw = srcCanvas.width, sh = srcCanvas.height) {
    const c = document.createElement('canvas'); c.width = c.height = TH;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, TH, TH);
    const d = x.getImageData(0, 0, TH, TH).data, v = new Float32Array(TH * TH * 3);
    for (let i = 0, j = 0; i < d.length; i += 4) { v[j++] = d[i]; v[j++] = d[i + 1]; v[j++] = d[i + 2]; }
    return v;
  }
  const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
  function variance(v) { let m = 0; for (const x of v) m += x; m /= v.length; let s = 0; for (const x of v) s += (x - m) ** 2; return Math.sqrt(s / v.length); }
  function loadImg(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src + '?t=' + Date.now(); }); }
  async function vecFromUrl(src) {
    const img = await loadImg(src); if (!img) return null;
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
    return thumbOf(c);
  }
  async function loadLibrary() {
    const ids = await fetch('/api/assets?dir=items').then((r) => r.json()).catch(() => []);
    library = (await Promise.all(ids.map(async (id) => ({ id, v: await vecFromUrl(`assets/items/${id}.png`) })))).filter((x) => x.v);
    $('libCount').textContent = library.length;
    $('libItems').innerHTML = library.map((l) => `<img title="${esc(l.id)}" src="assets/items/${esc(l.id)}.png">`).join('');
    loadUnknown();
  }
  async function loadUnknown() {
    const ids = await fetch('/api/assets?dir=unknown').then((r) => r.json()).catch(() => []);
    unknowns = (await Promise.all(ids.map(async (id) => ({ id, v: await vecFromUrl(`assets/items/_unknown/${id}.png`) })))).filter((x) => x.v);
    const opts = '<option value="">— item apa ni? —</option>' + D.ITEMS.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join('') + '<option value="__delete">✕ Bukan item (buang)</option>';
    $('unk').innerHTML = unknowns.map((u) => `<div><img src="assets/items/_unknown/${esc(u.id)}.png?t=${Date.now()}"><select data-unk="${esc(u.id)}">${opts}</select></div>`).join('') || '<span class="hint">Tiada — semua ikon dah dikenal.</span>';
  }
  $('unk').addEventListener('change', async (e) => {
    const u = e.target.dataset.unk; if (!u || !e.target.value) return;
    await post('/api/label', { unknown: u, id: e.target.value });
    log(`Label: ${u} → ${e.target.value}`, 'ev');
    loadLibrary();
  });
  async function loadHeroLib() {
    const ids = await fetch('/api/assets?dir=heroes').then((r) => r.json()).catch(() => []);
    $('heroCount').textContent = ids.length;
    $('libHeroes').innerHTML = ids.map((id) => `<img title="${esc(id)}" src="assets/heroes/${esc(id)}.png?t=${Date.now()}">`).join('');
  }
  loadLibrary(); loadHeroLib(); loadTemplates();

  function identify(v) {
    let best = null, bd = 1e9;
    for (const l of library) { const d = diff(v, l.v); if (d < bd) { bd = d; best = l.id; } }
    return bd < 30 ? best : null;
  }
  function slotRects() {
    const r = A().regions.items, n = Math.max(1, A().items.slots || 6), vert = A().items.dir === 'vertical';
    return [...Array(n).keys()].map((i) => vert ? { x: r.x, y: r.y + (r.h / n) * i, w: r.w, h: r.h / n } : { x: r.x + (r.w / n) * i, y: r.y, w: r.w / n, h: r.h });
  }
  async function scanItems() {
    const rects = slotRects(), W = frame.width, H = frame.height;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const sx = r.x * W, sy = r.y * H, sw = r.w * W, sh = r.h * H;
      const v = thumbOf(frame, sx, sy, sw, sh);
      const prev = G.slotPrev[i]; G.slotPrev[i] = v;
      if (!prev || diff(prev, v) > 10) { G.slotCount[i] = 0; continue; } // masih bergerak
      if (++G.slotCount[i] !== 2) continue;                                // stabil 2 frame berturut
      const empty = variance(v) < 14;
      const stable = G.slotStable[i];
      if (stable && diff(stable, v) < 22) continue;                         // tiada perubahan
      G.slotStable[i] = empty ? null : v;
      const target = A().items.mode === 'quickbuy' ? stable : (empty ? null : v);
      if (!target) continue;
      await onItemIcon(target, i, A().items.mode === 'quickbuy' ? null : { sx, sy, sw, sh });
    }
  }
  async function onItemIcon(v, slot, crop) {
    const id = identify(v);
    if (id) {
      if (G.items.has(id)) return;
      G.items.add(id); $('stItems').textContent = G.items.size;
      if (G.phase === 'idle') setPhase('game');
      fire({ kind: 'item', id });
      if (G.items.size === 6) fire({ kind: 'fullbuild' });
      return;
    }
    if (!crop) return;
    if (unknowns.some((u) => diff(u.v, v) < 30)) return; // dah ada dalam senarai label
    const c = document.createElement('canvas'); c.width = c.height = 96;
    c.getContext('2d').drawImage(frame, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, 96, 96);
    const name = 'u' + Date.now().toString(36);
    unknowns.push({ id: name, v });
    await post('/api/capture', { type: 'unknown', name, dataUrl: c.toDataURL('image/png') });
    log(`Ikon item baru di slot ${slot + 1} — label sekali dalam panel "Ikon item baru"`, 'warn');
  }

  // ---------- 4) Magic Chess Go Go ----------
  // Tak perlu set kawasan: baca skrin penuh dan cari petunjuk.
  //   round  = corak "2-3" di bahagian atas
  //   HP     = nombor sebaris dengan IGN kau dalam senarai pemain
  //   gold   = nombor yang ada ikon syiling emas di sebelah
  //   level  = "Lv.5" / "Level 5"
  //   synergy= baris "Nama 2/4" di sebelah kiri
  // Kawasan MC yang kau lukis sendiri (kalau ada) diutamakan.
  const MC_SIGS = ['refresh', 'commander', 'synerg', 'buyexp', 'interest', 'lineup', 'recruit', 'gogo', 'magicchess', 'bench', 'reroll', 'winstreak', 'losestreak'];
  const ML_SIGS = ['recall', 'retribution', 'turtle', 'lord'];
  function modeVote(text) {
    const t = norm(text);
    const mc = MC_SIGS.filter((w) => t.includes(w)).length;
    const ml = ML_SIGS.filter((w) => t.includes(w)).length + (DRAFT_RE.test(text) ? 2 : 0);
    if (mc >= 2 && mc > ml) return 'mc';
    if (ml >= 2 && ml > mc) return 'ml';
    return null;
  }

  // nisbah piksel emas di kiri/kanan kotak (ikon syiling)
  function goldPx(x, y, w, h) {
    x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y)); w = Math.round(w); h = Math.round(h);
    if (w < 2 || h < 2 || x + w > frame.width || y + h > frame.height) return 0;
    const d = fctx.getImageData(x, y, w, h).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] > 130 && d[i + 2] < 100 && d[i] > d[i + 2] + 90) n++;
    return n / (d.length / 4);
  }
  // ikon syiling "melekat" dalam kotak perkataan (OCR baca sebagai 0 / ® / @)
  const coinInside = (bb) => goldPx(bb.x0, bb.y0, Math.min(bb.y1 - bb.y0, bb.x1 - bb.x0), bb.y1 - bb.y0) > 0.25;
  function coinRatio(bb) {
    const h = bb.y1 - bb.y0; if (h < 6) return 0;
    let best = 0;
    for (const x0 of [bb.x0 - h * 1.6, bb.x1]) {
      const x = Math.max(0, Math.round(x0)), w = Math.round(h * 1.6), y = Math.max(0, Math.round(bb.y0 - h * 0.2));
      if (x + w > frame.width || w < 2) continue;
      const d = fctx.getImageData(x, y, w, Math.round(h * 1.4)).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] > 130 && d[i + 2] < 100 && d[i] > d[i + 2] + 90) n++;
      best = Math.max(best, n / (d.length / 4));
    }
    return best;
  }

  function mcFromFull(d1, d2, text) {
    const W = frame.width, H = frame.height;
    const lines = [...(d1.lines || []), ...(d2.lines || [])];
    const words = [...(d1.words || []), ...(d2.words || [])].filter((w) => w.text.trim());
    const r = {};

    // round: "2-3" paling dekat tengah atas
    let bestR = null, bestD = 1e9;
    for (const w of words) {
      const m = w.text.match(/^\D?([1-9])\s*[-–—]\s*([1-9])\D?$/);
      if (!m || w.bbox.y0 > H * 0.3) continue;
      const dist = Math.abs((w.bbox.x0 + w.bbox.x1) / 2 - W / 2) + w.bbox.y0;
      if (dist < bestD) { bestD = dist; bestR = `${m[1]}-${m[2]}`; }
    }
    if (!bestR) for (const l of lines) {
      const m = l.text.match(/(?:round|stage)\s*([1-9])\s*[-–—]\s*([1-9])/i);
      if (m) { bestR = `${m[1]}-${m[2]}`; break; }
    }
    if (bestR) r.round = bestR;

    // level komander
    for (const l of lines) { const m = l.text.match(/\b(?:lv|lvl|level)\.?\s*(\d{1,2})\b/i); if (m && +m[1] >= 1 && +m[1] <= 10) { r.level = +m[1]; break; } }

    // HP: baris yang ada IGN
    if (A().ign) {
      const ign = norm(A().ign).slice(0, 8);
      for (const l of lines) {
        const t = norm(l.text);
        if (ign.length < 3 || fuzzyIn(t, ign) > tol(ign.length)) continue;
        const nums = (l.text.replace(new RegExp(A().ign.replace(/[^a-z0-9]/gi, '.?'), 'i'), ' ').match(/\b\d{1,3}\b/g) || []).map(Number).filter((n) => n <= 100);
        if (nums.length) { r.hp = nums[nums.length - 1]; break; }
        // nombor dalam baris berdekatan (bar HP sebelah nama)
        const ly = (l.bbox.y0 + l.bbox.y1) / 2, lh = l.bbox.y1 - l.bbox.y0;
        const near = words.filter((w) => /^\d{1,3}$/.test(w.text.trim()) && +w.text <= 100 && Math.abs((w.bbox.y0 + w.bbox.y1) / 2 - ly) < lh * 1.5 && Math.abs(w.bbox.x0 - l.bbox.x1) < W * 0.15);
        if (near.length) { r.hp = +near[0].text; break; }
      }
    }

    // senarai pemain (kanan skrin): "Nama 74" → HP semua pemain untuk analisis
    const players = new Map();
    const ignN = norm(A().ign || '');
    for (const l of lines) {
      if (l.bbox.x0 < W * 0.55 || l.bbox.y1 > H * 0.78) continue; // bukan kawasan kedai di bawah
      const m = l.text.trim().match(/^(.*?[A-Za-z].*?)\s+(\d{1,3})\s*$/);
      if (!m || +m[2] > 100) continue;
      const key = norm(m[1]); if (key.length < 2 || players.has(key)) continue;
      const me = ignN.length >= 3 && fuzzyIn(key, ignN.slice(0, 8)) <= tol(Math.min(8, ignN.length));
      players.set(key, { name: m[1].trim(), hp: +m[2], me, x: l.bbox.x0 });
      if (me && r.hp == null) r.hp = +m[2];
    }
    // senarai pemain sejajar dalam satu lajur — buang yang jauh dari median X
    const xs = [...players.values()].map((p) => p.x).sort((a, b) => a - b), mx = xs[Math.floor(xs.length / 2)];
    const plist = [...players.values()].filter((p) => Math.abs(p.x - mx) < W * 0.08).slice(0, 8).map(({ x, ...p }) => p);
    if (plist.length >= 3) r.players = plist;

    // gold: nombor dengan ikon syiling — ambil yang tulisan paling besar
    let gBest = null, gH = 0;
    for (const w of words) {   // d1 (gambar asal) diproses dulu → diutamakan bila sama saiz
      const t = w.text.trim();
      if (!/^\D?\d{1,4}$/.test(t)) continue;
      const h = w.bbox.y1 - w.bbox.y0;
      if (h <= gH) continue;
      let val = null;
      if (coinInside(w.bbox) && t.length >= 2) val = t.slice(1).replace(/\D/g, '');
      else if (/^\d{1,3}$/.test(t) && coinRatio(w.bbox) > 0.12) val = t;
      if (val && val.length <= 3) { gH = h; gBest = +val; }
    }
    if (gBest != null) r.gold = gBest;

    // synergy: "Nama 2/4" di kiri skrin
    const syn = [];
    for (const l of lines) {
      if (l.bbox.x0 > W * 0.4) continue;
      const m = l.text.match(/([A-Za-z][A-Za-z .'&-]{2,22}?)\s*[:\-]?\s*(\d)\s*[\/|]\s*(\d{1,2})/);
      if (!m) continue;
      const name = m[1].trim().replace(/\s+/g, ' ');
      if (name.length < 3 || syn.some((x) => norm(x.name) === norm(name))) continue;
      syn.push({ name, count: +m[2], need: +m[3] });
    }
    if (syn.length) r.synergies = syn;

    // kedudukan akhir
    if (G.mcRound) {
      const m = text.match(/\b([1-8])\s*(st|nd|rd|th)\b/i) || text.match(/(?:no\.?|top|rank|place|placement|#)\s*([1-8])\b/i);
      if (m) r.place = +m[1];
    }
    updateMC(r, 'skrin penuh');
  }

  const SYN_COLORS = ['#ffc93c', '#8b5cff', '#36b8ff', '#ff2d4a', '#19b36b', '#ff8a1e', '#b6ff3c'];
  function updateMC(r, src) {
    const p = {};
    if (r.gold != null && r.gold !== S.mc.gold) p.gold = r.gold;
    if (r.level != null && r.level !== S.mc.level) p.level = r.level;
    if (r.hp != null) { G.mcHpNow = r.hp; if (r.hp !== S.mc.hp) p.hp = r.hp; }
    if (r.players && JSON.stringify(r.players) !== JSON.stringify(S.mc.players)) p.players = r.players;
    let analyse = false;
    if (r.round && r.round !== G.mcRound) {
      // round bertukar → menang kalau HP tak turun sejak awal round lepas
      if (G.mcRound && G.mcHpStart != null && G.mcHpNow != null) {
        const lost = G.mcHpNow < G.mcHpStart;
        const sk = lost ? Math.min(0, S.mc.streak) - 1 : Math.max(0, S.mc.streak) + 1;
        p.streak = sk;
        fire(lost ? (sk <= -3 ? { kind: 'mc', type: 'losestreak', n: -sk } : { kind: 'mc', type: 'lose' }) : (sk >= 3 ? { kind: 'mc', type: 'streak', n: sk } : { kind: 'mc', type: 'win' }));
      }
      if (/^1-[12]$/.test(r.round)) { G.mcRankFired = false; p.streak = 0; if (G.mcRound) log('Game Magic Chess baru', 'warn'); }
      log(`MC round ${r.round} (${src})`);
      G.mcRound = r.round; p.round = r.round; G.mcHpStart = G.mcHpNow ?? null;
      analyse = true;
    }
    if (r.level != null && G.mcLevel && r.level > G.mcLevel) fire({ kind: 'mc', type: 'levelup' });
    if (r.level != null) G.mcLevel = r.level;
    if (r.synergies) {
      const sig = JSON.stringify(r.synergies);
      if (sig === G.mcSynPrev && sig !== G.mcSynSet) {   // stabil 2 scan
        G.mcSynSet = sig;
        const before = new Set((S.mc.synergies || []).filter((x) => +x.count >= +x.need).map((x) => norm(x.name)));
        p.synergies = r.synergies.map((x, i) => ({ ...x, color: SYN_COLORS[i % SYN_COLORS.length] }));
        r.synergies.filter((x) => x.count >= x.need && !before.has(norm(x.name))).forEach((x) => fire({ kind: 'mc', type: 'synergy', text: `${x.name} (${x.count})` }));
      }
      G.mcSynPrev = sig;
    }
    if (r.place && !G.mcRankFired) {
      G.mcRankFired = true;
      fire({ kind: 'mc', type: 'place', place: r.place });
      patch({ record: r.place <= 4 ? { w: S.record.w + 1 } : { l: S.record.l + 1 } });
    }
    if (Object.keys(p).length) { Object.assign(S.mc, p); patch({ mc: p }).then(() => { if (analyse) fireAnalysis(); }); }
    else if (analyse) fireAnalysis();
    $('stMC').textContent = `R ${G.mcRound || '-'} · HP ${S.mc.hp} · 💰${S.mc.gold} · Lv${S.mc.level} · ${(S.mc.synergies || []).map((x) => `${x.name} ${x.count}/${x.need}`).join(', ') || 'tiada synergy'}`;
  }

  // analisis round: tunggu sekejap supaya gold/HP round baru sempat dibaca
  let analysisT;
  function fireAnalysis() {
    clearTimeout(analysisT);
    analysisT = setTimeout(() => {
      const a = window.MCANALYSIS.analyze(S.mc);
      log(`📊 Analisis ${a.round}: Top4 ${a.top4}% · Juara ${a.win}% · ${a.plan}`, 'ev');
      fire({ kind: 'mc', type: 'analysis' });
    }, 3500);
  }

  // kawasan MC yang dilukis sendiri — lebih laju & tepat (pilihan)
  async function scanMC() {
    const R = A().regions, cal = A().calibrated || {};
    if (!Object.keys(cal).some((k) => k.startsWith('mc') && cal[k])) return;
    const read = async (r, h = 90) => (await ocr(wReg, cropCanvas(r, { height: h, pad: 10 }))).text;
    const r = {};
    if (cal.mcRound) { const m = (await read(R.mcRound)).match(/([1-9])\s*[-–—]\s*([1-9])/); if (m) r.round = `${m[1]}-${m[2]}`; }
    if (cal.mcGold) { const m = (await read(R.mcGold)).match(/\d{1,3}/); if (m) r.gold = +m[0]; }
    if (cal.mcHp) { const m = (await read(R.mcHp)).match(/\d{1,3}/); if (m && +m[0] <= 100) r.hp = +m[0]; }
    if (cal.mcRank && G.mcRound && !G.mcRankFired) {
      const t = await read(R.mcRank, 140);
      const m = t.match(/\b([1-8])\s*(st|nd|rd|th)\b/i) || t.match(/(?:no\.?|top|rank|place|#)\s*([1-8])\b/i);
      if (m) r.place = +m[1];
    }
    updateMC(r, 'kawasan');
  }

  // ---------- jadual (Web Worker ticker — tak diperlahankan bila tab di belakang) ----------
  const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),250)'], { type: 'text/javascript' })));
  let busyFull = false, busyFast = false, lastFull = 0, lastFast = 0, lastMC = 0;
  ticker.onmessage = () => {
    if (!S || !wFull || !grab()) return drawPreview();
    const now = Date.now();
    const mc = S.mode === 'mc';
    const fullEvery = mc ? 3000 : G.phase === 'game' ? 6000 : 2500;
    if (!busyFull && now - lastFull > fullEvery) {
      busyFull = true; lastFull = now;
      scanFull().catch((e) => log('scan: ' + e.message, 'err')).finally(() => { busyFull = false; });
    }
    if (!mc) scanTemplates();
    if (!mc && !busyFast && now - lastFast > 700) {
      busyFast = true; lastFast = now;
      scanFast().catch((e) => log('fast: ' + e.message, 'err')).finally(() => { busyFast = false; });
    }
    if (mc && A().on.mc && !busyFast && now - lastMC > 1500) {
      busyFast = true; lastMC = now;
      scanMC().catch((e) => log('mc: ' + e.message, 'err')).finally(() => { busyFast = false; });
    }
    if (!mc && A().on.items && G.phase !== 'draft' && G.phase !== 'loading') scanItems();
    drawPreview();
  };

  // ---------- preview + kalibrasi kawasan ----------
  const REG_LABEL = { banner: 'Banner kill', result: 'Victory/Defeat', items: 'Slot item', mcRound: 'MC round', mcGold: 'MC gold', mcHp: 'MC HP', mcRank: 'MC kedudukan' };
  const REG_COLOR = { banner: '#ff2d4a', result: '#ffc93c', items: '#b6ff3c', mcRound: '#36b8ff', mcGold: '#ffc93c', mcHp: '#19b36b', mcRank: '#8b5cff' };
  let editReg = null, drag = null, lastBoxes = [], showBoxesUntil = 0;
  $('regSel').insertAdjacentHTML('beforeend', Object.entries(REG_LABEL).map(([k, l]) => `<button class="sm" data-reg="${k}" style="border-color:${REG_COLOR[k]}">${l}</button>`).join(''));
  $('regSel').onclick = (e) => {
    const k = e.target.dataset.reg; if (!k) return;
    editReg = editReg === k ? null : k;
    [...$('regSel').querySelectorAll('button')].forEach((b) => b.classList.toggle('on', b.dataset.reg === editReg));
  };
  const pv = $('preview'), pctx = pv.getContext('2d');
  function rel(e) { const b = pv.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; }
  pv.onmousedown = (e) => { if (editReg) drag = { a: rel(e), b: rel(e) }; };
  pv.onmousemove = (e) => { if (drag) drag.b = rel(e); };
  addEventListener('mouseup', () => {
    if (!drag) return;
    const { a, b } = drag; drag = null;
    const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
    if (r.w < 0.01 || r.h < 0.01) return;
    const R = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
    patch({ auto: { regions: { [editReg]: R }, calibrated: { [editReg]: true } } });
    G.slotPrev = []; G.slotStable = [];
    log(`Kawasan "${REG_LABEL[editReg]}" dikemas kini`);
  });
  function drawPreview() {
    pv.width = frame.width || 1280; pv.height = frame.height || 720;
    if (frame.width && running) pctx.drawImage(frame, 0, 0); else { pctx.fillStyle = '#111'; pctx.fillRect(0, 0, pv.width, pv.height); pctx.fillStyle = '#888'; pctx.font = '28px sans-serif'; pctx.fillText('Belum ada sumber skrin — klik sini atau tekan "Tangkap tetingkap / skrin"', 40, 60); }
    if (!S) return;
    const W = pv.width, H = pv.height, mc = S.mode === 'mc';
    const show = mc ? ['mcRound', 'mcGold', 'mcHp', 'mcRank'] : ['banner', 'result', ...(A().on.items ? ['items'] : [])];
    if (editReg && !show.includes(editReg)) show.push(editReg);
    pctx.lineWidth = 3; pctx.font = 'bold 20px sans-serif';
    for (const k of show) {
      const r = A().regions[k]; if (!r) continue;
      pctx.strokeStyle = pctx.fillStyle = REG_COLOR[k];
      pctx.setLineDash(editReg === k ? [10, 6] : []);
      pctx.strokeRect(r.x * W, r.y * H, r.w * W, r.h * H);
      pctx.fillText(REG_LABEL[k], r.x * W + 6, r.y * H + 22);
      if (k === 'items') slotRects().forEach((s) => pctx.strokeRect(s.x * W, s.y * H, s.w * W, s.h * H));
    }
    pctx.setLineDash([]);
    if (drag) { pctx.strokeStyle = '#fff'; const { a, b } = drag; pctx.strokeRect(a.x * W, a.y * H, (b.x - a.x) * W, (b.y - a.y) * H); }
    if (Date.now() < showBoxesUntil) { pctx.strokeStyle = '#0ff'; pctx.lineWidth = 1; lastBoxes.forEach((b) => pctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)); }
  }
  $('ocrTest').onclick = async () => {
    if (!running) {
      log('Belum ada sumber skrin — pilih tetingkap game / Windowed Projector dulu.', 'warn');
      if (!(await pickScreen())) return;
      await new Promise((r) => setTimeout(r, 800));
    }
    if (!grab()) return log('Skrin belum sedia — cuba tekan sekali lagi.', 'err');
    const data = await ocr(wFull, cropCanvas({ x: 0, y: 0, w: 1, h: 1 }, { threshold: 170 }));
    lastBoxes = data.words.map((w) => w.bbox); showBoxesUntil = Date.now() + 8000;
    const heroes = findHeroes(data.words).map((h) => h.hero);
    $('ocrOut').textContent = `Hero dikesan: ${heroes.join(', ') || 'tiada'}`;
    log('OCR: ' + data.text.replace(/\s+/g, ' ').slice(0, 300));
  };
  $('regReset').onclick = () => patch({ auto: { regions: {
    banner: { x: 0.28, y: 0.08, w: 0.44, h: 0.26 }, result: { x: 0.15, y: 0.12, w: 0.70, h: 0.45 }, items: { x: 0.30, y: 0.86, w: 0.40, h: 0.12 },
    mcRound: { x: 0.44, y: 0.00, w: 0.12, h: 0.07 }, mcGold: { x: 0.80, y: 0.88, w: 0.12, h: 0.08 }, mcHp: { x: 0.00, y: 0.15, w: 0.10, h: 0.08 }, mcRank: { x: 0.30, y: 0.25, w: 0.40, h: 0.30 },
  } } });

  // ---------- borang tetapan ----------
  function initForm() {
    $('heroList').innerHTML = D.HEROES.map((h) => `<option value="${esc(h.name)}">`).join('');
    $('ign').value = A().ign || ''; $('mainHero').value = A().mainHero || ''; $('allyRow').value = A().allyRow || 'auto';
    $('itemMode').value = A().items.mode; $('itemSlots').value = A().items.slots; $('itemDir').value = A().items.dir;
    document.querySelectorAll('[data-on]').forEach((cb) => { cb.checked = !!A().on[cb.dataset.on]; });
  }
  $('ign').onchange = (e) => patch({ auto: { ign: e.target.value.trim() } });
  $('mainHero').onchange = (e) => patch({ auto: { mainHero: D.findHero(e.target.value)?.name || e.target.value } });
  $('allyRow').onchange = (e) => patch({ auto: { allyRow: e.target.value } });
  $('itemMode').onchange = (e) => patch({ auto: { items: { mode: e.target.value } } });
  $('itemSlots').onchange = (e) => { patch({ auto: { items: { slots: Number(e.target.value) || 6 } } }); G.slotPrev = []; G.slotStable = []; };
  $('itemDir').onchange = (e) => patch({ auto: { items: { dir: e.target.value } } });
  document.querySelectorAll('[data-on]').forEach((cb) => cb.addEventListener('change', () => patch({ auto: { on: { [cb.dataset.on]: cb.checked } } })));

  resetGame(); setSrc(false);
  // hook untuk debug / test
  window.__auto = { mlFromFull, mcFromFull, updateMC, scanFull, grab, cropCanvas, ocr, findHeroes, regionPng, regionVec, bestTemplate, video, frame, workers: () => ({ wFull, wReg }), G };
})();
