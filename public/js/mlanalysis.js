// Analisis game Mobile Legends: peluang menang live + strategi ikut masa.
// Heuristik — gabung draft (counter, power spike) + skor kill + objektif + KDA.
// Masa objektif ikut patch semasa boleh berubah: edit OBJ di bawah.
(function () {
  const OBJ = { turtleFirst: 2, lordFirst: 8, turtleEnd: 8 };   // minit
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const phaseOf = (min) => (min < 6 ? 'early' : min < 14 ? 'mid' : 'late');
  const PHASE_LABEL = { early: 'EARLY GAME', mid: 'MID GAME', late: 'LATE GAME' };

  function analyze(state) {
    const ml = state.ml || {}, d = state.draft || {};
    const min = Number(ml.minute) || 0;
    const phase = phaseOf(min);
    const ak = Number(ml.allyKills) || 0, ek = Number(ml.enemyKills) || 0, kd = ak - ek;
    const kda = ml.kda || null;
    const obj = { at: Number(ml.turtles?.ally) || 0, et: Number(ml.turtles?.enemy) || 0, al: Number(ml.lords?.ally) || 0, el: Number(ml.lords?.enemy) || 0 };

    // draft
    const D = window.DRAFT;
    const hasDraft = D && (d.ally || []).length && (d.enemy || []).length;
    const pred = hasDraft ? D.predict(d.ally, d.enemy) : { ally: 50, reasons: [] };
    const allySpike = hasDraft ? D.powerSpike(d.ally) : null;
    const enemySpike = hasDraft ? D.powerSpike(d.enemy) : null;
    const allyStrongNow = allySpike && allySpike.counts[phase] > (enemySpike?.counts[phase] || 0);
    const enemyStrongNow = enemySpike && enemySpike.counts[phase] > (allySpike?.counts[phase] || 0);

    // ----- peluang menang -----
    // awal: draft banyak pengaruh; makin lama, skor & objektif lebih penting
    const wDraft = clamp(1 - min / 18, 0.25, 1);
    let x = (pred.ally - 50) / 50 * 1.2 * wDraft;              // draft
    x += clamp(kd / 8, -1.5, 1.5) * (0.6 + min / 20);           // beza kill
    x += (obj.at - obj.et) * 0.15 + (obj.al - obj.el) * 0.55;   // turtle / lord
    x += allyStrongNow ? 0.25 : enemyStrongNow ? -0.25 : 0;     // fasa power spike
    if (kda) x += clamp((kda.k + kda.a * 0.5 - kda.d * 1.2) / 20, -0.3, 0.3);
    const win = Math.round(clamp(100 / (1 + Math.exp(-x * 1.6)), 3, 97));

    // ----- strategi -----
    let plan, color, why;
    const lordUp = min >= OBJ.lordFirst, turtleUp = min >= OBJ.turtleFirst && min < OBJ.turtleEnd;
    if (win >= 70 && lordUp) { plan = 'PUSH & LORD'; color = '#b6ff3c'; why = 'Kita jauh di depan — ambil Lord dan push turret bersama'; }
    else if (win <= 30 && min >= 10) { plan = 'DEFEND'; color = '#36b8ff'; why = 'Musuh di depan — jaga turret, clear minion, tunggu musuh buat silap'; }
    else if (enemyStrongNow && kd <= 0) { plan = 'FARM & TUNGGU SPIKE'; color = '#ffc93c'; why = `Musuh kuat di ${PHASE_LABEL[phase]} — elak fight 5v5, farm sampai ${PHASE_LABEL[allySpike?.key || 'late']}`; }
    else if (allyStrongNow) { plan = 'GROUP & TEAMFIGHT'; color = '#ff2d4a'; why = `Ini ${PHASE_LABEL[phase]} — masa team kita paling kuat, paksa fight`; }
    else if (turtleUp && kd >= 0) { plan = 'AMBIL TURTLE'; color = '#36b8ff'; why = 'Kawal river & ambil Turtle — gold untuk satu team'; }
    else if (kd >= 4) { plan = 'SNOWBALL'; color = '#b6ff3c'; why = 'Lebih kill — invade jungle musuh & tekan turret'; }
    else if (kd <= -4) { plan = 'MAIN SELAMAT'; color = '#ff8a1e'; why = 'Kurang kill — jangan facecheck semak, cari pick-off'; }
    else { plan = 'KAWAL OBJEKTIF'; color = '#8b5cff'; why = lordUp ? 'Vision di Lord pit, fight bila ada kelebihan bilangan' : 'Farm, rotate ke lane yang lemah, sedia untuk Turtle'; }

    const tips = [why];
    if (min < OBJ.turtleFirst) tips.push(`Turtle pertama minit ${OBJ.turtleFirst}:00 — sedia di river`);
    else if (min < OBJ.lordFirst && min >= OBJ.lordFirst - 2) tips.push(`Lord keluar minit ${OBJ.lordFirst}:00 — mula kawal Lord pit`);
    if (kda && kda.d >= 4 && kda.d > kda.k) tips.push(`KDA ${kda.k}/${kda.d}/${kda.a} — kurangkan mati, main belakang tank`);
    if (kda && kda.k >= 5 && kda.d <= 2) tips.push(`KDA ${kda.k}/${kda.d}/${kda.a} — kau carry game ni, jangan mati untuk shut down`);
    const me = d.myHero;
    if (me && D) {
      const threats = (D.heroInfo(me)?.counters || []).filter((c) => (d.enemy || []).includes(c));
      if (threats.length) tips.push(`Hati-hati ${threats.join(', ')} — counter ${me}`);
    }
    if (obj.el > obj.al) tips.push('Musuh ada Lord lebih — defend dalam turret, jangan keluar seorang');

    return {
      minute: min, sec: Number(ml.sec) || 0, phase, phaseLabel: PHASE_LABEL[phase], ak, ek, kd, kda, gold: ml.gold, obj,
      win, plan, color, tips: tips.slice(0, 3), draftWin: pred.ally,
      spikeNote: allyStrongNow ? 'Team kita kuat sekarang' : enemyStrongNow ? 'Musuh kuat sekarang' : 'Seimbang',
    };
  }

  window.MLANALYSIS = { analyze, OBJ };
})();
