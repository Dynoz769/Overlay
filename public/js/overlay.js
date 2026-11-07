// Logik overlay OBS — terima event dari server (SSE) dan main animasi.
(function () {
  const D = window.MLDATA, DR = window.DRAFT;
  const qs = new URLSearchParams(location.search);
  const W = Number(qs.get('w') || 1080), H = Number(qs.get('h') || 1920);
  const ONLY = qs.get('only') ? new Set(qs.get('only').split(',')) : null;
  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas');

  // ---------- kanvas & skala ----------
  canvas.style.setProperty('--w', W + 'px');
  canvas.style.setProperty('--h', H + 'px');
  if (W > H) {
    Object.entries({ '--stage-top': '16%', '--stage-h': '62%', '--spell-top': '16%', '--promo-bottom': '3%', '--callout-top': '75%', '--mc-top': '9%', '--syn-top': '20%' })
      .forEach(([k, v]) => canvas.style.setProperty(k, v));
    $('stage').style.cssText = 'left:27%;right:27%';
    $('promo').style.cssText = 'right:auto;width:36%;height:120px';
  }
  if (qs.get('preview') === '1') document.body.classList.add('preview');
  function fit() { canvas.style.setProperty('--scale', Math.min(innerWidth / W, innerHeight / H)); }
  addEventListener('resize', fit); fit();

  const on = (mod) => !ONLY || ONLY.has(mod);
  [['badge', 'badge'], ['dots', 'badge'], ['record', 'record'], ['stage', 'stage'], ['spells', 'spells'], ['callout', 'spells'], ['promo', 'promo'], ['mc', 'mc'], ['syn', 'mc'], ['fx', 'stage']]
    .forEach(([id, mod]) => { if (!on(mod)) $(id).remove(); });

  // ---------- util ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (n) => String(n || '?').split(/[\s-]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  function avatar(name, cls = '') {
    const h = D.findHero(name);
    const slug = h ? h.slug : String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `<span class="avatar ${cls}"><img src="assets/heroes/${slug}.png" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.replaceWith(document.createTextNode('${initials(h ? h.name : name).replace(/'/g, '')}'))"></span>`;
  }
  function itemIcon(it) {
    return `<img src="assets/items/${it.id}.png" alt="" onerror="this.outerHTML='<div>${initials(it.name)}</div>'">`;
  }
  const SPELL_ICON = { flicker: '✨', retribution: '🔥', inspire: '⚡', execute: '🗡️', purify: '💠', sprint: '👟', revitalize: '💚', aegis: '🛡️', petrify: '🪨', vengeance: '🌀', flameshot: '☄️', arrival: '🌌' };
  const SPELL_NAME = (s) => s ? s[0].toUpperCase() + s.slice(1) : '';
  const fmt = (sec) => { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };

  // ---------- state dari server ----------
  let S = null, offset = 0;
  const es = new EventSource('/events');
  es.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.type === 'state') { S = msg.state; offset = msg.now - Date.now(); renderState(); }
    if (msg.type === 'event') handle(msg.event);
  };
  const now = () => Date.now() + offset;

  function renderState() {
    const show = S.show || {};
    const set = (id, v) => { const el = $(id); if (el) el.classList.toggle('hidden', !v); };
    set('badge', show.badge); set('dots', show.badge);
    set('record', show.record); set('promo', show.promo);
    set('spells', show.spells && S.mode === 'ml');
    set('mc', show.mc && S.mode === 'mc'); set('syn', show.mc && S.mode === 'mc');
    if ($('badge')) $('badge').textContent = S.badge || 'SISTEM LIVE';
    if ($('record')) {
      let chip = '';
      if (S.mode === 'ml' && window.MLANALYSIS && (S.ml?.minute || S.ml?.allyKills || S.ml?.enemyKills)) {
        const a = MLANALYSIS.analyze(S);
        chip = ` · <b style="color:var(--blue)">${a.win}%</b> <b style="color:${a.color}">${esc(a.plan)}</b>`;
      }
      $('record').innerHTML = `<b class="w">W ${S.record.w}</b> · <b class="l">L ${S.record.l}</b>${chip}`;
    }
    renderMC();
    renderPromo(true);
  }

  // ---------- popup queue (stage) ----------
  const queue = [];
  let busy = false;
  function enqueue(build, ms, sfx) { queue.push({ build, ms, sfx }); if (!busy) next(); }
  function next() {
    const job = queue.shift();
    if (!job || !$('stage')) { busy = false; return; }
    busy = true;
    const el = job.build();
    $('stage').appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    if (job.sfx) SFX.play(job.sfx);
    setTimeout(() => {
      el.classList.remove('in'); el.classList.add('out');
      setTimeout(() => { el.remove(); next(); }, 450);
    }, job.ms);
  }
  const node = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };

  // ---------- handlers ----------
  function handle(ev) {
    switch (ev.kind) {
      case 'item': return showItem(ev);
      case 'fullbuild': return enqueue(() => node('pop full-card', `<div class="num">6</div><div><div class="chips"><span class="chip">★ Full Build</span><span class="chip attack">6 / 6</span></div><h2>Item Penuh!</h2></div>`), 4500, 'win');
      case 'kill': return showKill(ev);
      case 'win': case 'lose': return showResult(ev);
      case 'draft': return showDraft(ev);
      case 'spell': return showCallout(ev);
      case 'mc': return showMC(ev);
      case 'ml': return showMLAnalysis();
      case 'text': return enqueue(() => node('pop kill', `<div class="bar"><h1 style="font-size:96px">${esc(ev.text)}</h1>${ev.sub ? `<div class="sub">${esc(ev.sub)}</div>` : ''}</div>`), ev.ms || 3500, 'pop');
    }
  }

  function showItem(ev) {
    const it = D.findItem(ev.id) || (ev.name ? { id: 'custom', name: ev.name, cat: ev.cat || 'magic', stats: ev.stats || '', passive: ev.passive || '', desc: ev.desc || '' } : null);
    if (!it) return;
    enqueue(() => node('pop item-card', `
      <div class="icon-ring">${itemIcon(it)}</div>
      <div class="meta">
        <div class="chips"><span class="chip">★ Item Siap</span><span class="chip ${it.cat}">${esc(it.cat)}</span></div>
        <h2>${esc(it.name)}</h2>
        <div class="stats">${esc(it.stats)}</div>
        <div class="desc">${it.passive ? `<span class="passive">${esc(it.passive)}</span>` : ''}<span>${esc(it.desc)}</span></div>
      </div>`), 5000, 'item');
  }

  const KILLS = {
    first_blood: ['FIRST BLOOD', '🩸', 'Darah pertama!', '#ff2d4a'],
    solo: ['SOLO KILL', '⚔️', '1 lawan 1 — menang!', '#ff2d4a'],
    double: ['DOUBLE KILL', '⚔️', '2 musuh tumbang', '#ff6a2d'],
    triple: ['TRIPLE KILL', '🔥', '3 musuh tumbang', '#ff8a1e'],
    mega: ['MEGA KILL', '🔥', '4 musuh tumbang', '#ffb21e'],
    maniac: ['MANIAC', '💀', '4 kill berturut!', '#ffc93c', 'gold'],
    savage: ['SAVAGE', '👑', 'SATU TEAM TUMBANG!', '#ffc93c', 'gold'],
    spree: ['KILLING SPREE', '»', '3 kill tak mati', '#ffc93c', 'gold'],
    monster: ['MONSTER KILL', '👹', '4 kill tak mati', '#ffc93c', 'gold'],
    godlike: ['GODLIKE', '⚡', '5 kill tak mati', '#ffc93c', 'gold'],
    legendary: ['LEGENDARY', '🏆', 'Tak dapat dihalang!', '#ffc93c', 'gold'],
    shutdown: ['SHUT DOWN', '🛑', 'Streak musuh ditamatkan', '#36b8ff'],
    wipe: ['WIPED OUT', '☠️', 'Semua musuh mati', '#ffc93c', 'gold'],
    lord: ['LORD SLAIN', '🐉', 'Push sekarang!', '#8b5cff'],
    turtle: ['TURTLE SLAIN', '🐢', 'Buff gold untuk team', '#36b8ff'],
    death: ['TUMBANG', '💀', 'Takpe, comeback!', '#8a8f9c'],
  };
  function showKill(ev) {
    const k = KILLS[ev.type] || KILLS.solo;
    const sub = ev.hero && ev.victim ? `${ev.hero} ➜ ${ev.victim}` : k[2];
    enqueue(() => {
      const el = node(`pop kill ${k[4] || ''}`, `<div class="emblem">${k[1]}</div><div class="bar"><h1>${k[0]}</h1><div class="sub">${esc(sub)}</div></div>`);
      el.style.setProperty('--kc', k[3]);
      return el;
    }, 3200, 'kill');
  }

  function showResult(ev) {
    const win = ev.kind === 'win';
    const word = win ? 'VICTORY' : 'DEFEAT';
    enqueue(() => {
      const el = node(`result ${win ? '' : 'defeat'}`, `
        <div class="trophy">${win ? '🏆' : '💔'}</div>
        <h1>${word}</h1>
        <div class="wl">${win ? 'MENANG' : 'KALAH'} · W${ev.w} - L${ev.l}</div>
        <div class="marquee"><span>${(`${word} ✦ `).repeat(16)}</span></div>`);
      if (win) confetti();
      return el;
    }, 7000, win ? 'win' : 'lose');
  }

  function confetti() {
    const fx = $('fx'); if (!fx) return;
    const colors = ['#ffc93c', '#ff2d4a', '#36b8ff', '#b6ff3c', '#fff', '#8b5cff'];
    for (let i = 0; i < 140; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-duration:${2.5 + Math.random() * 3}s;animation-delay:${Math.random() * 1.5}s;--fall:${H + 100}px;transform:rotate(${Math.random() * 360}deg)`;
      fx.appendChild(c);
      setTimeout(() => c.remove(), 8000);
    }
  }

  // ---------- Draft ----------
  function showDraft(ev) {
    const d = S?.draft || {};
    const views = ev.view === 'cycle' || !ev.view ? ['predict', 'spike', 'ban'] : [ev.view];
    const ms = ev.ms || 7000;
    for (const v of views) {
      if (v === 'predict') enqueue(() => draftPredict(d), ms, 'pop');
      if (v === 'spike') enqueue(() => draftSpike(d), ms, 'pop');
      if (v === 'ban') enqueue(() => draftBan(d), ms, 'pop');
      if (v === 'pick') enqueue(() => draftPick(ev.hero || (d.enemy || []).slice(-1)[0], ev.side || 'enemy', d), ms, 'pop');
    }
  }
  const tag = (t) => `<span class="tag">${esc(t)}</span>`;

  function draftPredict(d) {
    const p = DR.predict(d.ally, d.enemy);
    const el = node('pop dpanel', `${tag('Draft Pick · Counter Pick')}
      <div class="dtitle">Win Prediction</div><div class="dsub">Draft Strength · ${p.verdict}</div>
      <div class="wp-row">
        <div class="ally"><div class="lbl">ALLY</div><div class="pct">${p.ally}%</div><div class="avs">${(d.ally || []).map((h) => avatar(h, 'sm')).join('')}</div></div>
        <div class="vs">VS</div>
        <div class="enemy"><div class="lbl">ENEMY</div><div class="pct">${p.enemy}%</div><div class="avs">${(d.enemy || []).map((h) => avatar(h, 'sm enemy')).join('')}</div></div>
      </div>
      <div class="wp-bar"><i style="width:50%"></i></div>
      <div class="reasons">${p.reasons.map((r, i) => `<span>${esc(r)}</span>`).join(' · ')}</div>`);
    setTimeout(() => { const b = el.querySelector('.wp-bar i'); if (b) b.style.width = p.ally + '%'; }, 400);
    return el;
  }

  function draftSpike(d) {
    const s = DR.powerSpike(d.ally);
    const max = Math.max(1, ...Object.values(s.counts));
    const cols = ['early', 'mid', 'late'].map((k) => `<div class="${k === s.key ? 'on' : ''}"><i style="height:${20 + (s.counts[k] / max) * 80}px"></i>${k.toUpperCase()}</div>`).join('');
    return node('pop dpanel spike', `${tag('Draft Pick · Counter Pick')}
      <div class="dtitle" style="text-align:left;color:var(--blue)">Ally Power Spike</div>
      <div style="display:flex;gap:30px;align-items:flex-start;margin-top:8px">
        <div style="flex:1.2"><div class="dsub" style="text-align:left">Terkuat ketika</div><h2>${s.label}</h2><div class="when">${esc(s.when)}</div><div class="cols">${cols}</div></div>
        <div style="flex:1"><div class="dsub" style="text-align:left">Kekuatan</div><div class="pills">${s.strengths.map((x) => `<span class="pill">${esc(x)}</span>`).join('')}</div>
          <div class="dsub" style="text-align:left;margin-top:14px">Kelemahan</div><div class="pills">${s.weaknesses.map((x) => `<span class="pill bad">${esc(x)}</span>`).join('')}</div></div>
      </div>
      <div class="plan"><b>GAME PLAN</b>${esc(s.plan)}</div>`);
  }

  function draftBan(d) {
    const me = d.myHero || (d.ally || [])[0] || '';
    const list = DR.banSuggest(me, d.bans, [...(d.ally || []), ...(d.enemy || [])]);
    return node('pop dpanel', `${tag('Draft Pick · Counter Pick')}
      <div class="dtitle" style="text-align:left">Ban Suggestion <small style="font-size:20px;color:var(--ink-dim);font-style:normal;letter-spacing:1px">meta / hero buff${me ? ` · untuk ${esc(me)}` : ''}</small></div>
      ${list.map((b, i) => `<div class="ban-row" style="animation-delay:${0.15 * i}s"><span class="n">${i + 1}</span>${avatar(b.name)}<h3>${esc(b.name)}</h3><p>${esc(b.why)}</p></div>`).join('')}`);
  }

  function draftPick(name, side, d) {
    const h = DR.heroInfo(name);
    if (!h) return node('pop dpanel', `${tag('Draft Pick')}<div class="dtitle">${esc(name || 'Tiada hero')}</div>`);
    const taken = [...(d.ally || []), ...(d.enemy || []), ...(d.bans || [])];
    const ctr = DR.counterPicks(h.name, taken);
    return node('pop dpanel', `${tag('Draft Pick · Counter Pick')}
      <div class="pick-card">${avatar(h.name, side === 'enemy' ? 'enemy' : '')}
        <div style="flex:1">
          <div class="chips"><span class="chip ${side}">${side === 'enemy' ? 'Enemy Pick' : 'Ally Pick'}</span>${h.roles.map((r) => `<span class="chip dim">${esc(r)}</span>`).join('')}<span class="chip dim">${esc(h.laneLabel)}</span><span class="chip">★ ${esc(h.spikeLabel)}</span></div>
          <h2>${esc(h.name)}</h2>
          ${ctr.length ? `<div class="row">COUNTER: ${ctr.map((c) => `<span class="ctr">${avatar(c, 'sm')}${esc(c)}</span>`).join('')}</div>` : '<div class="row">Tiada counter dalam data — tambah di data/heroes.js</div>'}
        </div>
      </div>`);
  }

  // ---------- Spell timers ----------
  const readyShown = {};
  function tickSpells() {
    const box = $('spells');
    if (!box || !S) return;
    const t = now();
    let html = '';
    S.enemies.forEach((e, i) => {
      if (!e.endsAt) return;
      const left = (e.endsAt - t) / 1000;
      if (left > 0) {
        readyShown[i] = false;
        html += `<div class="sp ${left <= 10 ? 'low' : ''}">${avatar(e.hero, 'enemy')}<span class="spell-ic">${SPELL_ICON[e.spell] || '✨'}</span><span class="t">${fmt(left)}</span></div>`;
      } else if (left > -5) {
        if (!readyShown[i]) { readyShown[i] = true; SFX.play('ready'); }
        html += `<div class="sp ready">${avatar(e.hero, 'enemy')}<span class="spell-ic">${SPELL_ICON[e.spell] || '✨'}</span><span class="t">READY</span></div>`;
      }
    });
    // elak render semula img setiap tick kalau sama struktur
    const sig = html.replace(/\d+:\d+/g, '');
    if (box.dataset.sig !== sig) { box.innerHTML = html; box.dataset.sig = sig; }
    else box.querySelectorAll('.sp:not(.ready) .t').forEach((el, k) => { el.textContent = (html.match(/\d+:\d+/g) || [])[k] || ''; });
  }
  setInterval(tickSpells, 250);

  let calloutT;
  function showCallout(ev) {
    const c = $('callout'); if (!c) return;
    c.innerHTML = `<div class="mic">🎙️</div><div class="who">${esc(ev.hero)} · ${esc(SPELL_NAME(ev.spell))}</div><div class="cd">⏱ ${ev.cd}s</div>`;
    c.classList.remove('hidden'); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = 'popIn .4s';
    SFX.play('spell');
    clearTimeout(calloutT); calloutT = setTimeout(() => c.classList.add('hidden'), 3000);
  }

  // ---------- Promo ----------
  const PROMO_ICON = { crown: '👑', vip: '🎖️', album: '🖼️', gift: '🎁', star: '⭐', fire: '🔥', game: '🎮', heart: '❤️' };
  let promoIdx = 0, promoSig = '';
  function renderPromo(fromState) {
    const el = $('promo'); if (!el || !S) return;
    const list = S.promos || [];
    const sig = JSON.stringify(list) + (S.mascot || '');
    if (fromState && sig === promoSig) return;
    promoSig = sig;
    if (!list.length) { el.classList.add('hidden'); return; }
    const p = list[promoIdx % list.length];
    const mascot = S.mascot && /\.(png|gif|webp|jpg)$/i.test(S.mascot) ? `<img src="${esc(S.mascot)}" style="height:130px">` : esc(S.mascot || '🎧');
    const sub = esc(p.sub).replace(/(RM\s?\d+)/g, '<b>$1</b>');
    el.innerHTML = `<div class="mascot">${mascot}</div><div class="slot" key="${promoIdx}"><div class="pic">${PROMO_ICON[p.icon] || esc(p.icon || '⭐')}</div><div><h3>${esc(p.title)}</h3><p>${sub}</p></div></div>`;
  }
  setInterval(() => { promoIdx++; promoSig = ''; renderPromo(); }, 9000);

  // ---------- Magic Chess ----------
  function renderMC() {
    const el = $('mc'); if (!el || !S) return;
    const m = S.mc || {};
    const hp = Math.max(0, Math.min(100, Number(m.hp) || 0));
    const sk = Number(m.streak) || 0;
    el.innerHTML = `
      <div class="box"><small>ROUND</small><b>${esc(m.round)}</b></div>
      <div class="box hp"><small>HP · ${hp}</small><div class="hpbar"><i class="${hp < 30 ? 'low' : hp < 60 ? 'mid' : ''}" style="width:${hp}%"></i></div></div>
      <div class="box"><small>GOLD</small><b style="color:var(--gold)">${esc(m.gold)}</b></div>
      <div class="box"><small>LEVEL</small><b>${esc(m.level)}</b></div>
      <div class="box streak ${sk > 0 ? 'win' : sk < 0 ? 'lose' : ''}"><small>STREAK</small><b>${sk > 0 ? '🔥' + sk : sk < 0 ? '❄️' + -sk : '-'}</b></div>
      ${window.MCANALYSIS && m.round ? (() => { const a = MCANALYSIS.analyze(m); return `<div class="box"><small>TOP 4</small><b style="color:var(--blue)">${a.top4}%</b></div><div class="box" style="border-color:${a.color}"><small>PLAN</small><b style="color:${a.color};font-size:30px">${esc(a.plan)}</b></div>`; })() : ''}`;
    const syn = $('syn');
    if (syn) syn.innerHTML = (m.synergies || []).filter((s) => s.name).map((s) => {
      const active = Number(s.count) >= Number(s.need || 99);
      return `<div class="${active ? 'on' : ''}" style="--c:${esc(s.color || '#ffc93c')}"><b>${esc(s.count)}</b>${esc(s.name)}${s.need ? ` <small style="opacity:.6">/ ${esc(s.need)}</small>` : ''}</div>`;
    }).join('');
  }

  function showAnalysis() {
    if (!S || !window.MCANALYSIS) return;
    const a = MCANALYSIS.analyze(S.mc);
    const sk = a.streak > 0 ? `🔥${a.streak} menang` : a.streak < 0 ? `❄️${-a.streak} kalah` : '—';
    const build = (html, pct) => { const el = node('pop dpanel mca', html); setTimeout(() => { el.querySelector('.mca-bar i').style.width = pct + '%'; }, 700); return el; };
    enqueue(() => build(`${tag('Magic Chess · Analisis Round')}
      <div class="mca-head"><div><div class="dsub" style="text-align:left">Round</div><div class="mca-round">${esc(a.round || '-')}</div></div>
        <div class="mca-pct t4"><small>TOP 4</small><b>${a.top4}%</b></div>
        <div class="mca-pct w1"><small>JUARA</small><b>${a.win}%</b></div></div>
      <div class="mca-plan" style="--pc:${a.color}"><span>STRATEGI</span><b>${esc(a.plan)}</b></div>
      <div class="mca-stats">
        <span>❤️ HP ${a.hp}${a.rank ? ` <em>#${a.rank}/${a.alive}</em>` : ''}</span>
        <span>⭐ Lv${a.level} <em>sasaran ${a.target}</em></span>
        <span>💰 ${a.gold} <em>+${a.interest} interest</em></span>
        <span>${sk}</span>
      </div>
      <div class="mca-bar"><i style="width:0%"></i><label>KEKUATAN ${a.strength}</label></div>
      <ul class="mca-tips">${a.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, a.strength), 9000, 'pop');
  }

  function showMLAnalysis() {
    if (!S || !window.MLANALYSIS) return;
    const a = MLANALYSIS.analyze(S);
    const t = `${String(a.minute).padStart(2, '0')}:${String(a.sec).padStart(2, '0')}`;
    const o = a.obj;
    const build = (html) => { const el = node('pop dpanel mca', html); setTimeout(() => { const b = el.querySelector('.wp-bar i'); if (b) b.style.width = a.win + '%'; }, 700); return el; };
    enqueue(() => build(`${tag('Mobile Legends · Analisis Game')}
      <div class="mca-head"><div><div class="dsub" style="text-align:left">Masa</div><div class="mca-round">${t}</div></div>
        <div class="mca-pct t4"><small>ALLY MENANG</small><b>${a.win}%</b></div>
        <div class="mca-pct" style="color:var(--red)"><small>ENEMY</small><b style="color:var(--red)">${100 - a.win}%</b></div></div>
      <div class="wp-bar" style="margin:6px 0 12px"><i style="width:50%"></i></div>
      <div class="mca-plan" style="--pc:${a.color}"><span>STRATEGI</span><b>${esc(a.plan)}</b></div>
      <div class="mca-stats">
        <span>⚔️ Kill <b style="color:var(--blue)">${a.ak}</b> - <b style="color:var(--red)">${a.ek}</b></span>
        ${a.kda ? `<span>🎯 KDA ${a.kda.k}/${a.kda.d}/${a.kda.a}</span>` : ''}
        <span>🐢 ${o.at}-${o.et} · 🐉 ${o.al}-${o.el}</span>
        <span>⏱ ${a.phaseLabel} <em>${esc(a.spikeNote)}</em></span>
      </div>
      <ul class="mca-tips" style="margin-top:10px">${a.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`), 9000, 'pop');
  }

  function showMC(ev) {
    if (ev.type === 'analysis') return showAnalysis();
    const MAP = {
      win: ['ROUND WIN', 'Menang pusingan', '#b6ff3c'],
      lose: ['ROUND LOSE', 'Kalah pusingan', '#ff2d4a'],
      streak: [`WIN STREAK`, `🔥 x${ev.n || S?.mc?.streak || 3}`, '#ffc93c'],
      losestreak: ['LOSE STREAK', `❄️ x${ev.n || 3} · gold bonus!`, '#36b8ff'],
      levelup: ['LEVEL UP', `Level ${S?.mc?.level || ''}`, '#8b5cff'],
      synergy: ['SYNERGY AKTIF', ev.text || '', '#ffc93c'],
      place: [ev.place == 1 ? 'CHAMPION!' : `TOP ${ev.place}`, ev.place == 1 ? '👑 Juara Magic Chess' : ev.place <= 4 ? 'Dapat bintang!' : 'Next game!', ev.place <= 4 ? '#ffc93c' : '#ff2d4a'],
    };
    const [title, sub, color] = MAP[ev.type] || [ev.text || 'MAGIC CHESS', '', '#ffc93c'];
    if (ev.type === 'place' && ev.place == 1) confetti();
    enqueue(() => node('pop mcban', `<h1 style="color:${color}">${esc(ev.text && ev.type !== 'synergy' ? ev.text : title)}</h1>${sub ? `<div class="sub" style="color:${color}">${esc(sub)}</div>` : ''}`), 3500, ev.type === 'lose' ? 'lose' : ev.type === 'place' && ev.place == 1 ? 'win' : 'kill');
  }
})();
