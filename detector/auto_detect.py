"""
Auto Detector (PILIHAN) — kesan Kill / Victory / Defeat / Item terus dari skrin game
dan hantar event ke overlay secara automatik.

Cara ia berfungsi: tangkap skrin (contoh tetingkap scrcpy / mirror phone / OBS projector)
beberapa kali sesaat, kemudian cari gambar templat (screenshot kecil yang KAU potong sendiri
dari game) guna OpenCV template matching. Bila jumpa → POST ke server overlay.

Pasang:
    pip install mss opencv-python numpy requests

Jalankan:
    python detector/auto_detect.py                # guna detector/config.json
    python detector/auto_detect.py --calibrate    # simpan screenshot penuh untuk potong templat

Templat:
    detector/templates/kill/<jenis>.png     cth: savage.png, maniac.png, double.png, first_blood.png, solo.png
    detector/templates/result/win.png       (tulisan VICTORY dalam game)
    detector/templates/result/lose.png      (tulisan DEFEAT)
    detector/templates/items/<item-id>.png  ikon item (nama fail = id dalam public/data/items.js)

Tip: potong templat dari screenshot pada RESOLUSI YANG SAMA dengan yang kau tangkap.
"""
import argparse
import json
import os
import sys
import time

try:
    import cv2
    import mss
    import numpy as np
    import requests
except ImportError:
    sys.exit("Pasang dulu: pip install mss opencv-python numpy requests")

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CONFIG = {
    "server": "http://127.0.0.1:8799",
    "monitor": 1,
    # kawasan skrin (piksel) — null = seluruh monitor. Set ke kawasan tetingkap game.
    "region": None,
    "fps": 4,
    "threshold": 0.82,
    "cooldown_sec": {"kill": 4, "result": 30, "item": 3},
    # kawasan relatif (0-1) dalam region untuk setiap jenis — kecilkan supaya laju & tepat
    "zones": {
        "kill": [0.25, 0.10, 0.75, 0.45],
        "result": [0.20, 0.15, 0.80, 0.60],
        "items": [0.00, 0.20, 0.20, 0.80],
    },
    "scales": [1.0, 0.9, 1.1],
}


def load_config():
    path = os.path.join(HERE, "config.json")
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            user = json.load(f)
        for k, v in user.items():
            if isinstance(v, dict) and isinstance(cfg.get(k), dict):
                cfg[k].update(v)
            else:
                cfg[k] = v
    else:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
        print(f"config.json dicipta: {path} — edit 'region' ikut tetingkap game kau.")
    return cfg


def load_templates(sub):
    folder = os.path.join(HERE, "templates", sub)
    out = {}
    if not os.path.isdir(folder):
        os.makedirs(folder, exist_ok=True)
        return out
    for name in os.listdir(folder):
        if name.lower().endswith((".png", ".jpg", ".jpeg")):
            img = cv2.imread(os.path.join(folder, name), cv2.IMREAD_GRAYSCALE)
            if img is not None:
                out[os.path.splitext(name)[0]] = img
    return out


def crop(frame, zone):
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = zone
    return frame[int(y1 * h):int(y2 * h), int(x1 * w):int(x2 * w)]


def best_match(area, templates, scales):
    best_name, best_score = None, 0.0
    for name, tpl in templates.items():
        for s in scales:
            t = tpl if s == 1.0 else cv2.resize(tpl, None, fx=s, fy=s)
            if t.shape[0] > area.shape[0] or t.shape[1] > area.shape[1]:
                continue
            score = cv2.minMaxLoc(cv2.matchTemplate(area, t, cv2.TM_CCOEFF_NORMED))[1]
            if score > best_score:
                best_name, best_score = name, score
    return best_name, best_score


def send(cfg, event):
    try:
        requests.post(cfg["server"] + "/api/event", json=event, timeout=2)
        print("→", event)
    except requests.RequestException as e:
        print("Gagal hantar ke server:", e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--calibrate", action="store_true", help="simpan screenshot untuk potong templat")
    args = ap.parse_args()
    cfg = load_config()

    with mss.mss() as sct:
        mon = cfg["region"] or sct.monitors[cfg["monitor"]]

        if args.calibrate:
            img = np.array(sct.grab(mon))
            path = os.path.join(HERE, "calibrate.png")
            cv2.imwrite(path, img)
            print("Disimpan:", path, "— potong bahagian banner/ikon dan simpan dalam templates/")
            return

        tpl = {k: load_templates(k) for k in ("kill", "result", "items")}
        print("Templat:", {k: list(v) for k, v in tpl.items()})
        if not any(tpl.values()):
            print("Tiada templat lagi. Jalankan --calibrate dan potong gambar ke detector/templates/.")

        last = {}
        seen_items = set()
        delay = 1.0 / max(1, cfg["fps"])
        th = cfg["threshold"]
        while True:
            t0 = time.time()
            frame = cv2.cvtColor(np.array(sct.grab(mon)), cv2.COLOR_BGRA2GRAY)

            for group, kind in (("kill", "kill"), ("result", "result")):
                if not tpl[group] or time.time() - last.get(group, 0) < cfg["cooldown_sec"][group]:
                    continue
                name, score = best_match(crop(frame, cfg["zones"][group]), tpl[group], cfg["scales"])
                if name and score >= th:
                    last[group] = time.time()
                    if kind == "kill":
                        send(cfg, {"kind": "kill", "type": name})
                    else:
                        send(cfg, {"kind": "win" if name.startswith("win") else "lose"})
                        seen_items.clear()  # game habis → reset item

            if tpl["items"] and time.time() - last.get("item", 0) >= cfg["cooldown_sec"]["item"]:
                area = crop(frame, cfg["zones"]["items"])
                for name, t in tpl["items"].items():
                    if name in seen_items or t.shape[0] > area.shape[0] or t.shape[1] > area.shape[1]:
                        continue
                    score = cv2.minMaxLoc(cv2.matchTemplate(area, t, cv2.TM_CCOEFF_NORMED))[1]
                    if score >= th:
                        seen_items.add(name)
                        last["item"] = time.time()
                        send(cfg, {"kind": "item", "id": name})
                        if len(seen_items) == 6:
                            send(cfg, {"kind": "fullbuild"})
                        break

            time.sleep(max(0, delay - (time.time() - t0)))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
