"""
Client Netatmo minimal — bibliothèque standard Python uniquement.

Gère :
  - le chargement de la config (.env)
  - le rafraîchissement OAuth du token (Netatmo fait tourner le refresh_token
    à chaque appel, on le persiste dans .tokens.json)
  - les appels API (getstationsdata, getmeasure)
  - la construction d'un payload "dashboard" prêt à afficher
"""

import json
import os
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")
TOKENS_PATH = os.path.join(BASE_DIR, ".tokens.json")

TOKEN_URL = "https://api.netatmo.com/oauth2/token"
API_BASE = "https://api.netatmo.com/api/"

# Types de modules Netatmo
TYPE_MAIN = "NAMain"      # station de base (intérieur)
TYPE_OUTDOOR = "NAModule1"  # module extérieur (temp/humidité)
TYPE_WIND = "NAModule2"     # anémomètre
TYPE_RAIN = "NAModule3"     # pluviomètre


class NetatmoError(Exception):
    pass


# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
def load_env():
    """Charge les variables du fichier .env (format KEY=VALUE)."""
    cfg = {}
    if not os.path.exists(ENV_PATH):
        raise NetatmoError(
            "Fichier .env introuvable. Copie .env.example en .env et remplis "
            "CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN."
        )
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            cfg[key.strip()] = val.strip().strip('"').strip("'")
    for req in ("CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"):
        if not cfg.get(req):
            raise NetatmoError(f"Variable manquante dans .env : {req}")
    return cfg


# --------------------------------------------------------------------------
# Tokens
# --------------------------------------------------------------------------
def _read_tokens():
    if os.path.exists(TOKENS_PATH):
        try:
            with open(TOKENS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _write_tokens(data):
    tmp = TOKENS_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, TOKENS_PATH)


def _http_post_form(url, fields):
    body = urllib.parse.urlencode(fields).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise NetatmoError(f"OAuth Netatmo a répondu {e.code}: {detail}")
    except urllib.error.URLError as e:
        raise NetatmoError(f"Connexion à Netatmo impossible: {e.reason}")


def get_access_token():
    """Retourne un access_token valide, en rafraîchissant si nécessaire."""
    cfg = load_env()
    tokens = _read_tokens()

    now = time.time()
    if tokens.get("access_token") and tokens.get("expires_at", 0) > now + 60:
        return tokens["access_token"]

    # Refresh token : celui persisté (rotation) sinon la graine du .env
    refresh_token = tokens.get("refresh_token") or cfg["REFRESH_TOKEN"]

    data = _http_post_form(
        TOKEN_URL,
        {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": cfg["CLIENT_ID"],
            "client_secret": cfg["CLIENT_SECRET"],
        },
    )
    if "access_token" not in data:
        raise NetatmoError(f"Réponse OAuth inattendue : {data}")

    new_tokens = {
        "access_token": data["access_token"],
        # Netatmo renvoie un nouveau refresh_token à chaque fois : on le garde
        "refresh_token": data.get("refresh_token", refresh_token),
        "expires_at": now + int(data.get("expires_in", 10800)),
    }
    _write_tokens(new_tokens)
    return new_tokens["access_token"]


# --------------------------------------------------------------------------
# Appels API
# --------------------------------------------------------------------------
def api_get(endpoint, params=None):
    token = get_access_token()
    url = API_BASE + endpoint
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise NetatmoError(f"API Netatmo {endpoint} a répondu {e.code}: {detail}")
    except urllib.error.URLError as e:
        raise NetatmoError(f"Connexion à Netatmo impossible: {e.reason}")


def get_stations_data():
    data = api_get("getstationsdata", {"get_favorites": "false"})
    devices = data.get("body", {}).get("devices", [])
    if not devices:
        raise NetatmoError("Aucune station trouvée sur ce compte Netatmo.")
    return devices


def get_measure(device_id, module_id, scale, types, date_begin, date_end=None):
    """Retourne une liste de (timestamp, [valeurs...]) pour les types demandés."""
    params = {
        "device_id": device_id,
        "scale": scale,
        "type": ",".join(types),
        "date_begin": int(date_begin),
        "optimize": "false",
        "real_time": "true",
    }
    if module_id:
        params["module_id"] = module_id
    if date_end:
        params["date_end"] = int(date_end)
    data = api_get("getmeasure", params)
    body = data.get("body", [])
    out = []
    if isinstance(body, dict):
        # Format optimize=false : { "timestamp": [valeurs...] }
        for ts_str, values in body.items():
            try:
                out.append((int(ts_str), values))
            except (ValueError, TypeError):
                continue
        out.sort(key=lambda r: r[0])
    elif isinstance(body, list):
        # Format optimize=true : liste de blocs {beg_time, step_time, value: [[...]]}
        for block in body:
            if not isinstance(block, dict):
                continue
            begin = block.get("beg_time", 0)
            step = block.get("step_time", 0) or 0
            for i, values in enumerate(block.get("value", [])):
                out.append((begin + i * step, values))
    return out


# --------------------------------------------------------------------------
# Construction du dashboard
# --------------------------------------------------------------------------
def _find_module(device, mtype):
    for m in device.get("modules", []):
        if m.get("type") == mtype:
            return m
    return None


def _device_label(device):
    """Nom lisible d'une station (maison)."""
    return (
        device.get("station_name")
        or device.get("home_name")
        or device.get("module_name")
        or device.get("_id")
    )


# Station affichée par défaut (Collet D'Ancelle)
DEFAULT_STATION = "70:ee:50:7a:d9:ae"


def _pick_device(devices, device_id=None):
    """Retourne la station demandée (par _id), sinon celle par défaut."""
    for want in (device_id, DEFAULT_STATION):
        if want:
            for d in devices:
                if d.get("_id") == want:
                    return d
    return devices[0]


def list_stations():
    """Liste des stations (maisons) du compte, station par défaut en premier."""
    devices = get_stations_data()
    out = [{"id": d["_id"], "name": _device_label(d)} for d in devices]
    out.sort(key=lambda s: 0 if s["id"] == DEFAULT_STATION else 1)
    return out


def _start_of_month_ts():
    now = datetime.now(timezone.utc).astimezone()
    som = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return int(som.timestamp())


def _minmax_from_measure(rows):
    """rows = liste (ts, [min_temp, max_temp]). Retourne (min, max, date_min, date_max)."""
    lo, hi, lo_ts, hi_ts = None, None, None, None
    for ts, vals in rows:
        if not vals or len(vals) < 2:
            continue
        mn, mx = vals[0], vals[1]
        if mn is not None and (lo is None or mn < lo):
            lo, lo_ts = mn, ts
        if mx is not None and (hi is None or mx > hi):
            hi, hi_ts = mx, ts
    return lo, hi, lo_ts, hi_ts


def build_dashboard(device_id=None):
    devices = get_stations_data()
    device = _pick_device(devices, device_id)
    device_id = device["_id"]
    dd = device.get("dashboard_data", {})

    outdoor = _find_module(device, TYPE_OUTDOOR)
    wind = _find_module(device, TYPE_WIND)
    rain = _find_module(device, TYPE_RAIN)

    out_dd = outdoor.get("dashboard_data", {}) if outdoor else {}
    wind_dd = wind.get("dashboard_data", {}) if wind else {}
    rain_dd = rain.get("dashboard_data", {}) if rain else {}

    payload = {
        "device_id": device_id,
        "station_name": _device_label(device),
        "updated_at": dd.get("time_utc"),
        "current": {
            "indoor": {
                "temp": dd.get("Temperature"),
                "humidity": dd.get("Humidity"),
                "co2": dd.get("CO2"),
                "pressure": dd.get("Pressure"),
                "noise": dd.get("Noise"),
                "trend": dd.get("temp_trend"),
            },
            "outdoor": {
                "temp": out_dd.get("Temperature"),
                "humidity": out_dd.get("Humidity"),
                "trend": out_dd.get("temp_trend"),
                "min_today": out_dd.get("min_temp"),
                "max_today": out_dd.get("max_temp"),
                "min_today_ts": out_dd.get("date_min_temp"),
                "max_today_ts": out_dd.get("date_max_temp"),
            },
            "wind": {
                "strength": wind_dd.get("WindStrength"),
                "angle": wind_dd.get("WindAngle"),
                "gust": wind_dd.get("GustStrength"),
                "gust_angle": wind_dd.get("GustAngle"),
                "max_today": wind_dd.get("max_wind_str"),
                "max_today_ts": wind_dd.get("date_max_wind_str"),
            } if wind else None,
            "rain": {
                "live": rain_dd.get("Rain"),
                "hour": rain_dd.get("sum_rain_1"),
                "day": rain_dd.get("sum_rain_24"),
            } if rain else None,
        },
        "history": {"month": {}, "year": {}},
    }

    # Historique températures (module extérieur)
    if outdoor:
        out_id = outdoor["_id"]
        now = time.time()
        # Mois en cours (jour par jour)
        try:
            month_rows = get_measure(
                device_id, out_id, "1day", ["min_temp", "max_temp"],
                _start_of_month_ts(),
            )
            lo, hi, lo_ts, hi_ts = _minmax_from_measure(month_rows)
            payload["history"]["month"] = {
                "min_temp": lo, "max_temp": hi,
                "min_ts": lo_ts, "max_ts": hi_ts,
            }
        except NetatmoError:
            pass
        # Année glissante (365 jours)
        try:
            year_rows = get_measure(
                device_id, out_id, "1day", ["min_temp", "max_temp"],
                now - 365 * 86400,
            )
            lo, hi, lo_ts, hi_ts = _minmax_from_measure(year_rows)
            payload["history"]["year"] = {
                "min_temp": lo, "max_temp": hi,
                "min_ts": lo_ts, "max_ts": hi_ts,
            }
        except NetatmoError:
            pass

    return payload


def build_series(days=30, device_id=None):
    """Série journalière min/max temp (+ pluie) pour le graphe."""
    devices = get_stations_data()
    device = _pick_device(devices, device_id)
    device_id = device["_id"]
    outdoor = _find_module(device, TYPE_OUTDOOR)
    rain = _find_module(device, TYPE_RAIN)
    now = time.time()
    begin = now - days * 86400

    result = {"days": [], "min_temp": [], "max_temp": [], "rain": []}

    if outdoor:
        rows = get_measure(
            device_id, outdoor["_id"], "1day", ["min_temp", "max_temp"], begin
        )
        for ts, vals in rows:
            day = datetime.fromtimestamp(ts).astimezone().strftime("%Y-%m-%d")
            result["days"].append(day)
            result["min_temp"].append(vals[0] if vals and len(vals) > 0 else None)
            result["max_temp"].append(vals[1] if vals and len(vals) > 1 else None)

    if rain:
        rain_rows = get_measure(
            device_id, rain["_id"], "1day", ["sum_rain"], begin
        )
        rain_by_day = {}
        for ts, vals in rain_rows:
            day = datetime.fromtimestamp(ts).astimezone().strftime("%Y-%m-%d")
            rain_by_day[day] = vals[0] if vals else None
        # aligne sur les jours de température si présents, sinon crée la liste
        if result["days"]:
            result["rain"] = [rain_by_day.get(d) for d in result["days"]]
        else:
            for day in sorted(rain_by_day):
                result["days"].append(day)
                result["rain"].append(rain_by_day[day])

    return result
