// Analisis round Magic Chess Go Go: peluang Top 4 / juara + strategi.
// Heuristik (bukan data rasmi) — guna HP semua pemain, level, gold, streak & synergy.
// Tweak nombor di bawah ikut meta / pengalaman sendiri.
(function () {
  // level sasaran ikut stage (stage = nombor pertama round, cth 3-2 → stage 3)
  const LEVEL_TARGET = { 1: 3, 2: 5, 3: 6, 4: 7, 5: 8, 6: 9, 7: 9 };
  const MAX_INTEREST = 5;      // 1 gold setiap 10 gold, maks 5
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function parseRound(r) {
    const m = String(r || '').match(/(\d+)\s*-\s*(\d+)/);
    return m ? { stage: +m[1], rnd: +m[2] } : { stage: 1, rnd: 1 };
  }

  function analyze(mc) {
    const { stage, rnd } = parseRound(mc.round);
    const hp = clamp(Number(mc.hp) || 0, 0, 100);
    const gold = Number(mc.gold) || 0;
    const level = Number(mc.level) || 1;
    const streak = Number(mc.streak) || 0;
    const syn = (mc.synergies || []).filter((s) => s.name);

    // ----- kedudukan HP -----
    const others = (mc.players || []).filter((p) => !p.me).map((p) => Number(p.hp)).filter((n) => n > 0);
    const alive = others.length ? others.length + 1 : 8;
    const rank = others.length ? 1 + others.filter((h) => h > hp).length : null;
    const hpScore = others.length ? (alive - rank) / Math.max(1, alive - 1) : hp / 100;

    // ----- level, synergy, ekonomi -----
    const target = LEVEL_TARGET[Math.min(stage, 7)] || 9;
    const levelDiff = level - target;
    const levelScore = clamp(0.5 + levelDiff * 0.25, 0, 1);
    const active = syn.filter((s) => +s.count >= +s.need);
    const synScore = clamp(active.reduce((a, s) => a + Math.min(2, s.count / s.need), 0) / Math.max(2, stage), 0, 1);
    const interest = Math.min(MAX_INTEREST, Math.floor(gold / 10));
    const econScore = clamp(gold / 50, 0, 1);
    const streakScore = clamp(0.5 + streak * 0.1, 0, 1);

    // ----- kekuatan keseluruhan → peluang -----
    // awal game ekonomi penting, lewat game HP & board penting
    const late = clamp((stage - 1) / 4, 0, 1);
    const S = clamp(
      hpScore * (0.30 + 0.20 * late) +
      levelScore * 0.18 +
      synScore * (0.17 + 0.05 * late) +
      econScore * (0.20 - 0.15 * late) +
      streakScore * 0.15 - (hp <= 20 ? 0.15 : 0), 0, 1);
    const top4 = Math.round(clamp(100 / (1 + Math.exp(-6 * (S - 0.45))), 3, 97) * (alive <= 4 ? 0 : 1) + (alive <= 4 ? 100 : 0));
    const win = Math.round(clamp((top4 / 100) ** 2.2 * 100 * (4 / Math.max(4, alive)) * 1.1, 1, 90));

    // ----- strategi -----
    let plan, color, why;
    if (hp <= 25 && stage >= 2) { plan = 'ALL-IN'; color = '#ff2d4a'; why = 'HP kritikal — guna semua gold untuk refresh & kuatkan board sekarang'; }
    else if (hp <= 45 && stage >= 3) { plan = 'STABILKAN'; color = '#ff8a1e'; why = `Roll sampai tinggal ~${Math.max(10, interest * 10 - 20)} gold, cari upgrade bintang 2`; }
    else if (streak >= 3) { plan = 'JAGA STREAK'; color = '#b6ff3c'; why = 'Win streak — level up / refresh sikit supaya streak tak putus'; }
    else if (streak <= -3 && hp > 50 && stage <= 3) { plan = 'LOSE STREAK ECON'; color = '#36b8ff'; why = 'Simpan gold, kutip bonus lose streak; roll besar di stage 4'; }
    else if (gold >= 50) { plan = levelDiff < 1 ? 'LEVEL UP' : 'ROLL'; color = '#ffc93c'; why = 'Gold lebih 50 tak tambah interest — guna lebihan'; }
    else if (levelDiff < 0 && gold >= (stage <= 2 ? 34 : 20)) { plan = 'LEVEL UP'; color = '#8b5cff'; why = `Level ${level} bawah sasaran Lv${target} untuk stage ${stage}`; }
    else { plan = 'ECON'; color = '#19b36b'; why = 'Simpan gold untuk interest, beli hero yang sesuai synergy sahaja'; }

    const tips = [why];
    if (interest < MAX_INTEREST && !['ALL-IN', 'STABILKAN', 'ROLL'].includes(plan)) {
      const need = (interest + 1) * 10 - gold;
      if (need <= 6) tips.push(`Simpan ${need} gold lagi → interest +${interest + 1}`);
    }
    const near = syn.filter((s) => +s.count < +s.need).sort((a, b) => (a.need - a.count) - (b.need - b.count))[0];
    if (near) tips.push(`${near.name} ${near.count}/${near.need} — cari ${near.need - near.count} hero lagi untuk aktif`);
    if (!active.length && stage >= 2) tips.push('Tiada synergy aktif — fokus 1-2 synergy utama');
    if (levelDiff >= 1 && plan !== 'ALL-IN') tips.push(`Level ${level} atas sasaran — board patut kuat, tekan lawan`);
    if (rank && rank > alive / 2 && hp > 25) tips.push(`HP #${rank} dari ${alive} — jangan biar HP jatuh bawah 40`);
    if (rank === 1) tips.push(`HP tertinggi dalam lobby (#1 dari ${alive})`);

    return {
      round: mc.round, stage, rnd, hp, gold, level, streak, target, levelDiff, interest,
      rank, alive, top4, win, plan, color, tips: tips.slice(0, 3), activeSyn: active.length, strength: Math.round(S * 100),
    };
  }

  window.MCANALYSIS = { analyze };
})();
