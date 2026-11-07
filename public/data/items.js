// Data item untuk Item Detector. Stat ikut patch semasa boleh berubah — edit di sini.
// Gambar item (pilihan): public/assets/items/<id>.png  (contoh: holy-crystal.png)
// Medan: id, name, cat (attack|magic|defense|movement|jungle|roam), stats, passive, desc (BM)
(function () {
  const ITEMS = [
    // ---------- MAGIC ----------
    { id: 'holy-crystal', name: 'Holy Crystal', cat: 'magic', stats: '+185 Magic Power', passive: 'Mystery', desc: 'Magic Power naik ikut level hero. Burst mage paling sakit.' },
    { id: 'blood-wings', name: 'Blood Wings', cat: 'magic', stats: '+190 Magic Power · +1000 HP', passive: 'Guard', desc: 'Dapat shield besar ikut Magic Power.' },
    { id: 'lightning-truncheon', name: 'Lightning Truncheon', cat: 'magic', stats: '+75 Magic Power · +400 Mana · +10% CD Reduction', passive: 'Resonate', desc: 'Skill keluarkan petir yang lompat ke 3 musuh.' },
    { id: 'genius-wand', name: 'Genius Wand', cat: 'magic', stats: '+75 Magic Power · +5% Move Speed', passive: 'Magic Penetration', desc: 'Kurangkan Magic Defense musuh, tambah Magic Pen.' },
    { id: 'ice-queen-wand', name: 'Ice Queen Wand', cat: 'magic', stats: '+75 Magic Power · +150 HP · +10% Spell Vamp', passive: 'Ice Bound', desc: 'Skill damage perlahankan musuh.' },
    { id: 'concentrated-energy', name: 'Concentrated Energy', cat: 'magic', stats: '+70 Magic Power · +700 HP · +10% Spell Vamp', passive: 'Bloodthirst', desc: 'Bunuh musuh = heal HP.' },
    { id: 'glowing-wand', name: 'Glowing Wand', cat: 'magic', stats: '+75 Magic Power · +400 HP · +5% Move Speed', passive: 'Scorch', desc: 'Bakar musuh & kurangkan heal mereka.' },
    { id: 'divine-glaive', name: 'Divine Glaive', cat: 'magic', stats: '+65 Magic Power', passive: 'Spellbreaker', desc: 'Magic Pen tinggi — tembus musuh yang tebal.' },
    { id: 'clock-of-destiny', name: 'Clock of Destiny', cat: 'magic', stats: '+60 Magic Power · +615 HP · +10% CD Reduction', passive: 'Time', desc: 'Magic Power & Mana naik dari masa ke masa.' },
    { id: 'starlium-scythe', name: 'Starlium Scythe', cat: 'magic', stats: '+70 Magic Power · +10% Spell Vamp', passive: 'Inspire', desc: 'Lepas skill, basic attack seterusnya damage tambahan.' },
    { id: 'enchanted-talisman', name: 'Enchanted Talisman', cat: 'magic', stats: '+50 Magic Power · +250 HP · +20% CD Reduction', passive: 'Mana Spring', desc: 'Pulih Mana dengan pantas.' },
    { id: 'fleeting-time', name: 'Fleeting Time', cat: 'magic', stats: '+70 Magic Power · +10% CD Reduction', passive: 'Timely Arrival', desc: 'Kill / assist kurangkan cooldown ultimate.' },
    { id: 'winter-crown', name: 'Winter Crown', cat: 'magic', stats: '+70 Magic Power · +25 Physical Defense', passive: 'Frozen', desc: 'Beku 2 saat — kebal semua damage.' },
    { id: 'feather-of-heaven', name: 'Feather of Heaven', cat: 'magic', stats: '+50 Magic Power · +40% Attack Speed', passive: 'Divine Blessing', desc: 'Basic attack keluar magic damage tambahan.' },
    { id: 'wishing-lantern', name: 'Wishing Lantern', cat: 'magic', stats: '+75 Magic Power · +10% CD Reduction', passive: 'Fortune', desc: 'Skill tambah damage ikut HP musuh.' },

    // ---------- ATTACK ----------
    { id: 'blade-of-despair', name: 'Blade of Despair', cat: 'attack', stats: '+160 Physical Attack · +5% Move Speed', passive: 'Despair', desc: 'Damage naik bila musuh HP bawah 50%.' },
    { id: 'berserkers-fury', name: "Berserker's Fury", cat: 'attack', stats: '+65 Physical Attack · +25% Crit Chance', passive: 'Doom', desc: 'Critical damage naik.' },
    { id: 'endless-battle', name: 'Endless Battle', cat: 'attack', stats: '+65 Physical Attack · +250 HP · +10% CD Reduction', passive: 'Divine Justice', desc: 'Lepas skill, basic attack tambah true damage.' },
    { id: 'hunter-strike', name: 'Hunter Strike', cat: 'attack', stats: '+80 Physical Attack · +10% CD Reduction', passive: 'Chase Fate', desc: 'Kejar musuh — tambah move speed.' },
    { id: 'blade-of-heptaseas', name: 'Blade of the Heptaseas', cat: 'attack', stats: '+70 Physical Attack · +250 HP', passive: 'Ambush', desc: 'Serangan pertama lepas keluar combat damage tinggi.' },
    { id: 'malefic-roar', name: 'Malefic Roar', cat: 'attack', stats: '+60 Physical Attack', passive: 'Armor Buster', desc: 'Tembus Physical Defense — counter tank.' },
    { id: 'haas-claws', name: "Haas's Claws", cat: 'attack', stats: '+30% Attack Speed · +20% Crit · +20% Lifesteal', passive: 'Bloodthirst', desc: 'Lifesteal naik bila HP rendah.' },
    { id: 'windtalker', name: 'Windtalker', cat: 'attack', stats: '+40% Attack Speed · +20 Move Speed · +10% Crit', passive: 'Typhoon', desc: 'Basic attack keluar magic damage ke 3 musuh.' },
    { id: 'scarlet-phantom', name: 'Scarlet Phantom', cat: 'attack', stats: '+30 Physical Attack · +25% Attack Speed · +25% Crit', passive: 'Swift', desc: 'Critical hit tambah attack speed.' },
    { id: 'demon-hunter-sword', name: 'Demon Hunter Sword', cat: 'attack', stats: '+35 Physical Attack · +25% Attack Speed', passive: 'Devour', desc: 'Basic attack makan HP musuh — counter tank.' },
    { id: 'corrosion-scythe', name: 'Corrosion Scythe', cat: 'attack', stats: '+30 Physical Attack · +35% Attack Speed', passive: 'Corrosion', desc: 'Perlahankan musuh & tambah attack speed.' },
    { id: 'golden-staff', name: 'Golden Staff', cat: 'attack', stats: '+55 Physical Attack · +15% Attack Speed', passive: 'Endless Strike', desc: 'Attack speed bertindan setiap pukulan.' },
    { id: 'great-dragon-spear', name: 'Great Dragon Spear', cat: 'attack', stats: '+70 Physical Attack · +20% Crit · +10% CD Reduction', passive: 'Supreme Warrior', desc: 'Lepas ultimate, move speed naik.' },
    { id: 'rose-gold-meteor', name: 'Rose Gold Meteor', cat: 'attack', stats: '+60 Physical Attack · +5% Lifesteal · +10 Magic Defense', passive: 'Lifeline', desc: 'Shield bila HP turun bawah 30%.' },
    { id: 'sea-halberd', name: 'Sea Halberd', cat: 'attack', stats: '+80 Physical Attack · +25% Attack Speed', passive: 'Life Drain', desc: 'Kurangkan heal musuh (anti-heal).' },
    { id: 'war-axe', name: 'War Axe', cat: 'attack', stats: '+30 Physical Attack · +550 HP · +10% CD Reduction', passive: 'Fighting Spirit', desc: 'Lama bertarung, attack & spell vamp naik.' },
    { id: 'bloodlust-axe', name: 'Bloodlust Axe', cat: 'attack', stats: '+70 Physical Attack · +10% CD Reduction · +20% Spell Vamp', passive: 'Bloodlust', desc: 'Skill damage = heal.' },
    { id: 'wind-of-nature', name: 'Wind of Nature', cat: 'attack', stats: '+30 Physical Attack · +20% Attack Speed · +10% Lifesteal', passive: 'Wind Chant', desc: 'Kebal physical damage 2 saat.' },
    { id: 'malefic-gun', name: 'Malefic Gun', cat: 'attack', stats: '+35% Attack Speed · +15% Crit', passive: 'Armor Buster', desc: 'Range tambah & tembus defense.' },

    // ---------- DEFENSE ----------
    { id: 'antique-cuirass', name: 'Antique Cuirass', cat: 'defense', stats: '+920 HP · +54 Physical Defense', passive: 'Deter', desc: 'Kena skill, attack musuh turun.' },
    { id: 'dominance-ice', name: 'Dominance Ice', cat: 'defense', stats: '+500 Mana · +70 Physical Defense · +5% Move Speed', passive: 'Arctic Cold', desc: 'Kurangkan heal & attack speed musuh dekat.' },
    { id: 'athenas-shield', name: "Athena's Shield", cat: 'defense', stats: '+900 HP · +48 Magic Defense', passive: 'Shield', desc: 'Shield anti magic burst.' },
    { id: 'radiant-armor', name: 'Radiant Armor', cat: 'defense', stats: '+950 HP · +52 Magic Defense', passive: 'Divine Protection', desc: 'Kena magic damage, magic defense bertindan.' },
    { id: 'oracle', name: 'Oracle', cat: 'defense', stats: '+850 HP · +42 Magic Defense · +10% CD Reduction', passive: 'Bless', desc: 'Shield & heal diterima naik.' },
    { id: 'immortality', name: 'Immortality', cat: 'defense', stats: '+800 HP · +22 Physical Defense', passive: 'Immortal', desc: 'Mati? Hidup semula 2.5 saat lepas tu!' },
    { id: 'guardian-helmet', name: 'Guardian Helmet', cat: 'defense', stats: '+1550 HP · +4% HP Regen', passive: 'Recovery', desc: 'Regen HP sangat laju luar combat.' },
    { id: 'brute-force-breastplate', name: 'Brute Force Breastplate', cat: 'defense', stats: '+770 HP · +45 Physical Defense · +10% CD Reduction', passive: 'Brute Force', desc: 'Skill tambah defense & move speed.' },
    { id: 'thunder-belt', name: 'Thunder Belt', cat: 'defense', stats: '+800 HP · +30 Physical Defense · +10% CD Reduction', passive: 'Thunderbolt', desc: 'Lepas skill, basic attack tambah true damage.' },
    { id: 'blade-armor', name: 'Blade Armor', cat: 'defense', stats: '+90 Physical Defense', passive: 'Thorns', desc: 'Pantul damage basic attack balik ke musuh.' },
    { id: 'cursed-helmet', name: 'Cursed Helmet', cat: 'defense', stats: '+1200 HP · +25 Magic Defense', passive: 'Burning Soul', desc: 'Bakar musuh sekeliling ikut HP.' },
    { id: 'queens-wings', name: "Queen's Wings", cat: 'defense', stats: '+30 Physical Attack · +750 HP · +10% CD Reduction', passive: 'Demonize', desc: 'HP rendah = damage reduction & spell vamp.' },
    { id: 'twilight-armor', name: 'Twilight Armor', cat: 'defense', stats: '+1200 HP · +20 Physical Defense', passive: 'Twilight', desc: 'Hadkan damage besar yang masuk.' },

    // ---------- MOVEMENT ----------
    { id: 'swift-boots', name: 'Swift Boots', cat: 'movement', stats: '+15% Attack Speed · +40 Move Speed', passive: '', desc: 'But untuk marksman.' },
    { id: 'warrior-boots', name: 'Warrior Boots', cat: 'movement', stats: '+22 Physical Defense · +40 Move Speed', passive: 'Valor', desc: 'Kena basic attack, defense naik.' },
    { id: 'tough-boots', name: 'Tough Boots', cat: 'movement', stats: '+22 Magic Defense · +40 Move Speed', passive: 'Fortitude', desc: 'Kurangkan masa kena CC.' },
    { id: 'magic-shoes', name: 'Magic Shoes', cat: 'movement', stats: '+10% CD Reduction · +40 Move Speed', passive: '', desc: 'Skill lebih cepat ready.' },
    { id: 'arcane-boots', name: 'Arcane Boots', cat: 'movement', stats: '+10 Magic Pen · +40 Move Speed', passive: '', desc: 'Magic pen tambahan.' },
    { id: 'rapid-boots', name: 'Rapid Boots', cat: 'movement', stats: '+40 Move Speed', passive: 'Rapid', desc: 'Luar combat lari sangat laju.' },
    { id: 'demon-shoes', name: 'Demon Shoes', cat: 'movement', stats: '+6% Mana Regen · +40 Move Speed', passive: 'Mana Return', desc: 'Kill / assist pulihkan mana.' },
  ];
  const byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
  function findItem(q) {
    if (!q) return null;
    const n = String(q).toLowerCase().trim();
    return byId[n] || ITEMS.find((i) => i.name.toLowerCase() === n || i.name.toLowerCase().replace(/[^a-z]/g, '') === n.replace(/[^a-z]/g, '')) || null;
  }
  window.MLDATA = Object.assign(window.MLDATA || {}, { ITEMS, findItem });
})();
