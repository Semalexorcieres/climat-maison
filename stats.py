"""
Moteur de statistiques climatiques — lit la base SQLite remplie par sync.py.

Toutes les fonctions prennent un `station` (device_id) et renvoient des
structures prêtes à afficher. Aucun appel réseau ici : tout est local.
"""

import os
import sqlite3
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data.db")

# Secteur "vent du nord" : direction d'origine entre NO (315°) et NE (45°)
NORTH_MIN, NORTH_MAX = 315, 45
# Seuil pour compter un "jour de vent" (moyenne journalière, km/h)
WINDY_DAY_KMH = 5


def db():
    if not os.path.exists(DB_PATH):
        raise RuntimeError("Base absente — lance d'abord : python3 sync.py")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _rows(conn, sql, args=()):
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def _is_north(angle):
    if angle is None:
        return False
    return angle >= NORTH_MIN or angle <= NORTH_MAX


# ==========================================================================
# TEMPÉRATURE
# ==========================================================================
def temperature_stats(station):
    conn = db()

    yearly = _rows(conn, """
        SELECT substr(day,1,4) AS year,
               ROUND(AVG(tavg),1) AS avg,
               ROUND(MIN(tmin),1) AS min,
               ROUND(MAX(tmax),1) AS max,
               MIN(day) FILTER (WHERE tmin=(SELECT MIN(tmin) FROM daily d2
                   WHERE d2.station=daily.station AND substr(d2.day,1,4)=substr(daily.day,1,4))) AS min_day,
               COUNT(*) AS days
        FROM daily WHERE station=? AND tavg IS NOT NULL
        GROUP BY year ORDER BY year
    """, (station,))

    # jour du min / max par année (requête propre)
    for y in yearly:
        r = conn.execute(
            "SELECT day, tmin FROM daily WHERE station=? AND substr(day,1,4)=? "
            "AND tmin IS NOT NULL ORDER BY tmin ASC LIMIT 1", (station, y["year"])
        ).fetchone()
        y["min_day"] = r["day"] if r else None
        r = conn.execute(
            "SELECT day, tmax FROM daily WHERE station=? AND substr(day,1,4)=? "
            "AND tmax IS NOT NULL ORDER BY tmax DESC LIMIT 1", (station, y["year"])
        ).fetchone()
        y["max_day"] = r["day"] if r else None

    # Moyennes mensuelles par année : {year: [12 valeurs]}
    monthly = _rows(conn, """
        SELECT substr(day,1,4) AS year, substr(day,6,2) AS month,
               ROUND(AVG(tavg),1) AS avg,
               ROUND(MIN(tmin),1) AS min,
               ROUND(MAX(tmax),1) AS max
        FROM daily WHERE station=? AND tavg IS NOT NULL
        GROUP BY year, month ORDER BY year, month
    """, (station,))

    # Climatologie mensuelle (toutes années confondues)
    climatology = _rows(conn, """
        SELECT substr(day,6,2) AS month,
               ROUND(AVG(tavg),1) AS avg,
               ROUND(AVG(tmin),1) AS avg_min,
               ROUND(AVG(tmax),1) AS avg_max,
               ROUND(MIN(tmin),1) AS record_min,
               ROUND(MAX(tmax),1) AS record_max
        FROM daily WHERE station=? AND tavg IS NOT NULL
        GROUP BY month ORDER BY month
    """, (station,))

    # Records absolus
    hottest = _rows(conn, """
        SELECT day, tmax AS value FROM daily
        WHERE station=? AND tmax IS NOT NULL ORDER BY tmax DESC LIMIT 10
    """, (station,))
    coldest = _rows(conn, """
        SELECT day, tmin AS value FROM daily
        WHERE station=? AND tmin IS NOT NULL ORDER BY tmin ASC LIMIT 10
    """, (station,))

    first_day = conn.execute(
        "SELECT MIN(day) FROM daily WHERE station=? AND tavg IS NOT NULL", (station,)
    ).fetchone()[0]

    conn.close()
    return {
        "since": first_day,
        "yearly": yearly,
        "monthly": monthly,
        "climatology": climatology,
        "hottest_days": hottest,
        "coldest_days": coldest,
    }


# ==========================================================================
# PLUIE
# ==========================================================================
def rain_stats(station):
    conn = db()

    yearly = _rows(conn, """
        SELECT substr(day,1,4) AS year,
               ROUND(SUM(rain),1) AS total,
               COUNT(*) FILTER (WHERE rain >= 1) AS rainy_days,
               ROUND(MAX(rain),1) AS max_day
        FROM daily WHERE station=? AND rain IS NOT NULL
        GROUP BY year ORDER BY year
    """, (station,))
    for y in yearly:
        r = conn.execute(
            "SELECT day FROM daily WHERE station=? AND substr(day,1,4)=? "
            "ORDER BY rain DESC LIMIT 1", (station, y["year"])
        ).fetchone()
        y["max_day_date"] = r["day"] if r else None

    monthly = _rows(conn, """
        SELECT substr(day,1,4) AS year, substr(day,6,2) AS month,
               ROUND(SUM(rain),1) AS total,
               COUNT(*) FILTER (WHERE rain >= 1) AS rainy_days
        FROM daily WHERE station=? AND rain IS NOT NULL
        GROUP BY year, month ORDER BY year, month
    """, (station,))

    climatology = _rows(conn, """
        SELECT month, ROUND(AVG(mtotal),1) AS avg_total
        FROM (
            SELECT substr(day,1,7) AS ym, substr(day,6,2) AS month, SUM(rain) AS mtotal
            FROM daily WHERE station=? AND rain IS NOT NULL GROUP BY ym
        ) GROUP BY month ORDER BY month
    """, (station,))

    last_rain = conn.execute(
        "SELECT day, rain FROM daily WHERE station=? AND rain >= 0.5 "
        "ORDER BY day DESC LIMIT 1", (station,)
    ).fetchone()

    wettest = _rows(conn, """
        SELECT day, rain AS value FROM daily
        WHERE station=? AND rain IS NOT NULL ORDER BY rain DESC LIMIT 10
    """, (station,))

    # Plus longue période sèche (jours consécutifs < 0.5 mm)
    dry = conn.execute("""
        SELECT day, rain FROM daily WHERE station=? AND rain IS NOT NULL ORDER BY day
    """, (station,)).fetchall()
    best_len, best_end, cur = 0, None, 0
    for r in dry:
        if (r["rain"] or 0) < 0.5:
            cur += 1
            if cur > best_len:
                best_len, best_end = cur, r["day"]
        else:
            cur = 0
    current_dry = 0
    for r in reversed(dry):
        if (r["rain"] or 0) < 0.5:
            current_dry += 1
        else:
            break

    conn.close()
    return {
        "yearly": yearly,
        "monthly": monthly,
        "climatology": climatology,
        "last_rain": dict(last_rain) if last_rain else None,
        "wettest_days": wettest,
        "longest_dry_spell": {"days": best_len, "end": best_end},
        "current_dry_days": current_dry,
    }


# ==========================================================================
# VENT
# ==========================================================================
def wind_stats(station):
    conn = db()

    yearly = _rows(conn, """
        SELECT substr(day,1,4) AS year,
               ROUND(AVG(wind_avg),1) AS avg,
               ROUND(MAX(gust_max),0) AS max_gust,
               COUNT(*) FILTER (WHERE wind_avg >= ?) AS windy_days
        FROM daily WHERE station=? AND wind_avg IS NOT NULL
        GROUP BY year ORDER BY year
    """, (WINDY_DAY_KMH, station))
    for y in yearly:
        r = conn.execute(
            "SELECT day FROM daily WHERE station=? AND substr(day,1,4)=? "
            "ORDER BY gust_max DESC LIMIT 1", (station, y["year"])
        ).fetchone()
        y["max_gust_day"] = r["day"] if r else None

    # Jours de vent du nord par année (direction dominante dans le secteur nord
    # + un minimum de vent pour que ça compte)
    north = _rows(conn, """
        SELECT substr(day,1,4) AS year,
               COUNT(*) FILTER (WHERE (wind_angle >= ? OR wind_angle <= ?)
                                AND wind_avg >= ?) AS north_days,
               COUNT(*) FILTER (WHERE wind_avg >= ?) AS windy_days
        FROM daily WHERE station=? AND wind_angle IS NOT NULL
        GROUP BY year ORDER BY year
    """, (NORTH_MIN, NORTH_MAX, WINDY_DAY_KMH, WINDY_DAY_KMH, station))

    north_monthly = _rows(conn, """
        SELECT substr(day,6,2) AS month,
               COUNT(*) FILTER (WHERE (wind_angle >= ? OR wind_angle <= ?)
                                AND wind_avg >= ?) AS north_days
        FROM daily WHERE station=? AND wind_angle IS NOT NULL
        GROUP BY month ORDER BY month
    """, (NORTH_MIN, NORTH_MAX, WINDY_DAY_KMH, station))

    # Rose des vents : répartition des jours venteux par secteur (8 secteurs)
    rose_rows = conn.execute("""
        SELECT wind_angle, wind_avg FROM daily
        WHERE station=? AND wind_angle IS NOT NULL AND wind_avg >= ?
    """, (station, WINDY_DAY_KMH)).fetchall()
    sectors = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]
    rose = {s: 0 for s in sectors}
    for r in rose_rows:
        idx = int(((r["wind_angle"] + 22.5) % 360) // 45)
        rose[sectors[idx]] += 1

    gustiest = _rows(conn, """
        SELECT day, gust_max AS value, wind_angle FROM daily
        WHERE station=? AND gust_max IS NOT NULL ORDER BY gust_max DESC LIMIT 10
    """, (station,))

    conn.close()
    return {
        "yearly": yearly,
        "north_yearly": north,
        "north_monthly": north_monthly,
        "rose": [{"sector": s, "days": rose[s]} for s in sectors],
        "gustiest_days": gustiest,
        "windy_threshold": WINDY_DAY_KMH,
    }


# ==========================================================================
# CLIMAT — seuils, variations, corrélations
# ==========================================================================
def climate_stats(station):
    conn = db()

    # Compteurs de jours à seuil, par année
    thresholds = _rows(conn, """
        SELECT substr(day,1,4) AS year,
               COUNT(*) FILTER (WHERE tmin < 0)  AS frost_days,       -- gel (min < 0)
               COUNT(*) FILTER (WHERE tmax < 0)  AS ice_days,         -- sans dégel (max < 0)
               COUNT(*) FILTER (WHERE tmax >= 25) AS summer_days,     -- ≥ 25
               COUNT(*) FILTER (WHERE tmax >= 30) AS hot_days,        -- ≥ 30
               COUNT(*) FILTER (WHERE tmax >= 35) AS very_hot_days,   -- ≥ 35
               COUNT(*) FILTER (WHERE tmin >= 20) AS tropical_nights, -- nuit tropicale
               COUNT(*) AS days
        FROM daily WHERE station=? AND tmin IS NOT NULL AND tmax IS NOT NULL
        GROUP BY year ORDER BY year
    """, (station,))

    # Jours où à 20h il fait plus de 20° (horaire) — par année
    evening = _rows(conn, """
        SELECT strftime('%Y', ts, 'unixepoch', 'localtime') AS year,
               COUNT(DISTINCT date(ts, 'unixepoch', 'localtime'))
                   FILTER (WHERE temp >= 20) AS warm_evenings
        FROM hourly
        WHERE station=? AND temp IS NOT NULL
          AND CAST(strftime('%H', ts, 'unixepoch', 'localtime') AS INT) = 20
        GROUP BY year ORDER BY year
    """, (station,))

    # Gel du matin (min entre 5h et 9h < 0) — par année
    morning_frost = _rows(conn, """
        SELECT strftime('%Y', ts, 'unixepoch', 'localtime') AS year,
               COUNT(DISTINCT date(ts, 'unixepoch', 'localtime'))
                   FILTER (WHERE temp < 0) AS frost_mornings
        FROM hourly
        WHERE station=? AND temp IS NOT NULL
          AND CAST(strftime('%H', ts, 'unixepoch', 'localtime') AS INT) BETWEEN 5 AND 9
        GROUP BY year ORDER BY year
    """, (station,))

    # Plus grosses amplitudes dans une même journée
    biggest_ranges = _rows(conn, """
        SELECT day, ROUND(tmax - tmin,1) AS value, tmin, tmax FROM daily
        WHERE station=? AND tmin IS NOT NULL AND tmax IS NOT NULL
        ORDER BY (tmax - tmin) DESC LIMIT 10
    """, (station,))

    # Plus gros refroidissements d'un jour à l'autre (chute de la moyenne)
    drops = _rows(conn, """
        SELECT d1.day AS from_day, d2.day AS day,
               ROUND(d2.tavg - d1.tavg, 1) AS value,
               d2.wind_angle, d2.wind_avg
        FROM daily d1 JOIN daily d2
          ON d2.station = d1.station AND date(d2.day) = date(d1.day, '+1 day')
        WHERE d1.station=? AND d1.tavg IS NOT NULL AND d2.tavg IS NOT NULL
        ORDER BY (d2.tavg - d1.tavg) ASC LIMIT 10
    """, (station,))

    # Corrélation vent du nord ↔ température :
    # comparaison de la variation de temp selon que le jour est "vent du nord" ou non
    corr = conn.execute("""
        SELECT
          AVG(CASE WHEN (d2.wind_angle >= ? OR d2.wind_angle <= ?) AND d2.wind_avg >= ?
                   THEN d2.tavg - d1.tavg END) AS north_delta,
          AVG(CASE WHEN NOT((d2.wind_angle >= ? OR d2.wind_angle <= ?) AND d2.wind_avg >= ?)
                   THEN d2.tavg - d1.tavg END) AS other_delta,
          COUNT(CASE WHEN (d2.wind_angle >= ? OR d2.wind_angle <= ?) AND d2.wind_avg >= ?
                   THEN 1 END) AS north_n
        FROM daily d1 JOIN daily d2
          ON d2.station = d1.station AND date(d2.day) = date(d1.day, '+1 day')
        WHERE d1.station=? AND d1.tavg IS NOT NULL AND d2.tavg IS NOT NULL
          AND d2.wind_angle IS NOT NULL
    """, (NORTH_MIN, NORTH_MAX, WINDY_DAY_KMH,
          NORTH_MIN, NORTH_MAX, WINDY_DAY_KMH,
          NORTH_MIN, NORTH_MAX, WINDY_DAY_KMH, station)).fetchone()

    conn.close()
    return {
        "thresholds": thresholds,
        "warm_evenings": evening,
        "morning_frost": morning_frost,
        "biggest_daily_ranges": biggest_ranges,
        "biggest_drops": drops,
        "north_wind_effect": {
            "north_delta": round(corr["north_delta"], 2) if corr["north_delta"] is not None else None,
            "other_delta": round(corr["other_delta"], 2) if corr["other_delta"] is not None else None,
            "north_days_count": corr["north_n"],
        },
    }


# ==========================================================================
# RECHERCHE
# ==========================================================================
MONTHS_FR = {
    "janvier": "01", "fevrier": "02", "février": "02", "mars": "03",
    "avril": "04", "mai": "05", "juin": "06", "juillet": "07",
    "aout": "08", "août": "08", "septembre": "09", "octobre": "10",
    "novembre": "11", "decembre": "12", "décembre": "12",
}


def search(station, query):
    """Recherche simple en langage naturel (FR)."""
    q = query.lower().strip()
    conn = db()
    result = {"query": query, "type": None, "rows": []}

    # « compare les 12 juin » / « les 3 janvier » → même date chaque année
    import re
    m = re.search(r"(\d{1,2})\s+(" + "|".join(MONTHS_FR.keys()) + r")", q)
    if m and ("compar" in q or "les " + m.group(0) in q or "tous les" in q):
        dd = f"{int(m.group(1)):02d}"
        mm = MONTHS_FR[m.group(2)]
        result["type"] = "same_date"
        result["label"] = f"Les {int(m.group(1))} {m.group(2)} de chaque année"
        result["rows"] = _rows(conn, """
            SELECT day, tavg, tmin, tmax, rain, wind_avg, gust_max, wind_angle
            FROM daily WHERE station=? AND substr(day,6,5)=? ORDER BY day
        """, (station, f"{mm}-{dd}"))
        conn.close()
        return result

    # filtre année éventuel
    ym = re.search(r"(20\d\d)", q)
    year_filter = ym.group(1) if ym else None
    where_year = f" AND substr(day,1,4)='{year_filter}'" if year_filter else ""

    def top(order, label, direction="DESC"):
        result["type"] = "top_days"
        result["label"] = label + (f" en {year_filter}" if year_filter else " (tous relevés)")
        result["rows"] = _rows(conn, f"""
            SELECT day, tavg, tmin, tmax, rain, wind_avg, gust_max, wind_angle
            FROM daily WHERE station=? AND {order} IS NOT NULL {where_year}
            ORDER BY {order} {direction} LIMIT 10
        """, (station,))

    if "chaud" in q:
        top("tmax", "Jours les plus chauds")
    elif "froid" in q:
        top("tmin", "Jours les plus froids", "ASC")
    elif "pluie" in q or "pluvieux" in q or "arros" in q:
        top("rain", "Jours les plus pluvieux")
    elif "vent" in q or "rafale" in q:
        top("gust_max", "Jours les plus venteux (rafale max)")
    elif "amplitude" in q or "ecart" in q or "écart" in q:
        result["type"] = "top_days"
        result["label"] = "Plus grosses amplitudes jour" + (f" en {year_filter}" if year_filter else "")
        result["rows"] = _rows(conn, f"""
            SELECT day, tavg, tmin, tmax, rain, wind_avg, gust_max, wind_angle,
                   ROUND(tmax-tmin,1) AS range
            FROM daily WHERE station=? AND tmin IS NOT NULL AND tmax IS NOT NULL {where_year}
            ORDER BY (tmax-tmin) DESC LIMIT 10
        """, (station,))
    else:
        # date précise « 12 juin 2023 »
        if m and year_filter:
            dd = f"{int(m.group(1)):02d}"
            mm = MONTHS_FR[m.group(2)]
            result["type"] = "single_day"
            result["label"] = f"Le {int(m.group(1))} {m.group(2)} {year_filter}"
            result["rows"] = _rows(conn, """
                SELECT day, tavg, tmin, tmax, rain, wind_avg, gust_max, wind_angle
                FROM daily WHERE station=? AND day=? LIMIT 1
            """, (station, f"{year_filter}-{mm}-{dd}"))
        else:
            result["type"] = "help"
            result["label"] = "Je n'ai pas compris. Essaie : « jour le plus chaud », « les plus froids en 2023 », « compare les 12 juin », « jours les plus pluvieux », « plus grosses amplitudes »…"

    conn.close()
    return result


def db_status():
    """Résumé de la base pour l'UI (par station)."""
    if not os.path.exists(DB_PATH):
        return {"ready": False}
    conn = db()
    out = {"ready": True, "stations": {}}
    for r in conn.execute(
        "SELECT station, COUNT(*) AS n, MIN(day) AS first, MAX(day) AS last FROM daily GROUP BY station"
    ):
        out["stations"][r["station"]] = {
            "days": r["n"], "first": r["first"], "last": r["last"],
        }
    conn.close()
    return out
