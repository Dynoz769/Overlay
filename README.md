# SISTEM LIVE — Overlay Stream Mobile Legends & Magic Chess

Overlay OBS untuk live MLBB dan Magic Chess. Ada 6 modul:

| Modul | Apa dia buat |
|---|---|
| **Item Detector** | Kad "★ ITEM SIAP" dengan nama item, stat, passive & penerangan BM. Ada juga "6 · ITEM PENUH!" |
| **Kill Detector** | Banner First Blood, Solo Kill, Double/Triple/Mega, Maniac, Savage, Killing Spree, Legendary, Lord, Turtle… |
| **Win / Lose** | Animasi VICTORY (confetti) / DEFEAT + rekod W–L yang dikira automatik |
| **Draft Pick · Counter Pick** | Win Prediction (%), Ally Power Spike + Game Plan, Ban Suggestion, kad Enemy Pick + counter |
| **Voice Spell · Timer Musuh** | Sebut *"Hirara flicker"* → timer spell musuh jalan atas skrin. Boleh guna Stream Deck juga |
| **Magic Chess** | Round, HP, gold, level, streak, synergy + banner Win Streak / Champion / Top 4 |

Bonus: badge **SISTEM LIVE** yang bertukar warna, promo bar berputar (Joki Rank, Mabar VIP, Komen Album) dengan maskot, teks bebas.

---

## 1. Pasang & jalankan

Perlu **Node.js 18+**. Kali pertama jalankan `npm install` (pasang OCR engine untuk auto detect) — `START.bat` buat sendiri.

```bash
node server.js
```

Windows: double-click **`START.bat`** (buka control panel + auto detect sekali).

- Control panel: <http://127.0.0.1:8799/control.html> → buka dalam **Google Chrome / Edge**
- Overlay: <http://127.0.0.1:8799/overlay.html>

## 2. Masukkan dalam OBS / TikTok Live Studio

Tambah **Browser Source**:

| Setting | Portrait (TikTok) | Landscape (YouTube/FB) |
|---|---|---|
| URL | `http://127.0.0.1:8799/overlay.html` | `http://127.0.0.1:8799/overlay.html?w=1920&h=1080` |
| Width × Height | 1080 × 1920 | 1920 × 1080 |

Tandakan **"Control audio via OBS"** kalau nak bunyi masuk stream.

Parameter URL tambahan:

- `?only=stage,spells` — tunjuk modul tertentu sahaja (`badge`, `record`, `stage`, `spells`, `promo`, `mc`). Boleh tambah beberapa Browser Source dan susun sendiri.
- `?sound=0` — matikan bunyi
- `?preview=1` — latar petak untuk test dalam browser

## 3. Guna semasa live

### Item / Kill / Win
Tekan butang dalam control panel. Hotkey (bila bukan sedang menaip): `K` solo kill · `V` victory · `D` defeat · `F` full build · `1`–`5` start spell musuh.

### Draft Pick
1. Masa draft, isi 5 hero ally & 5 hero enemy (autocomplete), hero kau, dan ban.
2. Preview % keluar terus dalam panel.
3. Tekan **Win Prediction / Power Spike / Ban Suggestion** atau **▶ Semua** untuk tunjuk ke viewer. Butang **▶** sebelah hero enemy tunjuk kad Enemy Pick + counter.
4. **→ Spell timer** salin 5 hero musuh terus ke timer spell.

> Win prediction ialah heuristik (counter + komposisi role + lane coverage), bukan data rasmi. Edit senarai counter / meta ban dalam `public/data/heroes.js`.

### 📊 Analisis Game ML (auto)
Masa game berjalan, Auto Detect baca HUD: **masa** (tengah atas), **skor kill** (kiri = team kau, kanan = musuh), **KDA** kau, **gold**, dan kira **Turtle / Lord** setiap team dari banner. Setiap **3 minit game** (3:00, 6:00, 9:00…) dan selepas **Lord / Savage / Wiped Out / Shut Down**, panel analisis keluar:
- **Peluang menang live** ally vs enemy — gabungan draft (counter), beza kill, objektif, fasa power spike dan KDA. Awal game draft lebih berat; makin lama, skor & objektif lebih penting.
- **Strategi**: `PUSH & LORD`, `GROUP & TEAMFIGHT`, `FARM & TUNGGU SPIKE`, `AMBIL TURTLE`, `SNOWBALL`, `MAIN SELAMAT`, `DEFEND`, `KAWAL OBJEKTIF` + tip (cth "Lord keluar minit 8:00", "Hati-hati Saber — counter Hirara", "KDA 8/2/6 — jangan mati untuk shut down").
- Rekod W-L atas overlay juga tunjuk peluang menang & strategi semasa.

Nilai boleh dibetulkan / diisi manual dalam control panel (bahagian *Analisis Game*). Peluang ialah anggaran heuristik; masa Turtle/Lord dan pemberat boleh diubah dalam `public/js/mlanalysis.js`.

### Voice Spell
1. Isi hero musuh + spell mereka (Flicker 120s, Retribution 35s, Inspire 75s, dll.).
2. Klik **🎙️ Mula voice listener** (Chrome akan minta izin mic).
3. Sebut: **"Hirara flicker"**, **"Fanny retri"**, **"Miya inspire"**, atau **"reset spell"**.
   Kalau tak sebut nama spell, ia guna spell yang dah ditetapkan untuk hero tu.

Stream Deck → **Website / Open URL** (tandakan "GET request in background"):

```
http://127.0.0.1:8799/spell?i=1        musuh pertama
http://127.0.0.1:8799/spell?i=3&s=flicker
http://127.0.0.1:8799/spell?reset
```

URL lain untuk Stream Deck / AutoHotkey:

```
/kill?t=savage     (first_blood, solo, double, triple, mega, maniac, savage, spree, monster, godlike, legendary, shutdown, wipe, lord, turtle, death)
/item?id=holy-crystal
/fullbuild   /win   /lose
/draft?v=predict   (predict | spike | ban | cycle)
/mode?m=mc         (ml | mc = kunci mode · auto = Auto Detect tukar sendiri)
/mc?t=win          (win | lose | streak | losestreak | levelup | analysis | place&place=1)
/ml               papar analisis game ML
```

### Magic Chess

**📊 Analisis round (auto):** setiap kali round bertukar, panel analisis keluar atas overlay: **peluang Top 4 & Juara**, kedudukan HP kau dalam lobby (#3/8), level berbanding sasaran stage, gold + interest, streak, bar kekuatan, dan **strategi**: `ECON`, `LEVEL UP`, `ROLL`, `JAGA STREAK`, `LOSE STREAK ECON`, `STABILKAN`, `ALL-IN` — dengan 2-3 tip (cth "Simpan 6 gold lagi → interest +4", "Mage 3/4 — cari 1 hero lagi"). Panel MC juga sentiasa tunjuk TOP 4 % dan PLAN. Peluang ialah anggaran heuristik (ubah pemberat dalam `public/js/mcanalysis.js`).

Tukar mode ke **Magic Chess** di atas. Tekan **Round menang / kalah** — round, streak dan HP dikira automatik; banner Win Streak keluar pada streak 3+. Tambah synergy (nama, ada, perlu, warna) — bila cukup, banner "SYNERGY AKTIF" keluar. Tekan **#1–#8** di akhir game (Top 1 = CHAMPION + confetti).

## 4. Personalise

- **Gambar hero**: `public/assets/heroes/<slug>.png` (cth `yi-sun-shin.png`, `chou.png`). Tanpa gambar, inisial hero dipaparkan.
- **Ikon item**: `public/assets/items/<id>.png` (id dalam `public/data/items.js`, cth `holy-crystal.png`).
- **Bunyi sendiri**: `public/assets/sfx/item.mp3`, `kill.mp3`, `win.mp3`, `lose.mp3`, `spell.mp3`, `ready.mp3`. Tanpa fail, bunyi sintetik digunakan.
- **Maskot**: letak `public/assets/mascot.png`, kemudian tulis `assets/mascot.png` dalam kotak Maskot.
- **Warna / font**: `public/css/overlay.css` (bahagian `:root`).
- **Stat item / hero baru**: `public/data/items.js`, `public/data/heroes.js`.

## 5. 🤖 AUTO DETECT — semua jalan sendiri

Buka **<http://127.0.0.1:8799/auto.html>** dalam Chrome (START.bat buka sendiri) dan biarkan tab tu terbuka sepanjang live.
Kali pertama, `START.bat` akan `npm install` OCR engine (perlu internet sekali sahaja; lepas tu boleh offline).

### 📱 Main guna phone (iPhone / Android)
Cucuk kabel USB ke laptop **tak** hantar skrin phone ke laptop (cuma charge / fail). Sistem perlukan skrin game terpapar di laptop dulu:
1. **Capture card** (paling stabil): iPhone 15/16 USB-C → adapter *USB-C → HDMI* → *HDMI capture card USB* → laptop. OBS: **Video Capture Device**.
2. **AirPlay** (tanpa wayar, iPhone): aplikasi penerima AirPlay di Windows (LonelyScreen / AirServer / 5KPlayer) → iPhone *Screen Mirroring*. OBS: **Window Capture**.
3. **Android**: scrcpy → OBS **Window Capture**.

Lepas skrin game nampak dalam OBS → klik kanan source → **Windowed Projector (Source)** → pilih dalam Auto Detect.

### ⚡ Setup OBS automatik (`SETUP-OBS.bat`)
Lepas skrin phone / game dah ada dalam OBS:
1. OBS → **Tools → WebSocket Server Settings** → tanda **Enable WebSocket server** → OK (salin password dari *Show Connect Info*).
2. Pastikan `START.bat` dah jalan, kemudian double-click **`SETUP-OBS.bat`** → masukkan password bila diminta.

Dia akan: cari source phone kau, tambah **Browser Source overlay** atas scene semasa (saiz ikut kanvas portrait/landscape, penuh skrin, paling atas), dan buka **Windowed Projector** source phone. Lepas tu dalam Auto Detect: **Tangkap tetingkap / skrin** → tab *Window* → *Windowed Projector (Source) - …*.

**Sumber skrin** — paling baik:
1. Dalam OBS, klik kanan source game (Game Capture / scrcpy / emulator) → **Windowed Projector (Source)**.
2. Dalam auto.html tekan **🖥️ Tangkap tetingkap / skrin** → pilih tetingkap projector tu.

> Jangan tangkap output OBS yang dah ada overlay — nanti sistem baca overlay sendiri. OBS Virtual Camera boleh kalau *Output Type = Source* (source game sahaja).

**Apa yang auto:**

| Bila | Apa sistem buat |
|---|---|
| Fasa ban | Kesan tulisan "Ban" → keluar **Ban Suggestion** (ikut hero utama kau) |
| Draft pick | Baca nama hero kiri (ally) & kanan (enemy) → setiap enemy pick keluar **kad Enemy Pick + counter** |
| Loading screen | Baca 10 hero, kenal team kau guna **IGN** → **Win Prediction + Power Spike** keluar, **spell timer diisi** hero musuh, **📸 gambar hero ditangkap** dari skrin |
| In-game | Banner **Savage / Maniac / First Blood / Killing Spree…** → banner overlay (team kau sahaja — warna biru vs merah) |
| Item | Ikon baru dalam slot item → kad item (ikon diambil dari skrin), 6 item → ITEM PENUH |
| Tamat | **VICTORY / DEFEAT** → animasi + rekod W-L, game reset sendiri |
| Magic Chess Go Go | Kenal skrin MCGG (Refresh, Buy EXP, Commander…) → tukar mode sendiri. Tanpa set kawasan: baca **round** ("2-3"), **HP kau** (nombor sebaris IGN dalam senarai pemain), **gold** (nombor sebelah ikon syiling), **level** ("Lv.5"), **synergy** ("Mage 2/4"). Round menang/kalah dikira dari HP, streak, Level Up, Synergy Aktif, kedudukan akhir (1st…8th) + rekod W-L |

**Setup sekali sahaja (5 minit):**
1. Isi **IGN** dan **hero utama**.
2. **Kawasan**: pilih butang kawasan (Banner kill, Victory/Defeat, Slot item, MC…) dan drag atas preview untuk tandakan di mana benda tu muncul dalam game. Tekan **🔍 Test OCR** untuk tengok apa sistem baca.
3. **Banner & VICTORY**: sistem belajar sendiri bila OCR dapat baca tulisan banner (ia simpan gambar banner sebagai *template*; lepas tu dikenal tepat setiap kali). Kalau ada yang terlepas: sejurus lepas banner keluar, klik gambar dia dalam strip **"Ajar banner"** (6 saat terakhir) → pilih jenis → Simpan. Sekali setiap jenis.
4. **Item**: tandakan kawasan slot item & bilangan slot, hidupkan "Item". Ikon yang belum dikenal muncul dalam **"Ikon item baru"** — pilih nama sekali, lepas tu auto selamanya.

**Had yang perlu tahu (jujur):**
- OCR baca nama hero dengan baik, tapi tulisan besar bergaya (SAVAGE, VICTORY) susah untuk OCR — sebab tu template matching jadi cara utama. Dalam test, VICTORY dikesan dengan skor 0.86–0.92 dan tiada trigger palsu.
- Spell musuh *tak boleh* dilihat dari skrin — timer mula guna suara / Stream Deck / hotkey (macam dalam video). Spell default diisi ikut lane (jungle = Retribution, lain = Flicker); sebut "Hirara inspire" untuk tukar.
- Kawasan default ialah anggaran — set ikut skrin kau dulu.
- **MCGG** diuji dengan skrin MCGG *tiruan* sahaja (semua bacaan lulus), belum dengan rakaman MCGG sebenar. Pastikan **IGN** diisi (untuk HP). Kalau ada nilai yang tak dibaca, lukis kawasan MC round / gold / HP / kedudukan — kawasan yang kau lukis diutamakan. Status bacaan MC nampak terus di bar status halaman Auto Detect.
- Rakam satu game dan test guna **"Test guna video rakaman"** sebelum live.

## Struktur

```
server.js              server (HTTP + SSE), simpan state dalam state.json
public/overlay.html    Browser Source OBS
public/control.html    control panel
public/js/             overlay.js, control.js, draft.js, sfx.js
public/data/           heroes.js, items.js
public/css/            overlay.css, control.css
public/auto.html       enjin AUTO DETECT (OCR + template)
```
