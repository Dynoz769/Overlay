// Control panel — buka dalam Chrome/Edge (perlu untuk voice listener).
(function () {
  const D = window.MLDATA, DR = window.DRAFT;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let S = null, offset = 0;
  const now = () => Date.now() + offset;

  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
  const patch = (p) => post('/api/state', p);
  const fire = (ev) => post('/api/event', ev);

  const SPELLS = { flicker: 120, retribution: 35, inspire: 75, execute: 90, purify: 90, sprint: 100, revitalize: 100, aegis: 90, petrify: 90, vengeance: 75, flameshot: 50, arrival: 75 };
  const SPELL_WORDS = {
    flicker: ['flicker', 'flick', 'flik', 'fliker', 'flika', 'blink', 'kilat'],
    retribution: ['retribution', 'retri', 'retry', 'ritri', 'retribut'],
    inspire: ['inspire', 'inspirasi', 'spire'],
    execute: ['execute', 'eksekusi', 'exe'],
    purify: ['purify', 'pure', 'puri'],
    sprint: ['sprint', 'lari'],
    revitalize: ['revitalize', 'revit', 'heal'],
    aegis: ['aegis', 'shield', 'perisai'],
    petrify: ['petrify', 'petri', 'batu'],
    vengeance: ['vengeance', 'venge', 'veng'],
    flameshot: ['flameshot', 'flame', 'flame shot'],
    arrival: ['arrival', 'teleport', 'tp'],
  };

  // ---------- SSE ----------
  const es = new EventSource('/events');
  es.onopen = () => { $('conn').textContent = 'tersambung'; $('conn').className = 'conn ok'; };
  es.onerror = () => { $('conn').textContent = 'terputus — server hidup?'; $('conn').className = 'conn'; };
  es.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.type === 'state') { S = msg.state; offset = msg.now - Date.now(); render(); }
  };

  // ---------- Hero datalist ----------
  $('heroList').innerHTML = D.HEROES.map((h) => `<option value="${esc(h.name)}">`).join('');

  // ---------- Mode ----------
  $('modeSwitch').addEventListener('click', (e) => { const m = e.target.dataset.mode; if (m) patch({ mode: m }); });

  // ---------- Umum ----------
  $('badgeText').addEventListener('change', (e) => patch({ badge: e.target.value || 'SISTEM LIVE' }));
  document.querySelectorAll('[data-show]').forEach((cb) => cb.addEventListener('change', () => patch({ show: { [cb.dataset.show]: cb.checked } })));
  $('recReset').onclick = () => patch({ record: { w: 0, l: 0 } });
  $('freeGo').onclick = () => $('freeText').value && fire({ kind: 'text', text: $('freeText').value, sub: $('freeSub').value });

  // ---------- Kill / Win ----------
  const KILL_BTNS = [['first_blood', '🩸 First Blood'], ['solo', '⚔️ Solo Kill'], ['double', 'Double Kill'], ['triple', 'Triple Kill'], ['mega', 'Mega Kill'], ['maniac', 'Maniac'], ['savage', '👑 Savage'], ['spree', 'Killing Spree'], ['monster', 'Monster Kill'], ['godlike', 'Godlike'], ['legendary', 'Legendary'], ['shutdown', 'Shut Down'], ['wipe', 'Wiped Out'], ['lord', '🐉 Lord'], ['turtle', '🐢 Turtle'], ['death', '💀 Mati']];
  $('killBtns').innerHTML = KILL_BTNS.map(([k, l]) => `<button data-kill="${k}">${l}</button>`).join('');
  $('killBtns').onclick = (e) => { const k = e.target.dataset.kill; if (k) fire({ kind: 'kill', type: k }); };
  document.querySelectorAll('[data-fire]').forEach((b) => b.onclick = () => fire({ kind: b.dataset.fire }));

  // ---------- Item ----------
  let cat = '';
  const CAT_COLOR = { magic: '#8b5cff', attack: '#ff2d4a', defense: '#36b8ff', movement: '#b6ff3c' };
  function renderItems() {
    const q = $('itemSearch').value.toLowerCase();
    const list = D.ITEMS.filter((i) => (!cat || i.cat === cat) && (!q || i.name.toLowerCase().includes(q)));
    $('itemList').innerHTML = list.map((i) => `<button data-item="${i.id}" style="--c:${CAT_COLOR[i.cat]}">${esc(i.name)}</button>`).join('');
    return list;
  }
  $('itemTabs').onclick = (e) => { if (e.target.dataset.cat === undefined) return; cat = e.target.dataset.cat; [...$('itemTabs').children].forEach((b) => b.classList.toggle('on', b === e.target)); renderItems(); };
  $('itemTabs').children[0].classList.add('on');
  $('itemSearch').oninput = renderItems;
  $('itemSearch').onkeydown = (e) => { if (e.key === 'Enter') { const l = renderItems(); if (l[0]) fire({ kind: 'item', id: l[0].id }); } };
  $('itemList').onclick = (e) => { const id = e.target.dataset.item; if (id) fire({ kind: 'item', id }); };
  $('fullBuild').onclick = () => fire({ kind: 'fullbuild' });
  renderItems();

  // ---------- Draft ----------
  function slots(id, side) {
    $(id).innerHTML = [0, 1, 2, 3, 4].map((i) => `<div class="slot"><input list="heroList" data-side="${side}" data-i="${i}" placeholder="${side} ${i + 1}">${side === 'enemy' ? `<button class="sm" data-pick="${i}" title="Papar kad enemy pick">▶</button>` : ''}</div>`).join('');
  }
  slots('allyIn', 'ally'); slots('enemyIn', 'enemy');
  function readDraft() {
    const get = (side) => [...document.querySelectorAll(`[data-side="${side}"]`)].map((i) => i.value.trim()).filter(Boolean).map((n) => D.findHero(n)?.name || n);
    return { ally: get('ally'), enemy: get('enemy'), bans: $('bans').value.split(',').map((s) => s.trim()).filter(Boolean), myHero: $('myHero').value.trim() };
  }
  function draftPreview() {
    const d = readDraft();
    const p = DR.predict(d.ally, d.enemy), s = DR.powerSpike(d.ally);
    const bans = DR.banSuggest(d.myHero || d.ally[0] || '', d.bans, [...d.ally, ...d.enemy]);
    $('draftPreview').innerHTML = `<b class="a">${p.ally}%</b> vs <b class="e">${p.enemy}%</b> · ${p.verdict}<br>${esc(p.reasons.join(' · '))}<br>Power spike: <b>${s.label}</b><br>Ban: ${bans.map((b) => esc(b.name)).join(', ')}`;
  }
  let draftT;
  document.querySelector('.draft').addEventListener('input', () => { draftPreview(); clearTimeout(draftT); draftT = setTimeout(() => patch({ draft: readDraft() }), 400); });
  document.querySelector('.draft').addEventListener('click', (e) => {
    const i = e.target.dataset.pick; if (i === undefined) return;
    const v = document.querySelector(`[data-side="enemy"][data-i="${i}"]`).value;
    if (v) patch({ draft: readDraft() }).then(() => fire({ kind: 'draft', view: 'pick', hero: v, side: 'enemy' }));
  });
  document.querySelectorAll('[data-draft]').forEach((b) => b.onclick = () => patch({ draft: readDraft() }).then(() => fire({ kind: 'draft', view: b.dataset.draft })));
  $('draftClear').onclick = () => { document.querySelectorAll('.draft input').forEach((i) => i.value = ''); patch({ draft: readDraft() }); draftPreview(); };
  $('draftClear').insertAdjacentHTML('afterend', '<button id="draftToSpell" title="Salin hero musuh ke spell timer">→ Spell timer</button>');
  $('draftToSpell').onclick = () => {
    const d = readDraft();
    const enemies = S.enemies.map((e, i) => ({ ...e, hero: d.enemy[i] || e.hero }));
    patch({ enemies });
  };

  // ---------- Spell ----------
  const spellOpts = Object.keys(SPELLS).map((s) => `<option value="${s}">${s[0].toUpperCase() + s.slice(1)}</option>`).join('');
  $('spellRows').innerHTML = [0, 1, 2, 3, 4].map((i) => `
    <div class="spellrow" id="sr${i}">
      <span class="n">${i + 1}</span>
      <input list="heroList" data-sp="hero" data-i="${i}" placeholder="Hero musuh">
      <select data-sp="spell" data-i="${i}">${spellOpts}</select>
      <input type="number" data-sp="cd" data-i="${i}" min="1">
      <button data-start="${i}">Start</button>
      <span class="left" id="left${i}">—</span>
    </div>`).join('');
  $('spellRows').addEventListener('change', (e) => {
    const k = e.target.dataset.sp; if (!k) return;
    const i = Number(e.target.dataset.i);
    const enemies = S.enemies.map((x) => ({ ...x }));
    if (k === 'hero') enemies[i].hero = D.findHero(e.target.value)?.name || e.target.value;
    if (k === 'spell') { enemies[i].spell = e.target.value; enemies[i].cd = SPELLS[e.target.value]; }
    if (k === 'cd') enemies[i].cd = Number(e.target.value) || enemies[i].cd;
    patch({ enemies });
  });
  $('spellRows').addEventListener('click', (e) => { const i = e.target.dataset.start; if (i !== undefined) post('/api/spell', { index: Number(i) }); });
  $('spellReset').onclick = () => post('/api/spell', { reset: true });
  $('deckUrl').textContent = `${location.origin}/spell`;

  setInterval(() => {
    if (!S) return;
    S.enemies.forEach((e, i) => {
      const left = e.endsAt ? Math.ceil((e.endsAt - now()) / 1000) : 0;
      $('left' + i).textContent = left > 0 ? `⏱ ${left}s` : 'READY';
      $('sr' + i).classList.toggle('active', left > 0);
    });
  }, 250);

  // ---------- Voice listener (Web Speech API) ----------
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false;
  function vlog(t, hit) {
    const d = document.createElement('div'); d.textContent = t; if (hit) d.className = 'hit';
    $('voiceLog').prepend(d);
    while ($('voiceLog').children.length > 30) $('voiceLog').lastChild.remove();
  }
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  function heroKeys(name) {
    const n = norm(name), keys = new Set([n, n.replace(/ /g, '')]);
    n.split(' ').forEach((w) => w.length >= 3 && keys.add(w));
    if (n.length >= 5) keys.add(n.slice(0, 4));
    return [...keys];
  }
  function parse(text) {
    const t = norm(text);
    if (/\breset\b/.test(t)) { post('/api/spell', { reset: true }); vlog(`"${text}" → RESET semua`, true); return; }
    let spell = null;
    for (const [s, words] of Object.entries(SPELL_WORDS)) if (words.some((w) => new RegExp(`\\b${w}\\b`).test(t))) { spell = s; break; }
    const idx = S.enemies.findIndex((e) => e.hero && heroKeys(e.hero).some((k) => t.includes(k)));
    if (idx < 0) return vlog(`"${text}" → hero musuh tak dijumpai`);
    post('/api/spell', { index: idx, spell });
    vlog(`"${text}" → ${S.enemies[idx].hero} · ${spell || S.enemies[idx].spell}`, true);
  }
  function startVoice() {
    if (!Rec) return vlog('Browser ni tak support voice. Guna Google Chrome / Microsoft Edge.');
    rec = new Rec();
    rec.lang = $('voiceLang').value; rec.continuous = true; rec.interimResults = false;
    rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) parse(e.results[i][0].transcript); };
    rec.onerror = (e) => vlog('voice error: ' + e.error);
    rec.onend = () => { if (listening) try { rec.start(); } catch { /* sedang mula */ } };
    rec.start(); listening = true;
    $('voiceBtn').classList.add('on'); $('voiceBtn').textContent = '🎙️ Sedang dengar… (klik untuk henti)';
  }
  function stopVoice() { listening = false; rec?.stop(); $('voiceBtn').classList.remove('on'); $('voiceBtn').textContent = '🎙️ Mula voice listener'; }
  $('voiceBtn').onclick = () => listening ? stopVoice() : startVoice();
  $('voiceLang').onchange = () => { if (listening) { stopVoice(); startVoice(); } };

  // ---------- Promo ----------
  function promoRow(p = {}) {
    const d = document.createElement('div'); d.className = 'promorow';
    d.innerHTML = `<input data-k="icon" placeholder="ikon" value="${esc(p.icon)}"><input data-k="title" placeholder="TAJUK" value="${esc(p.title)}"><input data-k="sub" placeholder="sub-teks" value="${esc(p.sub)}"><button class="sm">✕</button>`;
    d.querySelector('button').onclick = () => d.remove();
    $('promoRows').appendChild(d);
  }
  $('promoAdd').onclick = () => promoRow();
  $('promoSave').onclick = () => {
    const promos = [...$('promoRows').children].map((r) => Object.fromEntries([...r.querySelectorAll('input')].map((i) => [i.dataset.k, i.value]))).filter((p) => p.title);
    patch({ promos, mascot: $('mascot').value });
  };

  // ---------- Magic Chess ----------
  const MC_FIELDS = { mcRound: 'round', mcHp: 'hp', mcGold: 'gold', mcLevel: 'level', mcStreak: 'streak' };
  Object.entries(MC_FIELDS).forEach(([id, k]) => $(id).addEventListener('change', (e) => patch({ mc: { [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value } })));
  function nextRound(r) { const [a, b] = String(r || '1-1').split('-').map(Number); return b >= 7 ? `${a + 1}-1` : `${a}-${(b || 0) + 1}`; }
  $('mcWin').onclick = () => {
    const sk = Math.max(0, S.mc.streak) + 1;
    patch({ mc: { streak: sk, round: nextRound(S.mc.round) } });
    fire(sk >= 3 ? { kind: 'mc', type: 'streak', n: sk } : { kind: 'mc', type: 'win' });
    setTimeout(() => fire({ kind: 'mc', type: 'analysis' }), 600);
  };
  $('mcLose').onclick = () => {
    const sk = Math.min(0, S.mc.streak) - 1;
    const hp = Math.max(0, S.mc.hp - (Number($('mcDmg').value) || 0));
    patch({ mc: { streak: sk, hp, round: nextRound(S.mc.round) } });
    fire(sk <= -3 ? { kind: 'mc', type: 'losestreak', n: -sk } : { kind: 'mc', type: 'lose' });
    setTimeout(() => fire({ kind: 'mc', type: 'analysis' }), 600);
  };
  $('mcLevelUp').onclick = () => patch({ mc: { level: Math.min(10, S.mc.level + 1) } }).then(() => fire({ kind: 'mc', type: 'levelup' }));
  $('placeBtns').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8].map((p) => `<button data-place="${p}" class="${p === 1 ? 'win' : p > 4 ? 'lose' : ''}">#${p}</button>`).join('') + '<button class="ghost" id="mcNew">Game baru</button>';
  $('placeBtns').onclick = (e) => {
    if (e.target.id === 'mcNew') return patch({ mc: { round: '1-1', hp: 100, gold: 0, level: 1, streak: 0 } });
    const p = e.target.dataset.place; if (!p) return;
    fire({ kind: 'mc', type: 'place', place: Number(p) });
    if (p <= 4) patch({ record: { w: S.record.w + 1 } }); else patch({ record: { l: S.record.l + 1 } });
  };
  // ---------- Analisis ML ----------
  $('mlAnalyse').onclick = () => fire({ kind: 'ml', type: 'analysis' });
  const mlNum = (id, k) => $(id).addEventListener('change', (e) => patch({ ml: { [k]: Number(e.target.value) || 0 } }));
  mlNum('mlMin', 'minute'); mlNum('mlAk', 'allyKills'); mlNum('mlEk', 'enemyKills');
  $('mlKda').addEventListener('change', (e) => { const m = e.target.value.match(/(\d+)\D+(\d+)\D+(\d+)/); patch({ ml: { kda: m ? { k: +m[1], d: +m[2], a: +m[3] } : null } }); });
  $('mlObj').addEventListener('change', (e) => {
    const n = (e.target.value.match(/\d+/g) || []).map(Number);
    patch({ ml: { turtles: { ally: n[0] || 0, enemy: n[1] || 0 }, lords: { ally: n[2] || 0, enemy: n[3] || 0 } } });
  });
  function renderMLAnalysis() {
    if (!window.MLANALYSIS || !S || !S.ml) return;
    const a = MLANALYSIS.analyze(S), ml = S.ml;
    const setVal = (el, v) => { if (el && document.activeElement !== el) el.value = v ?? ''; };
    setVal($('mlMin'), ml.minute); setVal($('mlAk'), ml.allyKills); setVal($('mlEk'), ml.enemyKills);
    setVal($('mlKda'), ml.kda ? `${ml.kda.k}/${ml.kda.d}/${ml.kda.a}` : '');
    setVal($('mlObj'), `${ml.turtles?.ally || 0}-${ml.turtles?.enemy || 0} / ${ml.lords?.ally || 0}-${ml.lords?.enemy || 0}`);
    $('mlAnalysis').innerHTML = `Peluang menang <b class="a">${a.win}%</b> · ${esc(a.phaseLabel)} (${esc(a.spikeNote)}) · Strategi <b style="color:${a.color}">${esc(a.plan)}</b><br>${a.tips.map(esc).join('<br>')}`;
  }
  $('mcAnalyse').onclick = () => fire({ kind: 'mc', type: 'analysis' });
  function renderAnalysis() {
    if (!window.MCANALYSIS || !S) return;
    const a = MCANALYSIS.analyze(S.mc);
    $('mcAnalysis').innerHTML = `Top 4 <b class="a">${a.top4}%</b> · Juara <b class="e" style="color:var(--gold)">${a.win}%</b> · Strategi <b style="color:${a.color}">${esc(a.plan)}</b><br>${a.tips.map(esc).join('<br>')}`;
  }
  function synRow(s = {}) {
    const d = document.createElement('div'); d.className = 'synrow';
    d.innerHTML = `<input data-k="name" placeholder="nama synergy" value="${esc(s.name)}"><input data-k="count" type="number" placeholder="ada" value="${esc(s.count)}"><input data-k="need" type="number" placeholder="perlu" value="${esc(s.need)}"><input data-k="color" type="color" value="${esc(s.color || '#ffc93c')}"><button class="sm">✕</button>`;
    d.querySelector('button').onclick = () => d.remove();
    $('synRows').appendChild(d);
  }
  $('synAdd').onclick = () => synRow();
  $('synSave').onclick = () => {
    const before = new Set((S.mc.synergies || []).filter((s) => +s.count >= +s.need).map((s) => s.name));
    const synergies = [...$('synRows').children].map((r) => Object.fromEntries([...r.querySelectorAll('input')].map((i) => [i.dataset.k, i.type === 'number' ? Number(i.value) : i.value]))).filter((s) => s.name);
    patch({ mc: { synergies } });
    synergies.filter((s) => s.count >= s.need && !before.has(s.name)).forEach((s) => fire({ kind: 'mc', type: 'synergy', text: `${s.name} (${s.count})` }));
  };

  // ---------- Hotkeys ----------
  addEventListener('keydown', (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'k') fire({ kind: 'kill', type: 'solo' });
    if (k === 'v') fire({ kind: 'win' });
    if (k === 'd') fire({ kind: 'lose' });
    if (k === 'f') fire({ kind: 'fullbuild' });
    if (k >= '1' && k <= '5') post('/api/spell', { index: Number(k) - 1 });
  });

  // ---------- Render dari state ----------
  let first = true;
  function render() {
    document.body.dataset.mode = S.mode;
    [...$('modeSwitch').children].forEach((b) => b.classList.toggle('on', b.dataset.mode === S.mode));
    const setVal = (el, v) => { if (el && document.activeElement !== el) el.value = v ?? ''; };
    setVal($('badgeText'), S.badge);
    document.querySelectorAll('[data-show]').forEach((cb) => cb.checked = !!S.show[cb.dataset.show]);
    $('recW').textContent = S.record.w; $('recL').textContent = S.record.l;
    S.enemies.forEach((e, i) => {
      setVal(document.querySelector(`[data-sp="hero"][data-i="${i}"]`), e.hero);
      setVal(document.querySelector(`[data-sp="spell"][data-i="${i}"]`), e.spell);
      setVal(document.querySelector(`[data-sp="cd"][data-i="${i}"]`), e.cd);
    });
    Object.entries(MC_FIELDS).forEach(([id, k]) => setVal($(id), S.mc[k]));
    renderAnalysis();
    renderMLAnalysis();
    if (first) {
      first = false;
      const d = S.draft || {};
      (d.ally || []).forEach((h, i) => setVal(document.querySelector(`[data-side="ally"][data-i="${i}"]`), h));
      (d.enemy || []).forEach((h, i) => setVal(document.querySelector(`[data-side="enemy"][data-i="${i}"]`), h));
      setVal($('bans'), (d.bans || []).join(', ')); setVal($('myHero'), d.myHero);
      $('mascot').value = S.mascot || '';
      (S.promos || []).forEach(promoRow);
      (S.mc.synergies || []).forEach(synRow);
      draftPreview();
    }
  }
})();
