// Senarai hero MLBB untuk Draft Pick / Counter Pick / Spell Timer.
// Format: 'Nama|role|lane|spike'
//   role  : tank, fighter, assassin, mage, marksman, support (boleh 2, guna '/')
//   lane  : exp, mid, gold, jungle, roam
//   spike : early, mid, late  (bila hero paling kuat)
// Gambar hero (pilihan): letak fail di public/assets/heroes/<slug>.png  (contoh: yi-sun-shin.png)
// Boleh edit / tambah hero baru bila patch berubah.
(function () {
  const RAW = `
Miya|marksman|gold|late
Balmond|fighter|jungle|early
Saber|assassin|jungle|early
Alice|mage/tank|exp|mid
Nana|mage|mid|early
Tigreal|tank|roam|mid
Alucard|fighter/assassin|exp|mid
Karina|assassin/mage|jungle|mid
Akai|tank|roam|mid
Franco|tank|roam|early
Bane|fighter/mage|jungle|mid
Bruno|marksman|gold|late
Clint|marksman|gold|mid
Rafaela|support|roam|early
Eudora|mage|mid|early
Zilong|fighter/assassin|exp|mid
Fanny|assassin|jungle|mid
Layla|marksman|gold|late
Minotaur|tank|roam|mid
Lolita|tank|roam|mid
Hayabusa|assassin|jungle|mid
Freya|fighter|exp|mid
Gord|mage|mid|mid
Natalia|assassin|roam|early
Kagura|mage|mid|mid
Chou|fighter|roam|early
Sun|fighter|exp|late
Alpha|fighter|exp|mid
Ruby|fighter|exp|mid
Yi Sun-shin|marksman/assassin|jungle|mid
Moskov|marksman|gold|late
Johnson|tank|roam|mid
Cyclops|mage|mid|mid
Estes|support|roam|mid
Hilda|fighter/tank|exp|early
Aurora|mage|mid|mid
Lapu-Lapu|fighter|exp|mid
Vexana|mage|mid|mid
Roger|fighter/marksman|jungle|mid
Karrie|marksman|gold|late
Gatotkaca|tank/fighter|roam|mid
Harley|assassin/mage|jungle|mid
Irithel|marksman|gold|late
Grock|tank|roam|early
Argus|fighter|exp|late
Odette|mage|mid|mid
Lancelot|assassin|jungle|mid
Diggie|support|roam|mid
Hylos|tank|roam|mid
Zhask|mage|mid|mid
Helcurt|assassin|jungle|mid
Pharsa|mage|mid|mid
Lesley|marksman/assassin|gold|late
Jawhead|fighter|roam|early
Angela|support|roam|mid
Gusion|assassin|jungle|mid
Valir|mage|mid|mid
Martis|fighter|exp|early
Uranus|tank|exp|late
Hanabi|marksman|gold|late
Chang'e|mage|mid|mid
Kaja|support/fighter|roam|mid
Selena|assassin/mage|roam|early
Aldous|fighter|exp|late
Claude|marksman|gold|late
Vale|mage|mid|mid
Leomord|fighter|jungle|mid
Lunox|mage|mid|mid
Hanzo|assassin|jungle|mid
Belerick|tank|roam|mid
Kimmy|marksman/mage|gold|mid
Thamuz|fighter|exp|early
Harith|mage|gold|mid
Minsitthar|fighter|roam|early
Kadita|mage/assassin|mid|mid
Faramis|support/mage|roam|mid
Badang|fighter|exp|mid
Khufra|tank|roam|mid
Granger|marksman|jungle|mid
Guinevere|fighter/mage|exp|mid
Esmeralda|mage/tank|exp|mid
Terizla|fighter|exp|mid
X.Borg|fighter|exp|mid
Ling|assassin|jungle|late
Dyrroth|fighter|exp|early
Lylia|mage|mid|mid
Baxia|tank|jungle|mid
Masha|fighter/tank|exp|mid
Wanwan|marksman|gold|late
Silvanna|fighter|exp|mid
Cecilion|mage|mid|late
Carmilla|support|roam|mid
Atlas|tank|roam|mid
Popol and Kupa|marksman|gold|mid
Yu Zhong|fighter|exp|mid
Luo Yi|mage|mid|mid
Benedetta|assassin|exp|mid
Khaleed|fighter|exp|early
Barats|tank|jungle|mid
Brody|marksman|gold|mid
Yve|mage|mid|mid
Mathilda|support/assassin|roam|mid
Paquito|fighter|exp|early
Gloo|tank|roam|mid
Beatrix|marksman|gold|mid
Phoveus|fighter|exp|mid
Natan|marksman|gold|late
Aulus|fighter|jungle|late
Aamon|assassin|jungle|mid
Valentina|mage|mid|mid
Edith|tank/marksman|roam|mid
Floryn|support|roam|mid
Yin|fighter/assassin|jungle|early
Melissa|marksman|gold|mid
Xavier|mage|mid|mid
Julian|fighter/mage|jungle|mid
Fredrinn|tank/fighter|jungle|mid
Joy|assassin|jungle|mid
Novaria|mage|mid|mid
Arlott|fighter/assassin|exp|mid
Ixia|marksman|gold|late
Nolan|assassin|jungle|mid
Cici|fighter|exp|mid
Chip|tank/support|roam|mid
Zhuxin|mage|mid|mid
Suyou|assassin/fighter|jungle|mid
Lukas|fighter|exp|mid
Kalea|support/fighter|roam|mid
Zetian|mage|mid|mid
Obsidia|marksman|gold|late
Sora|fighter|exp|mid
Marcel|tank|roam|mid
Hirara|marksman|gold|late`;

  const HEROES = RAW.trim().split('\n').map((line) => {
    const [name, role, lane, spike] = line.split('|');
    return {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      roles: role.split('/'),
      lane,
      spike,
    };
  });

  // Counter: hero → senarai hero yang counter dia (susah untuk dia).
  // Ini titik permulaan — ubah ikut meta / pengalaman sendiri.
  const COUNTERED_BY = {
    Chou: ['Gloo', 'Masha', 'Aulus', 'Khufra'],
    Fanny: ['Saber', 'Kaja', 'Khufra', 'Minsitthar', 'Chou'],
    Ling: ['Kaja', 'Saber', 'Khufra', 'Chou'],
    Lancelot: ['Saber', 'Kaja', 'Minsitthar', 'Ruby'],
    Hayabusa: ['Kaja', 'Saber', 'Chou', 'Khufra'],
    Gusion: ['Kaja', 'Saber', 'Ruby', 'Chou'],
    Kagura: ['Saber', 'Lancelot', 'Natalia', 'Helcurt'],
    Guinevere: ['Saber', 'Kaja', 'Minsitthar', 'Chou'],
    Benedetta: ['Kaja', 'Chou', 'Minsitthar', 'Khufra'],
    Wanwan: ['Minsitthar', 'Natalia', 'Kaja', 'Saber'],
    Miya: ['Saber', 'Natalia', 'Helcurt', 'Lancelot'],
    Layla: ['Saber', 'Natalia', 'Helcurt', 'Fanny'],
    Lesley: ['Saber', 'Natalia', 'Helcurt', 'Hayabusa'],
    Beatrix: ['Natalia', 'Saber', 'Lancelot', 'Helcurt'],
    Claude: ['Saber', 'Chou', 'Kaja', 'Franco'],
    Hirara: ['Saber', 'Natalia', 'Lancelot', 'Helcurt'],
    Estes: ['Baxia', 'Esmeralda', 'Dyrroth'],
    Esmeralda: ['Baxia', 'Karrie', 'Dyrroth', 'Phoveus'],
    Belerick: ['Karrie', 'Esmeralda', 'Thamuz'],
    Uranus: ['Baxia', 'Karrie', 'Dyrroth'],
    Tigreal: ['Diggie', 'Valir', 'Chou'],
    Atlas: ['Diggie', 'Valir', 'Chou'],
    Khufra: ['Diggie', 'Valir', 'Karrie'],
    Gloo: ['Karrie', 'Valir', 'Diggie'],
    Saber: ['Akai', 'Chou', 'Ruby', 'Franco'],
    Natalia: ['Kaja', 'Saber', 'Chou'],
    Valir: ['Phoveus', 'Lancelot', 'Saber'],
    Xavier: ['Hayabusa', 'Lancelot', 'Saber'],
    Pharsa: ['Natalia', 'Helcurt', 'Saber'],
    Yve: ['Lancelot', 'Saber', 'Natalia'],
    Kalea: ['Baxia', 'Kaja', 'Chou'],
    Kaja: ['Diggie', 'Chou', 'Valir'],
    Paquito: ['Masha', 'Thamuz', 'Silvanna'],
    'Yu Zhong': ['Baxia', 'Silvanna', 'Masha'],
    Aulus: ['Kaja', 'Chou', 'Masha'],
    Joy: ['Kaja', 'Chou', 'Khufra', 'Minsitthar'],
    Nolan: ['Kaja', 'Chou', 'Saber'],
    Novaria: ['Natalia', 'Saber', 'Helcurt'],
  };

  // Hero yang selalu kena ban (meta) — untuk Ban Suggestion.
  const META_BANS = ['Gloo', 'Masha', 'Aulus', 'Joy', 'Kalea', 'Fredrinn', 'Hirara', 'Zetian', 'Suyou', 'Lukas', 'Ling', 'Fanny'];

  const byName = Object.fromEntries(HEROES.map((h) => [h.name.toLowerCase(), h]));
  function find(name) {
    if (!name) return null;
    const n = String(name).toLowerCase().trim();
    if (byName[n]) return byName[n];
    return HEROES.find((h) => h.slug === n || h.name.toLowerCase().replace(/[^a-z]/g, '') === n.replace(/[^a-z]/g, '')) || null;
  }

  window.MLDATA = Object.assign(window.MLDATA || {}, { HEROES, COUNTERED_BY, META_BANS, findHero: find });
})();
