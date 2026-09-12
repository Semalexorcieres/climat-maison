"""
Serveur du dashboard Netatmo — bibliothèque standard Python uniquement.

Lancement :
    python3 server.py
Puis ouvre http://localhost:8000

Sert :
  - les fichiers statiques de public/
  - /api/dashboard : conditions actuelles + min/max jour/mois/année
  - /api/series?days=30 : série journalière pour le graphe
"""

import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import netatmo
import stats
import sync

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
PORT = int(os.environ.get("PORT", "8000"))

# --- Synchro automatique de l'historique (base SQLite) ---
SYNC_INTERVAL = 6 * 3600          # toutes les 6 h
SYNC_MARKER = os.path.join(BASE_DIR, ".last_sync")
_sync_lock = threading.Lock()


def _last_sync_age():
    try:
        return time.time() - os.path.getmtime(SYNC_MARKER)
    except OSError:
        return float("inf")


def _run_sync(reason):
    if not _sync_lock.acquire(blocking=False):
        return  # une synchro tourne déjà
    try:
        print(f"⟳ Mise à jour des données ({reason})…")
        sync.sync_all()
        with open(SYNC_MARKER, "w") as f:
            f.write(str(int(time.time())))
        _CACHE.clear()  # les pages refléteront les nouvelles données
    except Exception as e:
        print(f"⚠️ Synchro échouée : {e}")
    finally:
        _sync_lock.release()


def _auto_sync_loop():
    # Au démarrage : ne synchronise que si la dernière date de plus d'une heure
    if _last_sync_age() > 3600:
        _run_sync("démarrage")
    while True:
        time.sleep(max(60, SYNC_INTERVAL - _last_sync_age()))
        if _last_sync_age() >= SYNC_INTERVAL:
            _run_sync("périodique")

# Cache simple en mémoire pour ménager l'API (rate limit Netatmo)
_CACHE = {}
_CACHE_TTL = 300  # 5 min


def _cached(key, builder):
    now = time.time()
    hit = _CACHE.get(key)
    if hit and now - hit["t"] < _CACHE_TTL:
        return hit["data"]
    data = builder()
    _CACHE[key] = {"t": now, "data": data}
    return data


CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # silence les logs bruyants
        pass

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path):
        ext = os.path.splitext(path)[1]
        ctype = CONTENT_TYPES.get(ext, "application/octet-stream")
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _station(self, device_id):
        """device_id explicite, sinon la première station du compte."""
        if device_id:
            return device_id
        stations = _cached("stations", netatmo.list_stations)
        return stations[0]["id"]

    def do_GET(self):
        parsed = urlparse(self.path)
        route = parsed.path

        if route.startswith("/api/"):
            return self._handle_api(route, parse_qs(parsed.query))

        # Fichiers statiques
        rel = route.lstrip("/")
        if rel == "":
            rel = "index.html"
        target = os.path.normpath(os.path.join(PUBLIC_DIR, rel))
        if not target.startswith(PUBLIC_DIR):
            return self._send_json({"error": "Chemin invalide"}, 403)
        if os.path.isfile(target):
            return self._send_file(target)
        return self._send_json({"error": "Introuvable"}, 404)

    def _handle_api(self, route, query):
        try:
            device_id = query.get("device_id", [None])[0]
            if route == "/api/stations":
                data = _cached("stations", netatmo.list_stations)
                return self._send_json(data)
            if route == "/api/dashboard":
                key = f"dashboard-{device_id or 'default'}"
                data = _cached(key, lambda: netatmo.build_dashboard(device_id))
                return self._send_json(data)
            if route == "/api/series":
                days = int(query.get("days", ["30"])[0])
                days = max(1, min(days, 365))
                key = f"series-{device_id or 'default'}-{days}"
                data = _cached(key, lambda: netatmo.build_series(days, device_id))
                return self._send_json(data)

            # ---- Statistiques locales (base SQLite, instantané) ----
            if route == "/api/stats/temperature":
                return self._send_json(stats.temperature_stats(self._station(device_id)))
            if route == "/api/stats/rain":
                return self._send_json(stats.rain_stats(self._station(device_id)))
            if route == "/api/stats/wind":
                return self._send_json(stats.wind_stats(self._station(device_id)))
            if route == "/api/stats/climate":
                return self._send_json(stats.climate_stats(self._station(device_id)))
            if route == "/api/search":
                q = query.get("q", [""])[0]
                return self._send_json(stats.search(self._station(device_id), q))
            if route == "/api/db-status":
                return self._send_json(stats.db_status())

            return self._send_json({"error": "Route API inconnue"}, 404)
        except RuntimeError as e:
            return self._send_json({"error": str(e)}, 503)
        except netatmo.NetatmoError as e:
            return self._send_json({"error": str(e)}, 502)
        except Exception as e:  # pragma: no cover
            return self._send_json({"error": f"Erreur serveur : {e}"}, 500)


def main():
    if not os.path.exists(os.path.join(BASE_DIR, ".env")):
        print("\n⚠️  Pas de fichier .env — copie .env.example en .env et remplis tes clés Netatmo.\n")
    threading.Thread(target=_auto_sync_loop, daemon=True).start()

    # Si le port demandé est occupé (ancien lancement resté ouvert…),
    # on essaie les suivants au lieu de planter.
    server = None
    for port in range(PORT, PORT + 10):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            print(f"⚠️  Port {port} occupé, essai du suivant…")
    if server is None:
        print(f"\n❌ Aucun port libre entre {PORT} et {PORT + 9}. "
              f"Redémarre le Mac ou libère un port, puis relance.\n")
        return
    print(f"\n🌤  Dashboard Netatmo lancé sur  http://localhost:{port}\n   (Ctrl+C pour arrêter)\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt.")
        server.shutdown()


if __name__ == "__main__":
    main()
