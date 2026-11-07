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

Perlu **Node.js 18+** sahaja (tiada `npm install`).

```bash
node server.js
```

Windows: double-click **`START.bat`**.

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
/mode?m=mc         (ml | mc)
/mc?t=win          (win | lose | streak | losestreak | levelup | place&place=1)
```

### Magic Chess
Tukar mode ke **Magic Chess** di atas. Tekan **Round menang / kalah** — round, streak dan HP dikira automatik; banner Win Streak keluar pada streak 3+. Tambah synergy (nama, ada, perlu, warna) — bila cukup, banner "SYNERGY AKTIF" keluar. Tekan **#1–#8** di akhir game (Top 1 = CHAMPION + confetti).

## 4. Personalise

- **Gambar hero**: `public/assets/heroes/<slug>.png` (cth `yi-sun-shin.png`, `chou.png`). Tanpa gambar, inisial hero dipaparkan.
- **Ikon item**: `public/assets/items/<id>.png` (id dalam `public/data/items.js`, cth `holy-crystal.png`).
- **Bunyi sendiri**: `public/assets/sfx/item.mp3`, `kill.mp3`, `win.mp3`, `lose.mp3`, `spell.mp3`, `ready.mp3`. Tanpa fail, bunyi sintetik digunakan.
- **Maskot**: letak `public/assets/mascot.png`, kemudian tulis `assets/mascot.png` dalam kotak Maskot.
- **Warna / font**: `public/css/overlay.css` (bahagian `:root`).
- **Stat item / hero baru**: `public/data/items.js`, `public/data/heroes.js`.

## 5. Auto Detector (pilihan, lanjutan)

Nak kill / victory / item dikesan sendiri tanpa tekan butang? `detector/auto_detect.py` tangkap skrin game (cth tetingkap scrcpy) dan guna template matching OpenCV.

```bash
pip install mss opencv-python numpy requests
python detector/auto_detect.py --calibrate
python detector/auto_detect.py
```

1. `--calibrate` simpan screenshot penuh → potong banner (SAVAGE, MANIAC, VICTORY…) dan ikon item, simpan dalam `detector/templates/kill/`, `result/`, `items/` (nama fail = jenis kill / `win` / `lose` / id item).
2. Edit `detector/config.json` → `region` (kawasan tetingkap game) dan `zones`.
3. Ketepatan bergantung pada kualiti templat — test dulu sebelum live.

## Struktur

```
server.js              server (HTTP + SSE), simpan state dalam state.json
public/overlay.html    Browser Source OBS
public/control.html    control panel
public/js/             overlay.js, control.js, draft.js, sfx.js
public/data/           heroes.js, items.js
public/css/            overlay.css, control.css
detector/              auto detector Python (pilihan)
```
