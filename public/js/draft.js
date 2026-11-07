// Enjin Draft Pick: win prediction, counter pick, ban suggestion, power spike.
// Heuristik ringkas (bukan AI) — cukup untuk overlay; tweak pemberat di bawah.
(function () {
  const D = window.MLDATA;
  const LANES = ['exp', 'jungle', 'mid', 'gold', 'roam'];
  const LANE_LABEL = { exp: 'EXP Lane', jungle: 'Jungle', mid: 'Mid Lane', gold: 'Gold Lane', roam: 'Roam' };
  const SPIKE_INFO = {
    early: { label: 'EARLY GAME', when: '1-6 min · level 1-6, item pertama', plan: 'Invade awal, rebut Turtle pertama & snowball laju' },
    mid: { label: 'MID GAME', when: '6-14 min · level 8+, 2-3 core item, Turtle & Lord', plan: 'Group untuk Turtle & Lord, paksa teamfight' },
    late: { label: 'LATE GAME', when: '14+ min · full build, Lord kedua', plan: 'Main selamat, farm & tunggu item siap — elak fight awal' },
  };

  const heroes = (list) => (list || []).map(D.findHero).filter(Boolean);
  const counteredBy = (name) => D.COUNTERED_BY[name] || [];

  function coverage(team) {
    const lanes = new Set(team.map((h) => h.lane));
    const roles = new Set(team.flatMap((h) => h.roles));
    let s = lanes.size; // 0-5
    if (roles.has('tank') || roles.has('support')) s += 1;
    if (roles.has('mage')) s += 0.5;
    if (roles.has('marksman')) s += 0.5;
    return { score: s, lanes, roles };
  }

  // berapa kali team A counter team B
  function counterHits(a, b) {
    const hits = [];
    for (const target of b) for (const c of counteredBy(target.name)) {
      const h = a.find((x) => x.name === c);
      if (h) hits.push(`${h.name} > ${target.name}`);
    }
    return hits;
  }

  function spikeOf(team) {
    const c = { early: 0, mid: 0, late: 0 };
    team.forEach((h) => c[h.spike]++);
    const top = Object.entries(c).sort((x, y) => y[1] - x[1])[0];
    return { counts: c, key: team.length ? top[0] : 'mid' };
  }

  function strengths(team) {
    const r = team.flatMap((h) => h.roles);
    const n = (k) => r.filter((x) => x === k).length;
    const out = [], weak = [];
    if (n('tank') + n('support') >= 2) out.push('Teamfight CC');
    if (n('assassin') >= 2) out.push('Pick-off');
    if (n('mage') >= 2) out.push('Burst magic');
    if (n('marksman') >= 1 && n('tank') >= 1) out.push('Protect carry');
    if (n('fighter') >= 2) out.push('Sustain / dive');
    if (n('tank') === 0) weak.push('Tiada frontline');
    if (n('mage') === 0) weak.push('Kurang magic dmg');
    if (n('marksman') === 0 && n('mage') <= 1) weak.push('Kurang late dmg');
    if (n('assassin') + n('fighter') >= 4) weak.push('Mudah kena kite');
    return { strengths: out.length ? out : ['Seimbang'], weaknesses: weak.length ? weak : ['Tiada kelemahan jelas'] };
  }

  function predict(allyNames, enemyNames) {
    const ally = heroes(allyNames), enemy = heroes(enemyNames);
    const ca = coverage(ally), ce = coverage(enemy);
    const allyHits = counterHits(ally, enemy);
    const enemyHits = counterHits(enemy, ally);
    let pct = 50 + 7 * (allyHits.length - enemyHits.length) + 4 * (ca.score - ce.score);
    pct = Math.round(Math.max(15, Math.min(85, pct)));
    const reasons = [];
    const better = pct >= 50;
    if (allyHits.length !== enemyHits.length) reasons.push(`${allyHits.length > enemyHits.length ? 'Counter matchup lebih baik' : 'Musuh counter kita'}`);
    if (ca.score !== ce.score) reasons.push(`${ca.score > ce.score ? 'Komposisi team lebih seimbang' : 'Komposisi musuh lebih seimbang'}`);
    if (ca.lanes.size !== ce.lanes.size) reasons.push(`${ca.lanes.size > ce.lanes.size ? 'Lane coverage kita lebih baik' : 'Lane coverage musuh lebih baik'}`);
    reasons.push(...(better ? allyHits : enemyHits).slice(0, 2));
    return {
      ally: pct, enemy: 100 - pct,
      verdict: pct > 55 ? 'ALLY FAVOURED' : pct < 45 ? 'ENEMY FAVOURED' : 'EVEN MATCH',
      reasons: reasons.length ? reasons : ['Draft seimbang — skill tentukan menang'],
      allyHits, enemyHits,
    };
  }

  function counterPicks(enemyName, taken = []) {
    const tk = new Set(taken.map((t) => String(t).toLowerCase()));
    return counteredBy(enemyName).filter((n) => !tk.has(n.toLowerCase())).slice(0, 3);
  }

  function banSuggest(myHero, bans = [], picks = []) {
    const taken = new Set([...bans, ...picks].map((x) => String(x).toLowerCase()));
    const out = [];
    for (const n of counteredBy(myHero)) if (!taken.has(n.toLowerCase())) out.push({ name: n, why: `Susah untuk ${myHero}` });
    for (const n of D.META_BANS) if (!taken.has(n.toLowerCase()) && !out.find((o) => o.name === n) && n !== myHero) out.push({ name: n, why: 'Meta · selalu kena ban' });
    return out.slice(0, 3);
  }

  function powerSpike(allyNames) {
    const team = heroes(allyNames);
    const sp = spikeOf(team);
    const st = strengths(team);
    return { key: sp.key, counts: sp.counts, ...SPIKE_INFO[sp.key], ...st };
  }

  function heroInfo(name) {
    const h = D.findHero(name);
    if (!h) return null;
    return { ...h, laneLabel: LANE_LABEL[h.lane], spikeLabel: SPIKE_INFO[h.spike].label, counters: counterPicks(h.name) };
  }

  window.DRAFT = { predict, counterPicks, banSuggest, powerSpike, heroInfo, LANES, LANE_LABEL, SPIKE_INFO };
})();
