"""
Exporte le dashboard en site statique (dossier docs/) pour GitHub Pages.

Génère :
  - docs/index.html, app.js, style.css  (copie de public/, en mode statique)
  - docs/data/…                          (toutes les réponses d'API figées en JSON)
  - docs/manifest.webmanifest, sw.js, icônes  (installable comme webapp)

Aucune dépendance externe. Lancé automatiquement après chaque synchro par le
serveur, ou à la main : python3 export.py
"""

import json
import os
import shutil
import sqlite3
import struct
import zlib

import netatmo
import stats

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(BASE_DIR, "public")
DOCS = os.path.join(BASE_DIR, "docs")
DB_PATH = os.path.join(BASE_DIR, "data.db")

SERIES_DAYS = [7, 30, 90, 365]


def sid(station):
    return station.replace(":", "-")


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def daily_rows(station):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT day,tavg,tmin,tmax,rain,wind_avg,gust_max,wind_angle "
        "FROM daily WHERE station=? ORDER BY day", (station,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Icône PWA (PNG généré en pur Python : dégradé ciel + soleil)
# ---------------------------------------------------------------------------
def _png(width, height, pixel):
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filtre 0
        for x in range(width):
            r, g, b, a = pixel(x, y, width, height)
            raw += bytes((r, g, b, a))

    def chunk(typ, data):
        c = typ + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def _icon_pixel(x, y, w, h):
    # Dégradé vertical bleu nuit -> presque noir
    t = y / h
    top = (27, 58, 92)       # #1b3a5c
    bot = (13, 13, 13)       # #0d0d0d
    r = int(top[0] + (bot[0] - top[0]) * t)
    g = int(top[1] + (bot[1] - top[1]) * t)
    b = int(top[2] + (bot[2] - top[2]) * t)
    # Soleil orange en haut à droite
    cx, cy, rad = w * 0.66, h * 0.34, w * 0.20
    d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
    if d < rad:
        return (235, 104, 52, 255)          # #eb6834 plein
    if d < rad * 1.15:                        # halo
        k = 1 - (d - rad) / (rad * 0.15)
        return (int(r + (235 - r) * k), int(g + (104 - g) * k), int(b + (52 - b) * k), 255)
    return (r, g, b, 255)


def write_icons():
    for size, name in ((512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")):
        png = _png(size, size, _icon_pixel)
        with open(os.path.join(DOCS, name), "wb") as f:
            f.write(png)


MANIFEST = {
    "name": "Climat Maison",
    "short_name": "Climat",
    "description": "Suivi du climat de mes stations Netatmo",
    "start_url": ".",
    "scope": ".",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#0d0d0d",
    "theme_color": "#0d0d0d",
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
    ],
}

SW_JS = """// Service worker : réseau d'abord (données fraîches), cache en secours (hors-ligne)
const CACHE = 'climat-v1';
const SHELL = ['./', './index.html', './app.js', './style.css', './manifest.webmanifest'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) =>
    Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
"""

# À injecter dans le <head> de la version statique
HEAD_INJECT = """  <script>window.NETATMO_STATIC = true;</script>
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#0d0d0d">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Climat">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">
  <script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}</script>
"""


def build_frontend():
    os.makedirs(DOCS, exist_ok=True)
    shutil.copy(os.path.join(PUBLIC, "app.js"), os.path.join(DOCS, "app.js"))
    shutil.copy(os.path.join(PUBLIC, "style.css"), os.path.join(DOCS, "style.css"))
    with open(os.path.join(PUBLIC, "index.html"), encoding="utf-8") as f:
        html = f.read()
    if "NETATMO_STATIC" not in html:
        html = html.replace("</head>", HEAD_INJECT + "</head>", 1)
    with open(os.path.join(DOCS, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    write_json(os.path.join(DOCS, "manifest.webmanifest"), MANIFEST)
    with open(os.path.join(DOCS, "sw.js"), "w", encoding="utf-8") as f:
        f.write(SW_JS)
    write_icons()


def build_data():
    stations = netatmo.list_stations()
    write_json(os.path.join(DOCS, "data", "stations.json"), stations)
    write_json(os.path.join(DOCS, "data", "db-status.json"), stats.db_status())

    for st in stations:
        i = st["id"]
        s = sid(i)
        write_json(os.path.join(DOCS, "data", "dashboard", f"{s}.json"),
                   netatmo.build_dashboard(i))
        for d in SERIES_DAYS:
            write_json(os.path.join(DOCS, "data", "series", f"{s}_{d}.json"),
                       netatmo.build_series(d, i))
        write_json(os.path.join(DOCS, "data", "stats", f"temperature_{s}.json"),
                   stats.temperature_stats(i))
        write_json(os.path.join(DOCS, "data", "stats", f"rain_{s}.json"),
                   stats.rain_stats(i))
        write_json(os.path.join(DOCS, "data", "stats", f"wind_{s}.json"),
                   stats.wind_stats(i))
        write_json(os.path.join(DOCS, "data", "stats", f"climate_{s}.json"),
                   stats.climate_stats(i))
        write_json(os.path.join(DOCS, "data", "daily", f"{s}.json"), daily_rows(i))


def export_all():
    build_frontend()
    build_data()
    print("✅ Export statique prêt dans docs/")


if __name__ == "__main__":
    export_all()
