"""
Synchronisation de l'historique Netatmo vers une base SQLite locale.

- Journalier : température (moy/min/max), pluie, vent (moyenne, rafale max,
  direction dominante) — depuis le tout début des relevés.
- Horaire : température + vent (vitesse, direction, rafale) — pour les stats
  fines (gel du matin, température à 20h, corrélations vent/température).

Incrémental : chaque relance ne récupère que ce qui manque.
Respecte le rate-limit Netatmo (pause entre appels, retry sur 429).

Usage :
    python3 sync.py            # synchronise toutes les stations
    python3 sync.py --status   # affiche l'état de la base
"""

import os
import sqlite3
import sys
import time
from datetime import datetime

import netatmo

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data.db")

PAUSE = 0.35          # pause entre appels API (rate limit : 500/h, 50/10s)
BATCH_TARGET = 1024   # getmeasure renvoie max 1024 points

# Données à ignorer avant une certaine date (capteurs pas fiables avant) :
# station_id -> premier jour valide (YYYY-MM-DD)
CUTOFFS = {
    "70:ee:50:7a:d9:ae": "2023-06-15",   # Collet D'Ancelle
}

# Minimales journalières aberrantes (glitch capteur) : tmin mis à NULL
BAD_TMIN_DAYS = {
    ("70:ee:50:5e:fc:98", "2026-03-16"),  # Le Four de la Peste : -25.6 isolé
}


def cutoff_ts(station):
    """Timestamp du premier jour valide pour cette station (0 si pas de coupure)."""
    day = CUTOFFS.get(station)
    if not day:
        return 0
    return int(datetime.strptime(day, "%Y-%m-%d").timestamp())


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db(conn):
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS daily (
        station TEXT NOT NULL,
        day     TEXT NOT NULL,          -- YYYY-MM-DD (heure locale)
        ts      INTEGER,                -- timestamp du début de journée
        tavg REAL, tmin REAL, tmax REAL,
        rain REAL,
        wind_avg REAL, gust_max REAL, wind_angle REAL,
        PRIMARY KEY (station, day)
    );
    CREATE TABLE IF NOT EXISTS hourly (
        station TEXT NOT NULL,
        ts      INTEGER NOT NULL,
        temp REAL,
        wind REAL, angle REAL, gust REAL,
        PRIMARY KEY (station, ts)
    );
    CREATE TABLE IF NOT EXISTS sync_state (
        station TEXT NOT NULL,
        kind    TEXT NOT NULL,          -- daily_temp / daily_rain / daily_wind / hourly_temp / hourly_wind
        last_ts INTEGER,
        PRIMARY KEY (station, kind)
    );
    CREATE INDEX IF NOT EXISTS idx_hourly_station_ts ON hourly(station, ts);
    """)
    conn.commit()


def get_state(conn, station, kind):
    row = conn.execute(
        "SELECT last_ts FROM sync_state WHERE station=? AND kind=?", (station, kind)
    ).fetchone()
    return row[0] if row else 0


def set_state(conn, station, kind, ts):
    conn.execute(
        "INSERT INTO sync_state(station,kind,last_ts) VALUES(?,?,?) "
        "ON CONFLICT(station,kind) DO UPDATE SET last_ts=excluded.last_ts",
        (station, kind, ts),
    )
    conn.commit()


def _measure_all(device_id, module_id, scale, types, begin, label=""):
    """Itère getmeasure par lots jusqu'à aujourd'hui. Génère (ts, values)."""
    cursor = begin
    now = time.time()
    while cursor < now:
        for attempt in range(4):
            try:
                rows = netatmo.get_measure(device_id, module_id, scale, types, cursor)
                break
            except netatmo.NetatmoError as e:
                msg = str(e)
                if "429" in msg or "rate" in msg.lower():
                    wait = 60 * (attempt + 1)
                    print(f"    ⏸  rate limit, pause {wait}s…")
                    time.sleep(wait)
                elif attempt < 3:
                    time.sleep(5)
                else:
                    raise
        if not rows:
            return
        for ts, vals in rows:
            yield ts, vals
        last = rows[-1][0]
        if last <= cursor:  # sécurité anti-boucle
            return
        cursor = last + 1
        time.sleep(PAUSE)
        if len(rows) < 50:  # dernier lot (proche du présent)
            return


def day_str(ts):
    return datetime.fromtimestamp(ts).astimezone().strftime("%Y-%m-%d")


def sync_station(conn, device):
    station = device["_id"]
    name = netatmo._device_label(device)
    print(f"\n📡 {name}")

    out = netatmo._find_module(device, netatmo.TYPE_OUTDOOR)
    wind = netatmo._find_module(device, netatmo.TYPE_WIND)
    rain = netatmo._find_module(device, netatmo.TYPE_RAIN)

    # ---- Journalier : température ----
    if out:
        start = max(get_state(conn, station, "daily_temp"), cutoff_ts(station))
        n = 0
        for ts, v in _measure_all(station, out["_id"], "1day",
                                  ["temperature", "min_temp", "max_temp"], start):
            if not v or len(v) < 3:
                continue
            if (station, day_str(ts)) in BAD_TMIN_DAYS:
                v = [v[0], None, v[2]]
            conn.execute(
                "INSERT INTO daily(station,day,ts,tavg,tmin,tmax) VALUES(?,?,?,?,?,?) "
                "ON CONFLICT(station,day) DO UPDATE SET ts=excluded.ts, "
                "tavg=excluded.tavg, tmin=excluded.tmin, tmax=excluded.tmax",
                (station, day_str(ts), ts, v[0], v[1], v[2]),
            )
            n += 1
            if n % 500 == 0:
                conn.commit()
            set_last = ts
        if n:
            conn.commit()
            set_state(conn, station, "daily_temp", set_last - 86400)  # rejoue le dernier jour (partiel)
        print(f"   températures journalières : +{n}")

    # ---- Journalier : pluie ----
    if rain:
        start = max(get_state(conn, station, "daily_rain"), cutoff_ts(station))
        n = 0
        for ts, v in _measure_all(station, rain["_id"], "1day", ["sum_rain"], start):
            if not v:
                continue
            conn.execute(
                "INSERT INTO daily(station,day,ts,rain) VALUES(?,?,?,?) "
                "ON CONFLICT(station,day) DO UPDATE SET rain=excluded.rain, "
                "ts=COALESCE(daily.ts, excluded.ts)",
                (station, day_str(ts), ts, v[0]),
            )
            n += 1
            if n % 500 == 0:
                conn.commit()
            set_last = ts
        if n:
            conn.commit()
            set_state(conn, station, "daily_rain", set_last - 86400)
        print(f"   pluie journalière : +{n}")

    # ---- Journalier : vent ----
    if wind:
        start = max(get_state(conn, station, "daily_wind"), cutoff_ts(station))
        n = 0
        for ts, v in _measure_all(station, wind["_id"], "1day",
                                  ["WindStrength", "GustStrength", "WindAngle"], start):
            if not v or len(v) < 3:
                continue
            conn.execute(
                "INSERT INTO daily(station,day,ts,wind_avg,gust_max,wind_angle) VALUES(?,?,?,?,?,?) "
                "ON CONFLICT(station,day) DO UPDATE SET wind_avg=excluded.wind_avg, "
                "gust_max=excluded.gust_max, wind_angle=excluded.wind_angle, "
                "ts=COALESCE(daily.ts, excluded.ts)",
                (station, day_str(ts), ts, v[0], v[1], v[2]),
            )
            n += 1
            if n % 500 == 0:
                conn.commit()
            set_last = ts
        if n:
            conn.commit()
            set_state(conn, station, "daily_wind", set_last - 86400)
        print(f"   vent journalier : +{n}")

    # ---- Horaire : température ----
    if out:
        start = max(get_state(conn, station, "hourly_temp"), cutoff_ts(station))
        n = 0
        for ts, v in _measure_all(station, out["_id"], "1hour", ["temperature"], start):
            if not v:
                continue
            conn.execute(
                "INSERT INTO hourly(station,ts,temp) VALUES(?,?,?) "
                "ON CONFLICT(station,ts) DO UPDATE SET temp=excluded.temp",
                (station, ts, v[0]),
            )
            n += 1
            if n % 2000 == 0:
                conn.commit()
                print(f"   … temp horaire {n} points ({day_str(ts)})")
            set_last = ts
        if n:
            conn.commit()
            set_state(conn, station, "hourly_temp", set_last - 3600)
        print(f"   température horaire : +{n}")

    # ---- Horaire : vent ----
    if wind:
        start = max(get_state(conn, station, "hourly_wind"), cutoff_ts(station))
        n = 0
        for ts, v in _measure_all(station, wind["_id"], "1hour",
                                  ["WindStrength", "WindAngle", "GustStrength"], start):
            if not v or len(v) < 3:
                continue
            conn.execute(
                "INSERT INTO hourly(station,ts,wind,angle,gust) VALUES(?,?,?,?,?) "
                "ON CONFLICT(station,ts) DO UPDATE SET wind=excluded.wind, "
                "angle=excluded.angle, gust=excluded.gust",
                (station, ts, v[0], v[1], v[2]),
            )
            n += 1
            if n % 2000 == 0:
                conn.commit()
                print(f"   … vent horaire {n} points ({day_str(ts)})")
            set_last = ts
        if n:
            conn.commit()
            set_state(conn, station, "hourly_wind", set_last - 3600)
        print(f"   vent horaire : +{n}")


def sync_all():
    conn = db()
    init_db(conn)
    devices = netatmo.get_stations_data()
    for d in devices:
        try:
            sync_station(conn, d)
        except Exception as e:
            print(f"   ⚠️ erreur sur {netatmo._device_label(d)} : {e}")
    conn.close()
    print("\n✅ Synchronisation terminée.")


def status():
    if not os.path.exists(DB_PATH):
        print("Base absente — lance : python3 sync.py")
        return
    conn = db()
    print("État de la base :")
    for st, day_count in conn.execute(
        "SELECT station, COUNT(*) FROM daily GROUP BY station"
    ):
        first, last = conn.execute(
            "SELECT MIN(day), MAX(day) FROM daily WHERE station=?", (st,)
        ).fetchone()
        hr = conn.execute(
            "SELECT COUNT(*) FROM hourly WHERE station=?", (st,)
        ).fetchone()[0]
        print(f"  {st} : {day_count} jours ({first} → {last}), {hr} points horaires")
    conn.close()


if __name__ == "__main__":
    if "--status" in sys.argv:
        status()
    else:
        sync_all()
