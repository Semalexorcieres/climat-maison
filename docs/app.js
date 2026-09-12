"use strict";

const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

// Palette catégorielle (une couleur par année, ordre fixe — palette validée)
const YEAR_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// ---------- Icônes Lucide (inline SVG, sans dépendance, MIT) ----------
const ICON_PATHS = {
  thermometer: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
  rain: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  snowflake: '<line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>',
  arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  arrowUp: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  arrowRight: '<path d="m9 18 6-6-6-6"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.3 19a10 10 0 1 1 17.3 0"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  trending: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
};
function ic(name, cls) {
  const p = ICON_PATHS[name];
  if (!p) return "";
  return `<svg class="ic${cls ? " " + cls : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
function paintIcons(root) {
  (root || document).querySelectorAll("[data-ic]").forEach((e) => {
    if (e.dataset.painted) return;
    e.innerHTML = ic(e.dataset.ic) + e.innerHTML;
    e.dataset.painted = "1";
  });
}

// ---------- Utilitaires ----------
function fmt(v, d = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toFixed(d).replace(/\.0$/, "");
}
function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
function fmtDay(dayStr) {
  if (!dayStr) return "—";
  const d = new Date(dayStr + "T12:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function trendArrow(t) {
  if (t === "up") return "↑";
  if (t === "down") return "↓";
  if (t === "stable") return "→";
  return "";
}
function windCardinal(angle) {
  if (angle === null || angle === undefined) return "—";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  return dirs[Math.round(angle / 22.5) % 16] + " · " + Math.round(angle) + "°";
}
function isNorth(angle) {
  return angle !== null && angle !== undefined && (angle >= 315 || angle <= 45);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
function showBanner(html) { const b = $("banner"); b.innerHTML = html; b.classList.remove("hidden"); }
function hideBanner() { $("banner").classList.add("hidden"); }

// ---------- Mode statique (site public GitHub Pages) vs live (serveur local) ----------
// En public, il n'y a pas de /api : on lit des fichiers JSON pré-exportés (data/…).
const STATIC = !!window.NETATMO_STATIC;
function sid(id) { return (id || "").replace(/:/g, "-"); }
function toStaticPath(u) {
  const [path, qs] = u.split("?");
  const p = new URLSearchParams(qs || "");
  const dev = sid(p.get("device_id") || currentStation || "");
  if (path === "/api/stations") return "data/stations.json";
  if (path === "/api/db-status") return "data/db-status.json";
  if (path === "/api/dashboard") return `data/dashboard/${dev}.json`;
  if (path === "/api/overview") return `data/overview/${dev}.json`;
  if (path === "/api/series") return `data/series/${dev}_${p.get("days") || 30}.json`;
  if (path.startsWith("/api/stats/")) return `data/stats/${path.split("/").pop()}_${dev}.json`;
  return u;
}
function smartFetch(u) {
  return fetch(STATIC ? toStaticPath(u) : u);
}

// ---------- Stations ----------
let currentStation = localStorage.getItem("station") || "";
let lastDashboard = null; // dernier instantané (pour la vue "jour")

async function loadStations() {
  try {
    const res = await smartFetch("/api/stations");
    const list = await res.json();
    if (!res.ok || list.error || !Array.isArray(list)) return;
    if (!currentStation || !list.some((s) => s.id === currentStation)) currentStation = list[0].id;
    if (list.length >= 2) {
      const sel = $("station-select");
      sel.innerHTML = "";
      list.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id; opt.textContent = s.name;
        sel.appendChild(opt);
      });
      sel.value = currentStation;
      sel.classList.remove("hidden");
    }
  } catch (e) { /* défaut */ }
}
function deviceParam() {
  return currentStation ? "?device_id=" + encodeURIComponent(currentStation) : "";
}
function apiUrl(route, extra) {
  let u = route + deviceParam();
  if (extra) u += (u.includes("?") ? "&" : "?") + extra;
  return u;
}

// ---------- Onglets ----------
const loadedTabs = {};
$("tabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  activateTab(btn.dataset.tab);
});
function activateTab(name) {
  document.querySelectorAll("#tabs button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-page").forEach((p) => p.classList.add("hidden"));
  $("tab-" + name).classList.remove("hidden");
  if (name !== "overview" && name !== "search" && !loadedTabs[name + currentStation]) {
    loadStatTab(name);
  }
}
function invalidateTabs() {
  Object.keys(loadedTabs).forEach((k) => delete loadedTabs[k]);
}

async function loadStatTab(name) {
  const page = $("tab-" + name);
  page.innerHTML = "<p class='loading'>Chargement des statistiques…</p>";
  try {
    const routes = { temperature: "temperature", rain: "rain", wind: "wind", climate: "climate" };
    const res = await smartFetch(apiUrl("/api/stats/" + routes[name]));
    const data = await res.json();
    if (!res.ok || data.error) {
      page.innerHTML = `<div class='panel' style='margin-top:24px'>
        <p>⏳ ${escapeHtml(data.error || "Statistiques indisponibles.")}</p>
        <p class='note'>Si la base est en cours de synchronisation (premier lancement), réessaie dans quelques minutes — l'historique complet est en train d'être récupéré depuis Netatmo.</p></div>`;
      return;
    }
    loadedTabs[name + currentStation] = true;
    if (name === "temperature") renderTemperaturePage(page, data);
    if (name === "rain") renderRainPage(page, data);
    if (name === "wind") renderWindPage(page, data);
    if (name === "climate") renderClimatePage(page, data);
  } catch (e) {
    page.innerHTML = "<p class='loading'>Erreur : " + escapeHtml(e.message) + "</p>";
  }
}

// ==========================================================================
// Helpers de rendu génériques
// ==========================================================================
function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstChild;
}
function statTile(label, value, unit, detail) {
  return `<div class="stat-tile"><div class="label">${label}</div>
    <div class="value">${value}<span class="unit">${unit || ""}</span></div>
    ${detail ? `<div class="detail">${detail}</div>` : ""}</div>`;
}
function sectionTitle(txt) { return `<h2>${txt}</h2>`; }

// Matrice années × mois
function matrixTable(monthlyRows, field, opts = {}) {
  const years = [...new Set(monthlyRows.map((r) => r.year))].sort();
  const byYM = {};
  monthlyRows.forEach((r) => { byYM[r.year + "-" + r.month] = r[field]; });
  // repère les extrêmes par mois (colonne) pour surligner
  let best = {};
  if (opts.highlight) {
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      let bv = null;
      years.forEach((y) => {
        const v = byYM[y + "-" + mm];
        if (v === null || v === undefined) return;
        if (bv === null || (opts.highlight === "max" ? v > bv : v < bv)) bv = v;
      });
      best[mm] = bv;
    }
  }
  let html = `<div class="table-wrap"><table class="data"><thead><tr><th>Année</th>`;
  for (let m = 0; m < 12; m++) html += `<th>${MONTHS_SHORT[m]}</th>`;
  html += `</tr></thead><tbody>`;
  years.forEach((y) => {
    html += `<tr><td>${y}</td>`;
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      const v = byYM[y + "-" + mm];
      const isBest = opts.highlight && v !== null && v !== undefined && v === best[mm];
      html += `<td class="${isBest ? "best" : ""}">${v === null || v === undefined ? "·" : fmt(v, opts.dec ?? 1)}</td>`;
    }
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

// Graphe multi-lignes (x = 12 mois, une ligne par année)
function multiLineChart(container, monthlyRows, field, unit) {
  const years = [...new Set(monthlyRows.map((r) => r.year))].sort();
  const byYM = {};
  monthlyRows.forEach((r) => { byYM[r.year + "-" + r.month] = r[field]; });

  const W = 1000, H = 360;
  const m = { top: 18, right: 20, bottom: 30, left: 40 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;

  let all = monthlyRows.map((r) => r[field]).filter((v) => v !== null && v !== undefined);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  const pad = Math.max(0.5, (hi - lo) * 0.08);
  lo -= pad; hi += pad;

  const x = (mi) => m.left + (mi / 11) * iw;
  const y = (v) => m.top + ih - ((v - lo) / (hi - lo)) * ih;

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  for (let t = 0; t <= 4; t++) {
    const val = lo + ((hi - lo) * t) / 4;
    line(svg, m.left, y(val), W - m.right, y(val), "gridline");
    text(svg, m.left - 8, y(val) + 4, Math.round(val) + (unit === "mm" ? "" : "°"), "axis-text", "end");
  }
  for (let mi = 0; mi < 12; mi++) text(svg, x(mi), H - 8, MONTHS_SHORT[mi], "axis-text", "middle");

  years.forEach((yr, yi) => {
    const color = YEAR_COLORS[yi % YEAR_COLORS.length];
    let d = "", started = false;
    for (let mi = 0; mi < 12; mi++) {
      const v = byYM[yr + "-" + String(mi + 1).padStart(2, "0")];
      if (v === null || v === undefined) { started = false; continue; }
      d += (started ? "L" : "M") + x(mi) + "," + y(v) + " ";
      started = true;
    }
    if (d) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", color);
      p.setAttribute("stroke-width", "2");
      svg.appendChild(p);
    }
  });

  // hover : point le plus proche
  const tip = document.createElement("div");
  tip.className = "tooltip";
  container.appendChild(tip);
  const overlay = document.createElementNS(NS, "rect");
  overlay.setAttribute("x", m.left); overlay.setAttribute("y", m.top);
  overlay.setAttribute("width", iw); overlay.setAttribute("height", ih);
  overlay.setAttribute("fill", "transparent");
  svg.appendChild(overlay);
  overlay.addEventListener("mousemove", (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    let mi = Math.round(((px - m.left) / iw) * 11);
    mi = Math.max(0, Math.min(11, mi));
    const mm = String(mi + 1).padStart(2, "0");
    let rows = years.map((yr, yi) => {
      const v = byYM[yr + "-" + mm];
      return v === null || v === undefined ? "" :
        `<span style="color:${YEAR_COLORS[yi % YEAR_COLORS.length]}">●</span> ${yr} : <b>${fmt(v)}${unit || ""}</b>`;
    }).filter(Boolean);
    tip.innerHTML = `<b>${MONTHS_SHORT[mi]}</b><br>` + rows.join("<br>");
    tip.style.left = (x(mi) / W) * rect.width + "px";
    tip.style.top = "40px";
    tip.style.opacity = "1";
  });
  overlay.addEventListener("mouseleave", () => { tip.style.opacity = "0"; });

  container.appendChild(svg);

  // légende
  const legend = el(`<div class="legend"></div>`);
  years.forEach((yr, yi) => {
    legend.appendChild(el(`<span><span class="swatch" style="background:${YEAR_COLORS[yi % YEAR_COLORS.length]}"></span> ${yr}</span>`));
  });
  container.parentElement.insertBefore(legend, container);
}

// Graphe barres simple (par année ou mois)
function barChart(container, labels, values, color, unit) {
  const W = 1000, H = 280;
  const m = { top: 16, right: 16, bottom: 30, left: 44 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
  const hi = Math.max(1, ...values.filter((v) => v !== null && v !== undefined));
  const bw = Math.min(60, (iw / labels.length) * 0.62);
  const x = (i) => m.left + ((i + 0.5) / labels.length) * iw;
  const y = (v) => m.top + ih - (v / hi) * ih;

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  for (let t = 0; t <= 3; t++) {
    const val = (hi * t) / 3;
    line(svg, m.left, y(val), W - m.right, y(val), "gridline");
    text(svg, m.left - 8, y(val) + 4, Math.round(val), "axis-text", "end");
  }
  values.forEach((v, i) => {
    if (v === null || v === undefined) return;
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", x(i) - bw / 2);
    rect.setAttribute("y", y(v));
    rect.setAttribute("width", bw);
    rect.setAttribute("height", Math.max(0, m.top + ih - y(v)));
    rect.setAttribute("rx", "3");
    rect.setAttribute("fill", color);
    svg.appendChild(rect);
    if (labels.length <= 16) text(svg, x(i), y(v) - 6, fmt(v, 0) + (unit || ""), "axis-text", "middle");
  });
  labels.forEach((l, i) => {
    if (labels.length > 16 && i % 2) return;
    text(svg, x(i), H - 8, l, "axis-text", "middle");
  });
  container.appendChild(svg);
}

// Rose des vents (8 secteurs)
function windRose(container, rose) {
  const size = 340, c = size / 2, rMax = c - 40;
  const maxDays = Math.max(1, ...rose.map((r) => r.days));
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  // cercles repères
  [0.33, 0.66, 1].forEach((f) => {
    const circ = document.createElementNS(NS, "circle");
    circ.setAttribute("cx", c); circ.setAttribute("cy", c);
    circ.setAttribute("r", rMax * f);
    circ.setAttribute("fill", "none");
    circ.setAttribute("class", "gridline");
    svg.appendChild(circ);
  });
  rose.forEach((r, i) => {
    const angle = i * 45 - 90; // N en haut
    const rad = ((angle) * Math.PI) / 180;
    const rr = (r.days / maxDays) * rMax;
    const spread = (Math.PI / 180) * 18;
    const x1 = c + Math.cos(rad - spread) * rr;
    const y1 = c + Math.sin(rad - spread) * rr;
    const x2 = c + Math.cos(rad + spread) * rr;
    const y2 = c + Math.sin(rad + spread) * rr;
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", `M${c},${c} L${x1},${y1} A${rr},${rr} 0 0 1 ${x2},${y2} Z`);
    p.setAttribute("fill", i === 0 || i === 1 || i === 7 ? "var(--min)" : "var(--axis)");
    p.setAttribute("opacity", "0.85");
    svg.appendChild(p);
    const lx = c + Math.cos(rad) * (rMax + 18);
    const ly = c + Math.sin(rad) * (rMax + 18) + 4;
    text(svg, lx, ly, `${r.sector} ${r.days}`, "axis-text", "middle");
  });
  container.appendChild(svg);
}

// ==========================================================================
// PAGES DE STATS
// ==========================================================================
// Graphe band min/max compact (semaine / mois) à partir des relevés journaliers
function tempBand(host, rows) {
  host.innerHTML = "";
  rows = (rows || []).filter((r) => r.tmin != null || r.tmax != null);
  if (rows.length < 2) { host.innerHTML = "<p class='loading'>Pas assez de données.</p>"; return; }
  const W = 1000, H = 300, m = { top: 16, right: 14, bottom: 30, left: 34 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
  const mins = rows.map((r) => r.tmin), maxs = rows.map((r) => r.tmax);
  const vals = mins.concat(maxs).filter((v) => v != null);
  let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  const pad = Math.max(1, (hi - lo) * 0.12); lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
  const n = rows.length;
  const x = (i) => m.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => m.top + ih - ((v - lo) / (hi - lo)) * ih;
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  for (let t = 0; t <= 4; t++) {
    const val = lo + (hi - lo) * t / 4;
    line(svg, m.left, y(val), W - m.right, y(val), "gridline");
    text(svg, m.left - 8, y(val) + 4, Math.round(val) + "°", "axis-text", "end");
  }
  let top = "", bot = "";
  rows.forEach((r, i) => { if (r.tmax != null) top += `${x(i)},${y(r.tmax)} `; });
  for (let i = n - 1; i >= 0; i--) { if (rows[i].tmin != null) bot += `${x(i)},${y(rows[i].tmin)} `; }
  if (top && bot) { const p = document.createElementNS(NS, "polygon"); p.setAttribute("points", top + bot); p.setAttribute("class", "band"); svg.appendChild(p); }
  path(svg, maxs, x, y, "line-max"); path(svg, mins, x, y, "line-min");
  const step = Math.max(1, Math.ceil(n / 6));
  for (let i = 0; i < n; i += step) text(svg, x(i), H - 8, fmtDayShort(rows[i].day), "axis-text", "middle");
  host.appendChild(svg);
}

function weekMonthStats(rows) {
  let min = null, max = null, sum = 0, cnt = 0;
  rows.forEach((r) => {
    if (r.tmin != null && (min === null || r.tmin < min.v)) min = { v: r.tmin, day: r.day };
    if (r.tmax != null && (max === null || r.tmax > max.v)) max = { v: r.tmax, day: r.day };
    if (r.tavg != null) { sum += r.tavg; cnt++; }
  });
  return { avg: cnt ? Math.round(sum / cnt * 10) / 10 : null, min, max };
}
function periodStatGrid(s, title) {
  return `<section class="stat-section">${sectionTitle(title)}
    <div class="stat-grid">
      ${statTile("Moyenne", fmt(s.avg), "°C")}
      ${statTile("Le plus froid", fmt(s.min && s.min.v), "°C", s.min ? fmtDayShort(s.min.day) : "")}
      ${statTile("Le plus chaud", fmt(s.max && s.max.v), "°C", s.max ? fmtDayShort(s.max.day) : "")}
    </div></section>`;
}

function renderDay(host, tstats) {
  const o = (lastDashboard && lastDashboard.current && lastDashboard.current.outdoor) || {};
  const mn = o.min_today, mx = o.max_today;
  const amp = (mn != null && mx != null) ? Math.round((mx - mn) * 10) / 10 : null;
  const mm = String(new Date().getMonth() + 1).padStart(2, "0");
  const clim = (tstats.climatology || []).find((c) => c.month === mm);
  host.innerHTML = `
    <section class="day-hero">
      <div class="day-cur">
        <div class="label">Actuel</div>
        <div class="v">${fmt(o.temp)}<span class="u">°C</span> ${trendArrow(o.trend)}</div>
        <div class="sub">${fmt(o.humidity, 0)}% humidité</div>
      </div>
      <div class="day-mm">
        <div class="day-x day-x-min">${ic("snowflake")}<div>
          <div class="label">Min du jour</div><div class="v">${fmt(mn)}°</div>
          <div class="sub">${o.min_today_ts ? "à " + fmtTime(o.min_today_ts) : ""}</div></div></div>
        <div class="day-x day-x-max">${ic("flame")}<div>
          <div class="label">Max du jour</div><div class="v">${fmt(mx)}°</div>
          <div class="sub">${o.max_today_ts ? "à " + fmtTime(o.max_today_ts) : ""}</div></div></div>
      </div>
      ${amp != null ? `<div class="day-amp">Amplitude du jour <b>${amp}°</b></div>` : ""}
      ${clim ? `<div class="day-normal">Normale de ${MONTHS_SHORT[parseInt(mm, 10) - 1]} : min <b>${fmt(clim.avg_min)}°</b> · max <b>${fmt(clim.avg_max)}°</b></div>` : ""}
    </section>`;
  paintIcons(host);
}

function renderWeek(host, rows) {
  const last = rows.slice(-7);
  host.innerHTML = periodStatGrid(weekMonthStats(last), "Cette semaine (7 derniers jours)") +
    `<section class="stat-section">${sectionTitle("Min / max jour par jour")}<div class="chart" id="t-band"></div></section>`;
  tempBand(host.querySelector("#t-band"), last);
}

function renderMonth(host, rows, d) {
  const ym = new Date().toISOString().slice(0, 7);
  let cur = rows.filter((r) => r.day.slice(0, 7) === ym);
  if (cur.length < 2) cur = rows.slice(-30);
  const s = weekMonthStats(cur);
  // Comparaison de la moyenne du mois avec les mêmes mois des années passées
  const mm = ym.slice(5, 7);
  const sameMonth = (d.monthly || []).filter((r) => r.month === mm && r.year !== ym.slice(0, 4) && r.avg != null);
  let cmp = "";
  if (s.avg != null && sameMonth.length) {
    const past = sameMonth.reduce((a, b) => a + b.avg, 0) / sameMonth.length;
    const diff = Math.round((s.avg - past) * 10) / 10;
    cmp = `<div class="day-normal">Moyenne du mois <b>${fmt(s.avg)}°</b> · ${diff >= 0 ? "+" : ""}${diff}° vs les ${MONTHS_SHORT[parseInt(mm, 10) - 1]} passés (${fmt(past)}°)</div>`;
  }
  host.innerHTML = periodStatGrid(s, "Ce mois-ci") + cmp +
    `<section class="stat-section">${sectionTitle("Min / max jour par jour")}<div class="chart" id="t-band"></div></section>`;
  tempBand(host.querySelector("#t-band"), cur);
}

function renderYear(host, d) {
  host.innerHTML = `
    <section class="stat-section">${sectionTitle("Bilan par année")}
      <div class="table-wrap"><table class="data"><thead>
        <tr><th>Année</th><th>Moyenne</th><th>Min</th><th>le</th><th>Max</th><th>le</th><th>Jours</th></tr>
      </thead><tbody>
        ${d.yearly.map((y) => `<tr><td>${y.year}</td><td>${fmt(y.avg)}°</td>
          <td class="neg">${fmt(y.min)}°</td><td>${fmtDay(y.min_day)}</td>
          <td class="pos">${fmt(y.max)}°</td><td>${fmtDay(y.max_day)}</td>
          <td>${y.days}</td></tr>`).join("")}
      </tbody></table></div></section>
    <section class="stat-section">${sectionTitle("Comparaison des années — moyenne mensuelle")}
      <div class="chart" id="t-multiline"></div></section>
    <section class="stat-section">${sectionTitle("Moyennes mensuelles par année")}
      <div class="year-btns" style="display:flex;gap:4px;margin-bottom:8px">
        <button class="active" data-f="avg">Moyenne</button>
        <button data-f="min">Min</button>
        <button data-f="max">Max</button>
      </div>
      <div id="t-matrix"></div></section>`;
  multiLineChart(host.querySelector("#t-multiline"), d.monthly, "avg", "°");
  const matrixHost = host.querySelector("#t-matrix");
  const drawMatrix = (f) => { matrixHost.innerHTML = matrixTable(d.monthly, f, { highlight: f === "min" ? "min" : "max" }); };
  drawMatrix("avg");
  host.querySelector(".year-btns").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    host.querySelectorAll(".year-btns button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    drawMatrix(b.dataset.f);
  });
}

function renderTemperaturePage(page, d) {
  const yearsCount = d.yearly.length;
  const hottest = d.hottest_days[0], coldest = d.coldest_days[0];
  page.innerHTML = `
    <div class="seg" id="t-seg">
      <button data-p="day" class="active">Jour</button>
      <button data-p="week">Semaine</button>
      <button data-p="month">Mois</button>
      <button data-p="year">Année</button>
    </div>
    <div id="t-period"></div>

    <section class="stat-section">
      ${sectionTitle("Records absolus")}
      <div class="stat-grid">
        ${statTile("Record de chaleur", fmt(hottest?.value), "°C", fmtDay(hottest?.day))}
        ${statTile("Record de froid", fmt(coldest?.value), "°C", fmtDay(coldest?.day))}
      </div>
    </section>
    <section class="stat-section">
      ${sectionTitle("Climatologie mensuelle (toutes années)")}
      <div class="table-wrap"><table class="data"><thead>
        <tr><th>Mois</th><th>Moy</th><th>Moy min</th><th>Moy max</th><th>Record min</th><th>Record max</th></tr>
      </thead><tbody>
        ${d.climatology.map((c) => `<tr><td>${MONTHS_SHORT[parseInt(c.month, 10) - 1]}</td>
          <td>${fmt(c.avg)}°</td><td>${fmt(c.avg_min)}°</td><td>${fmt(c.avg_max)}°</td>
          <td class="neg">${fmt(c.record_min)}°</td><td class="pos">${fmt(c.record_max)}°</td></tr>`).join("")}
      </tbody></table></div>
    </section>
    <p class="since-note">Relevés depuis le ${fmtDay(d.since)} · ${yearsCount} années de données</p>`;

  const period = page.querySelector("#t-period");
  const renderPeriod = async (p) => {
    if (p === "day") return renderDay(period, d);
    if (p === "year") return renderYear(period, d);
    period.innerHTML = "<p class='loading'>Chargement…</p>";
    const rows = await loadDaily(currentStation);
    if (p === "week") return renderWeek(period, rows);
    if (p === "month") return renderMonth(period, rows, d);
  };
  renderPeriod("day");
  page.querySelector("#t-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    page.querySelectorAll("#t-seg button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    renderPeriod(b.dataset.p);
  });
}

// Barres journalières compactes (pluie, rafales…) depuis les relevés du jour
function dayBars(host, rows, pick, color) {
  host.innerHTML = "";
  const vals = rows.map(pick);
  if (!rows.length || !vals.some((v) => v != null)) { host.innerHTML = "<p class='loading'>Pas de données.</p>"; return; }
  const W = 1000, H = 260, m = { top: 14, right: 12, bottom: 28, left: 34 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
  const hi = Math.max(1, Math.max.apply(null, vals.filter((v) => v != null)));
  const n = rows.length;
  const bw = Math.max(2, (iw / n) * 0.68);
  const x = (i) => m.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  for (let t = 0; t <= 3; t++) {
    const val = hi * t / 3, yy = m.top + ih - (val / hi) * ih;
    line(svg, m.left, yy, W - m.right, yy, "gridline");
    text(svg, m.left - 8, yy + 4, Math.round(val), "axis-text", "end");
  }
  vals.forEach((v, i) => {
    if (v == null || v <= 0) return;
    const bh = (v / hi) * ih;
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", x(i) - bw / 2); rect.setAttribute("y", m.top + ih - bh);
    rect.setAttribute("width", bw); rect.setAttribute("height", bh);
    rect.setAttribute("rx", "1.5"); rect.setAttribute("fill", color);
    svg.appendChild(rect);
  });
  const step = Math.max(1, Math.ceil(n / 6));
  for (let i = 0; i < n; i += step) text(svg, x(i), H - 8, fmtDayShort(rows[i].day), "axis-text", "middle");
  host.appendChild(svg);
}

function rainStatsOf(rows) {
  let total = 0, rainy = 0, wettest = null;
  rows.forEach((r) => {
    if (r.rain != null) { total += r.rain; if (r.rain >= 1) rainy++; if (wettest === null || r.rain > wettest.v) wettest = { v: r.rain, day: r.day }; }
  });
  return { total: Math.round(total * 10) / 10, rainy, wettest };
}

function renderRainDay(host, d) {
  const r = (lastDashboard && lastDashboard.current && lastDashboard.current.rain) || {};
  const lr = d.last_rain;
  host.innerHTML = `
    <section class="day-hero">
      <div class="day-cur">
        <div class="label">Aujourd'hui</div>
        <div class="v">${fmt(r.day, 1)}<span class="u">mm</span></div>
        <div class="sub">${fmt(r.hour, 1)} mm/h en ce moment</div>
      </div>
      ${lr ? `<div class="day-normal">${ic("droplet")} Dernière pluie <b>${agoLabel(lr.days_ago)}</b> · ${fmtDayShort(lr.day)} · ${fmt(lr.mm)} mm</div>` : ""}
      <div class="day-amp">${d.current_dry_days} jour${d.current_dry_days > 1 ? "s" : ""} sans pluie en cours</div>
    </section>`;
  paintIcons(host);
}
function renderRainWeek(host, rows) {
  const last = rows.slice(-7); const s = rainStatsOf(last);
  host.innerHTML = `<section class="stat-section">${sectionTitle("Cette semaine (7 derniers jours)")}
    <div class="stat-grid">
      ${statTile("Cumul", fmt(s.total), " mm")}
      ${statTile("Jours de pluie", s.rainy, "", "≥ 1 mm")}
      ${statTile("Jour le plus arrosé", fmt(s.wettest && s.wettest.v), " mm", s.wettest ? fmtDayShort(s.wettest.day) : "")}
    </div></section>
    <section class="stat-section">${sectionTitle("Pluie jour par jour")}<div class="chart" id="r-bars"></div></section>`;
  dayBars(host.querySelector("#r-bars"), last, (r) => r.rain, "var(--rain)");
}
function renderRainMonth(host, rows, d) {
  const ym = new Date().toISOString().slice(0, 7);
  let cur = rows.filter((r) => r.day.slice(0, 7) === ym);
  if (cur.length < 2) cur = rows.slice(-30);
  const s = rainStatsOf(cur);
  const mm = ym.slice(5, 7);
  const past = (d.monthly || []).filter((r) => r.month === mm && r.year !== ym.slice(0, 4) && r.total != null);
  let cmp = "";
  if (past.length) { const avg = past.reduce((a, b) => a + b.total, 0) / past.length; cmp = `<div class="day-normal">Ce mois <b>${fmt(s.total)} mm</b> · normale ${MONTHS_SHORT[parseInt(mm, 10) - 1]} ≈ ${fmt(avg)} mm</div>`; }
  host.innerHTML = `<section class="stat-section">${sectionTitle("Ce mois-ci")}
    <div class="stat-grid">
      ${statTile("Cumul", fmt(s.total), " mm")}
      ${statTile("Jours de pluie", s.rainy, "", "≥ 1 mm")}
      ${statTile("Jour le plus arrosé", fmt(s.wettest && s.wettest.v), " mm", s.wettest ? fmtDayShort(s.wettest.day) : "")}
    </div></section>${cmp}
    <section class="stat-section">${sectionTitle("Pluie jour par jour")}<div class="chart" id="r-bars"></div></section>`;
  dayBars(host.querySelector("#r-bars"), cur, (r) => r.rain, "var(--rain)");
}
function renderRainYear(host, d) {
  host.innerHTML = `
    <section class="stat-section">${sectionTitle("Cumul annuel")}<div class="chart" id="r-yearly"></div></section>
    <section class="stat-section">${sectionTitle("Bilan par année")}
      <div class="table-wrap"><table class="data"><thead>
        <tr><th>Année</th><th>Total</th><th>Jours de pluie (≥1 mm)</th><th>Max 24 h</th><th>le</th></tr>
      </thead><tbody>
        ${d.yearly.map((y) => `<tr><td>${y.year}</td><td>${fmt(y.total)} mm</td>
          <td>${y.rainy_days}</td><td>${fmt(y.max_day)} mm</td><td>${fmtDay(y.max_day_date)}</td></tr>`).join("")}
      </tbody></table></div></section>
    <section class="stat-section">${sectionTitle("Cumuls mensuels par année")}
      <div id="r-matrix">${matrixTable(d.monthly, "total", { highlight: "max", dec: 0 })}</div></section>`;
  barChart(host.querySelector("#r-yearly"), d.yearly.map((y) => y.year), d.yearly.map((y) => y.total), "var(--rain)", "");
}

function renderRainPage(page, d) {
  page.innerHTML = `
    <div class="seg" id="r-seg">
      <button data-p="day" class="active">Jour</button>
      <button data-p="week">Semaine</button>
      <button data-p="month">Mois</button>
      <button data-p="year">Année</button>
    </div>
    <div id="r-period"></div>
    <section class="stat-section">
      ${sectionTitle("Records & climatologie")}
      <div class="stat-grid">
        ${statTile("Record de sécheresse", d.longest_dry_spell.days, " jours", "fini le " + fmtDay(d.longest_dry_spell.end))}
        ${statTile("Record en 24 h", fmt(d.wettest_days[0]?.value), " mm", fmtDay(d.wettest_days[0]?.day))}
      </div>
    </section>
    <section class="stat-section">
      ${sectionTitle("Mois moyen (climatologie)")}
      <div class="chart" id="r-clim"></div>
    </section>`;
  barChart(page.querySelector("#r-clim"),
    d.climatology.map((c) => MONTHS_SHORT[parseInt(c.month, 10) - 1]),
    d.climatology.map((c) => c.avg_total), "var(--rain)", "");

  const period = page.querySelector("#r-period");
  const renderPeriod = async (p) => {
    if (p === "day") return renderRainDay(period, d);
    if (p === "year") return renderRainYear(period, d);
    period.innerHTML = "<p class='loading'>Chargement…</p>";
    const rows = await loadDaily(currentStation);
    if (p === "week") return renderRainWeek(period, rows);
    if (p === "month") return renderRainMonth(period, rows, d);
  };
  renderPeriod("day");
  page.querySelector("#r-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    page.querySelectorAll("#r-seg button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active"); renderPeriod(b.dataset.p);
  });
}

function windStatsOf(rows, threshold) {
  let sum = 0, cnt = 0, maxG = null, windy = 0, north = 0;
  rows.forEach((r) => {
    if (r.wind_avg != null) { sum += r.wind_avg; cnt++; if (r.wind_avg >= threshold) { windy++; if (isNorth(r.wind_angle)) north++; } }
    if (r.gust_max != null && (maxG === null || r.gust_max > maxG.v)) maxG = { v: r.gust_max, day: r.day };
  });
  return { avg: cnt ? Math.round(sum / cnt) : null, maxGust: maxG, windy, north };
}
function renderWindDay(host, d) {
  const w = (lastDashboard && lastDashboard.current && lastDashboard.current.wind) || {};
  host.innerHTML = `
    <section class="day-hero">
      <div class="day-cur">
        <div class="label">Vent actuel</div>
        <div class="v">${fmt(w.strength, 0)}<span class="u">km/h</span></div>
        <div class="sub">${w.angle != null ? windCardinal(w.angle) + (isNorth(w.angle) ? " ❄️ vent du nord" : "") : ""}</div>
      </div>
      <div class="day-mm">
        <div class="day-x">${ic("wind")}<div><div class="label">Rafale actuelle</div><div class="v">${fmt(w.gust, 0)}</div><div class="sub">km/h</div></div></div>
        <div class="day-x">${ic("trending")}<div><div class="label">Rafale max du jour</div><div class="v">${fmt(w.max_today, 0)}</div><div class="sub">km/h</div></div></div>
      </div>
    </section>`;
  paintIcons(host);
}
function windPeriod(host, rows, d, title, cmp) {
  const s = windStatsOf(rows, d.windy_threshold);
  host.innerHTML = `<section class="stat-section">${sectionTitle(title)}
    <div class="stat-grid">
      ${statTile("Vent moyen", fmt(s.avg, 0), " km/h")}
      ${statTile("Rafale max", fmt(s.maxGust && s.maxGust.v, 0), " km/h", s.maxGust ? fmtDayShort(s.maxGust.day) : "")}
      ${statTile("Jours de vent", s.windy, "", "dont " + s.north + " du nord")}
    </div></section>${cmp || ""}
    <section class="stat-section">${sectionTitle("Rafale max jour par jour")}<div class="chart" id="w-bars"></div></section>`;
  dayBars(host.querySelector("#w-bars"), rows, (r) => r.gust_max, "var(--min)");
}
function renderWindYear(host, d) {
  host.innerHTML = `
    <section class="stat-section">${sectionTitle("Bilan par année")}
      <div class="table-wrap"><table class="data"><thead>
        <tr><th>Année</th><th>Vent moyen</th><th>Rafale max</th><th>le</th><th>Jours de vent</th><th>dont nord</th></tr>
      </thead><tbody>
        ${d.yearly.map((y) => {
          const n = d.north_yearly.find((x) => x.year === y.year);
          return `<tr><td>${y.year}</td><td>${fmt(y.avg)} km/h</td>
            <td>${fmt(y.max_gust, 0)} km/h</td><td>${fmtDay(y.max_gust_day)}</td>
            <td>${y.windy_days}</td><td class="best">${n ? n.north_days : "·"}</td></tr>`;
        }).join("")}
      </tbody></table></div></section>
    <section class="stat-section two-cols">
      <div>${sectionTitle("Rose des vents")}<div class="chart" id="w-rose" style="display:flex;justify-content:center"></div></div>
      <div>${sectionTitle("Vent du nord — par mois")}<div class="chart" id="w-north-monthly"></div></div>
    </section>
    <section class="stat-section">${sectionTitle("Top 10 des plus grosses rafales")}
      <div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Rafale</th><th>Direction</th></tr></thead>
      <tbody>${d.gustiest_days.map((r) => `<tr><td>${fmtDay(r.day)}</td><td>${fmt(r.value, 0)} km/h</td>
        <td>${windCardinal(r.wind_angle)}${isNorth(r.wind_angle) ? " ❄️" : ""}</td></tr>`).join("")}</tbody></table></div></section>`;
  windRose(host.querySelector("#w-rose"), d.rose);
  barChart(host.querySelector("#w-north-monthly"),
    d.north_monthly.map((m) => MONTHS_SHORT[parseInt(m.month, 10) - 1]),
    d.north_monthly.map((m) => m.north_days), "var(--min)", "");
}

function renderWindPage(page, d) {
  const northTotal = d.north_yearly.reduce((s, y) => s + (y.north_days || 0), 0);
  const gustRec = d.gustiest_days[0];
  page.innerHTML = `
    <div class="seg" id="w-seg">
      <button data-p="day" class="active">Jour</button>
      <button data-p="week">Semaine</button>
      <button data-p="month">Mois</button>
      <button data-p="year">Année</button>
    </div>
    <div id="w-period"></div>
    <section class="stat-section">
      ${sectionTitle("Records")}
      <div class="stat-grid">
        ${statTile("Record de rafale", fmt(gustRec?.value, 0), " km/h", fmtDay(gustRec?.day))}
        ${statTile("Jours de vent du nord", northTotal, "", "depuis le début (secteur NO→NE)")}
      </div>
      <p class="note">« Jour de vent » = moyenne journalière ≥ ${d.windy_threshold} km/h. « Vent du nord » = direction entre 315° (NO) et 45° (NE).</p>
    </section>`;

  const period = page.querySelector("#w-period");
  const renderPeriod = async (p) => {
    if (p === "day") return renderWindDay(period, d);
    if (p === "year") return renderWindYear(period, d);
    period.innerHTML = "<p class='loading'>Chargement…</p>";
    const rows = await loadDaily(currentStation);
    if (p === "week") return windPeriod(period, rows.slice(-7), d, "Cette semaine (7 derniers jours)");
    if (p === "month") {
      const ym = new Date().toISOString().slice(0, 7);
      let cur = rows.filter((r) => r.day.slice(0, 7) === ym);
      if (cur.length < 2) cur = rows.slice(-30);
      return windPeriod(period, cur, d, "Ce mois-ci");
    }
  };
  renderPeriod("day");
  page.querySelector("#w-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    page.querySelectorAll("#w-seg button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active"); renderPeriod(b.dataset.p);
  });
}

function renderClimatePage(page, d) {
  const nw = d.north_wind_effect;
  const effectTxt = nw.north_delta !== null
    ? `Les lendemains de vent du nord, la température moyenne varie de <b>${nw.north_delta > 0 ? "+" : ""}${fmt(nw.north_delta, 1)}°C</b>, contre <b>${nw.other_delta > 0 ? "+" : ""}${fmt(nw.other_delta, 1)}°C</b> les autres jours (${nw.north_days_count} jours de vent du nord analysés).`
    : "Pas encore assez de données.";

  const evByYear = {}; d.warm_evenings.forEach((r) => evByYear[r.year] = r.warm_evenings);
  const mfByYear = {}; d.morning_frost.forEach((r) => mfByYear[r.year] = r.frost_mornings);

  page.innerHTML = `
    <section class="stat-section">
      ${sectionTitle("Jours à seuil, par année")}
      <div class="table-wrap"><table class="data"><thead>
        <tr><th>Année</th><th>Gel (min &lt; 0°)</th><th>Gel du matin (5–9 h)</th><th>Sans dégel (max &lt; 0°)</th>
        <th>≥ 25°</th><th>≥ 30°</th><th>≥ 35°</th><th>Nuits ≥ 20°</th><th>20 h ≥ 20°</th></tr>
      </thead><tbody>
        ${d.thresholds.map((y) => `<tr><td>${y.year}</td>
          <td>${y.frost_days}</td><td>${mfByYear[y.year] ?? "·"}</td><td>${y.ice_days}</td>
          <td>${y.summer_days}</td><td>${y.hot_days}</td><td>${y.very_hot_days}</td>
          <td>${y.tropical_nights}</td><td>${evByYear[y.year] ?? "·"}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="note">« Nuits ≥ 20° » = nuits tropicales (le minimum de la journée ne descend pas sous 20 °C). « 20 h ≥ 20° » = jours où il fait encore au moins 20 °C à 20 heures.</p>
    </section>

    <section class="stat-section">
      ${sectionTitle("Évolution — jours de gel et jours ≥ 30° par année")}
      <div class="legend"><span><span class="swatch sw-min"></span> Jours de gel</span>
      <span><span class="swatch sw-max"></span> Jours ≥ 30°</span></div>
      <div class="chart" id="c-thresholds"></div>
    </section>

    <section class="stat-section">
      ${sectionTitle("Vent du nord et température")}
      <div class="panel">${effectTxt}</div>
    </section>

    <section class="stat-section two-cols">
      <div>
        ${sectionTitle("Plus grosses amplitudes en 24 h")}
        <div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Écart</th><th>Min</th><th>Max</th></tr></thead>
        <tbody>${d.biggest_daily_ranges.map((r) => `<tr><td>${fmtDay(r.day)}</td><td class="best">${fmt(r.value)}°</td>
          <td class="neg">${fmt(r.tmin)}°</td><td class="pos">${fmt(r.tmax)}°</td></tr>`).join("")}</tbody></table></div>
      </div>
      <div>
        ${sectionTitle("Plus gros refroidissements d'un jour à l'autre")}
        <div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Chute</th><th>Vent ce jour-là</th></tr></thead>
        <tbody>${d.biggest_drops.map((r) => `<tr><td>${fmtDay(r.day)}</td><td class="neg">${fmt(r.value)}°</td>
          <td>${windCardinal(r.wind_angle)}${isNorth(r.wind_angle) ? " ❄️ nord" : ""}</td></tr>`).join("")}</tbody></table></div>
      </div>
    </section>`;

  // double barres gel / ≥30
  const host = page.querySelector("#c-thresholds");
  const years = d.thresholds.map((y) => y.year);
  const W = 1000, H = 300, m = { top: 16, right: 16, bottom: 30, left: 44 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
  const hi = Math.max(1, ...d.thresholds.map((y) => Math.max(y.frost_days, y.hot_days)));
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  for (let t = 0; t <= 3; t++) {
    const val = (hi * t) / 3;
    const yy = m.top + ih - (val / hi) * ih;
    line(svg, m.left, yy, W - m.right, yy, "gridline");
    text(svg, m.left - 8, yy + 4, Math.round(val), "axis-text", "end");
  }
  const groupW = iw / years.length;
  const bw = Math.min(28, groupW * 0.28);
  years.forEach((yr, i) => {
    const cx = m.left + (i + 0.5) * groupW;
    const f = d.thresholds[i].frost_days, h = d.thresholds[i].hot_days;
    [[f, "var(--min)", -bw - 1], [h, "var(--max)", 1]].forEach(([v, color, off]) => {
      const rect = document.createElementNS(NS, "rect");
      const yy = m.top + ih - (v / hi) * ih;
      rect.setAttribute("x", cx + off);
      rect.setAttribute("y", yy);
      rect.setAttribute("width", bw);
      rect.setAttribute("height", m.top + ih - yy);
      rect.setAttribute("rx", "3");
      rect.setAttribute("fill", color);
      svg.appendChild(rect);
      text(svg, cx + off + bw / 2, yy - 5, v, "axis-text", "middle");
    });
    text(svg, cx, H - 8, yr, "axis-text", "middle");
  });
  host.appendChild(svg);
}

// ==========================================================================
// RECHERCHE
// ==========================================================================
// Recherche côté client (mode statique) — port de stats.search()
const MONTHS_FR = { janvier:"01", février:"02", fevrier:"02", mars:"03", avril:"04", mai:"05",
  juin:"06", juillet:"07", août:"08", aout:"08", septembre:"09", octobre:"10", novembre:"11", décembre:"12", decembre:"12" };
const _dailyCache = {};
async function loadDaily(dev) {
  if (_dailyCache[dev]) return _dailyCache[dev];
  const res = await fetch(`data/daily/${sid(dev)}.json`);
  const rows = await res.json();
  _dailyCache[dev] = rows;
  return rows;
}
function searchStatic(rows, query) {
  const q = (query || "").toLowerCase().trim();
  const out = { query, type: null, rows: [] };
  const monthsRe = Object.keys(MONTHS_FR).join("|");
  const m = q.match(new RegExp("(\\d{1,2})\\s+(" + monthsRe + ")"));
  const withRange = (r) => ({ ...r, range: (r.tmax != null && r.tmin != null) ? Math.round((r.tmax - r.tmin) * 10) / 10 : null });
  if (m && (q.includes("compar") || q.includes("tous les") || q.includes("les " + m[0]))) {
    const key = MONTHS_FR[m[2]] + "-" + String(parseInt(m[1], 10)).padStart(2, "0");
    out.type = "same_date";
    out.label = `Les ${parseInt(m[1], 10)} ${m[2]} de chaque année`;
    out.rows = rows.filter((r) => r.day.slice(5) === key).sort((a, b) => a.day < b.day ? -1 : 1);
    return out;
  }
  const ym = q.match(/(20\d\d)/);
  const yf = ym ? ym[1] : null;
  const byYear = (r) => !yf || r.day.slice(0, 4) === yf;
  const suffix = yf ? ` en ${yf}` : " (tous relevés)";
  const top = (field, label, asc) => {
    out.type = "top_days"; out.label = label + suffix;
    out.rows = rows.filter((r) => byYear(r) && r[field] != null)
      .sort((a, b) => asc ? a[field] - b[field] : b[field] - a[field]).slice(0, 10);
  };
  if (q.includes("chaud")) top("tmax", "Jours les plus chauds", false);
  else if (q.includes("froid")) top("tmin", "Jours les plus froids", true);
  else if (q.includes("pluie") || q.includes("pluvieux") || q.includes("arros")) top("rain", "Jours les plus pluvieux", false);
  else if (q.includes("vent") || q.includes("rafale")) top("gust_max", "Jours les plus venteux (rafale max)", false);
  else if (q.includes("amplitude") || q.includes("ecart") || q.includes("écart")) {
    out.type = "top_days"; out.label = "Plus grosses amplitudes jour" + (yf ? ` en ${yf}` : "");
    out.rows = rows.filter((r) => byYear(r) && r.tmin != null && r.tmax != null)
      .map(withRange).sort((a, b) => b.range - a.range).slice(0, 10);
  } else if (m && yf) {
    const day = `${yf}-${MONTHS_FR[m[2]]}-${String(parseInt(m[1], 10)).padStart(2, "0")}`;
    out.type = "single_day"; out.label = `Le ${parseInt(m[1], 10)} ${m[2]} ${yf}`;
    out.rows = rows.filter((r) => r.day === day).slice(0, 1);
  } else {
    out.type = "help";
    out.label = "Je n'ai pas compris. Essaie : « jour le plus chaud », « les plus froids en 2023 », « compare les 12 juin », « jours les plus pluvieux », « plus grosses amplitudes »…";
  }
  return out;
}

async function doSearch(q) {
  const host = $("search-results");
  host.innerHTML = "<p class='loading'>Recherche…</p>";
  try {
    let data;
    if (STATIC) {
      const rows = await loadDaily(currentStation);
      data = searchStatic(rows, q);
    } else {
      const res = await fetch(apiUrl("/api/search", "q=" + encodeURIComponent(q)));
      data = await res.json();
      if (!res.ok || data.error) {
        host.innerHTML = `<div class="panel">${escapeHtml(data.error || "Erreur")}</div>`;
        return;
      }
    }
    if (data.type === "help" || !data.rows.length) {
      host.innerHTML = `<div class="panel">${escapeHtml(data.label || "Aucun résultat.")}</div>`;
      return;
    }
    let html = `<div class="result-label">${escapeHtml(data.label)}</div>
      <div class="table-wrap"><table class="data"><thead>
      <tr><th>Date</th><th>Moy</th><th>Min</th><th>Max</th><th>Pluie</th><th>Vent</th><th>Rafale</th><th>Direction</th></tr>
      </thead><tbody>`;
    data.rows.forEach((r) => {
      html += `<tr><td>${fmtDay(r.day)}</td><td>${fmt(r.tavg)}°</td>
        <td class="neg">${fmt(r.tmin)}°</td><td class="pos">${fmt(r.tmax)}°</td>
        <td>${r.rain !== null && r.rain !== undefined ? fmt(r.rain) + " mm" : "·"}</td>
        <td>${r.wind_avg !== null && r.wind_avg !== undefined ? fmt(r.wind_avg, 0) + " km/h" : "·"}</td>
        <td>${r.gust_max !== null && r.gust_max !== undefined ? fmt(r.gust_max, 0) + " km/h" : "·"}</td>
        <td>${r.wind_angle !== null && r.wind_angle !== undefined ? windCardinal(r.wind_angle) + (isNorth(r.wind_angle) ? " ❄️" : "") : "·"}</td></tr>`;
    });
    html += "</tbody></table></div>";
    host.innerHTML = html;
  } catch (e) {
    host.innerHTML = `<div class="panel">Erreur : ${escapeHtml(e.message)}</div>`;
  }
}
$("search-go").addEventListener("click", () => doSearch($("search-input").value));
$("search-input").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(e.target.value); });
document.querySelector(".search-hints").addEventListener("click", (e) => {
  const b = e.target.closest(".hint"); if (!b) return;
  $("search-input").value = b.textContent;
  doSearch(b.textContent);
});

// ==========================================================================
// VUE D'ENSEMBLE (live)
// ==========================================================================
async function loadDashboard() {
  try {
    const res = await smartFetch("/api/dashboard" + deviceParam());
    const data = await res.json();
    if (!res.ok || data.error) return handleError(data.error || `Erreur ${res.status}`);
    hideBanner();
    render(data);
  } catch (e) {
    handleError("Serveur injoignable — le backend Python tourne-t-il ? (" + e.message + ")");
  }
}
function handleError(msg) {
  const setup = /\.env|manquante|introuvable|OAuth|token|invalid/i.test(msg);
  if (setup) {
    showBanner("🔧 <b>Configuration requise.</b> " + escapeHtml(msg) +
      "<br>Renseigne tes clés dans le fichier <code>.env</code> (voir le README), puis clique sur ↻.");
  } else {
    showBanner("⚠️ " + escapeHtml(msg));
  }
  $("updated").textContent = "Erreur de chargement";
}

function render(d) {
  lastDashboard = d;
  $("station-name").textContent = (d.station_name || "Climat").replace(/\s*\([^)]*\)\s*$/, "");
  $("updated").textContent = d.updated_at ? "Mis à jour à " + fmtTime(d.updated_at) : "";

  const c = d.current || {};
  const o = c.outdoor || {};
  $("out-temp").textContent = fmt(o.temp);
  $("out-hum").textContent = fmt(o.humidity, 0);
  $("out-trend").textContent = trendArrow(o.trend);

  const w = c.wind;
  const windTile = $("tile-wind");
  if (w && w.strength !== null && w.strength !== undefined) {
    windTile.style.display = "";
    $("wind-str").textContent = fmt(w.strength, 0);
    $("wind-gust").textContent = fmt(w.gust, 0);
    $("wind-max").textContent = fmt(w.max_today, 0);
    $("wind-dir").textContent = windCardinal(w.angle);
    if (w.angle !== null && w.angle !== undefined) {
      $("needle").setAttribute("transform", `rotate(${w.angle} 50 50)`);
    }
  } else windTile.style.display = "none";

  const r = c.rain;
  const rainTile = $("tile-rain");
  if (r && ((r.day !== null && r.day !== undefined) || (r.hour !== null && r.hour !== undefined))) {
    rainTile.style.display = "";
    $("rain-day").textContent = fmt(r.day, 1);
    $("rain-hour").textContent = fmt(r.hour, 1);
  } else rainTile.style.display = "none";

  const i = c.indoor || {};
  $("in-temp").textContent = fmt(i.temp);
  $("in-hum").textContent = fmt(i.humidity, 0);
  $("in-co2").textContent = fmt(i.co2, 0);
  $("in-pres").textContent = fmt(i.pressure, 0);

  $("d-min").textContent = fmt(o.min_today);
  $("d-max").textContent = fmt(o.max_today);
  $("d-min-t").textContent = fmtTime(o.min_today_ts);
  $("d-max-t").textContent = fmtTime(o.max_today_ts);

  const hm = (d.history && d.history.month) || {};
  $("m-min").textContent = fmt(hm.min_temp);
  $("m-max").textContent = fmt(hm.max_temp);
  $("m-min-t").textContent = fmtDate(hm.min_ts);
  $("m-max-t").textContent = fmtDate(hm.max_ts);

  const hy = (d.history && d.history.year) || {};
  $("y-min").textContent = fmt(hy.min_temp);
  $("y-max").textContent = fmt(hy.max_temp);
  $("y-min-t").textContent = fmtDate(hy.min_ts);
  $("y-max-t").textContent = fmtDate(hy.max_ts);
}

// ---------- Graphe vue d'ensemble ----------
let currentDays = 30;
let lastSeries = null;

async function loadSeries(days) {
  currentDays = days;
  try {
    const sep = deviceParam() ? "&" : "?";
    const res = await smartFetch("/api/series" + deviceParam() + sep + "days=" + days);
    const data = await res.json();
    if (!res.ok || data.error) {
      $("chart").innerHTML = "<p class='loading'>Graphe indisponible.</p>";
      return;
    }
    lastSeries = data;
    drawChart(data);
  } catch (e) { /* silencieux */ }
}

function drawChart(s) {
  const chart = $("chart");
  chart.innerHTML = "";
  const days = s.days || [];
  if (!days.length) {
    chart.innerHTML = "<p class='loading'>Pas encore de données historiques.</p>";
    return;
  }
  const W = 1000, H = 340;
  const m = { top: 16, right: 16, bottom: 28, left: 36 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const mins = s.min_temp || [], maxs = s.max_temp || [], rains = s.rain || [];
  const temps = mins.concat(maxs).filter((v) => v !== null && v !== undefined);
  let lo = Math.min.apply(null, temps), hi = Math.max.apply(null, temps);
  if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 30; }
  const pad = Math.max(1, (hi - lo) * 0.1);
  lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
  const n = days.length;
  const x = (i) => m.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => m.top + ih - ((v - lo) / (hi - lo)) * ih;
  const maxRain = Math.max(1, Math.max.apply(null, rains.filter((v) => v != null).concat([0])));
  const barW = Math.max(1, (iw / n) * 0.6);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  for (let t = 0; t <= 4; t++) {
    const val = lo + ((hi - lo) * t) / 4;
    line(svg, m.left, y(val), W - m.right, y(val), "gridline");
    text(svg, m.left - 8, y(val) + 4, Math.round(val) + "°", "axis-text", "end");
  }
  rains.forEach((rv, i) => {
    if (rv == null || rv <= 0) return;
    const bh = (rv / maxRain) * (ih * 0.35);
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", x(i) - barW / 2);
    rect.setAttribute("y", m.top + ih - bh);
    rect.setAttribute("width", barW);
    rect.setAttribute("height", bh);
    rect.setAttribute("rx", "1.5");
    rect.setAttribute("class", "rain-bar");
    svg.appendChild(rect);
  });
  let bandTop = "", bandBot = "";
  for (let i = 0; i < n; i++) { if (maxs[i] != null) bandTop += `${x(i)},${y(maxs[i])} `; }
  for (let i = n - 1; i >= 0; i--) { if (mins[i] != null) bandBot += `${x(i)},${y(mins[i])} `; }
  if (bandTop && bandBot) {
    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("points", bandTop + bandBot);
    poly.setAttribute("class", "band");
    svg.appendChild(poly);
  }
  path(svg, maxs, x, y, "line-max");
  path(svg, mins, x, y, "line-min");
  const step = Math.max(1, Math.ceil(n / 6));
  for (let i = 0; i < n; i += step) {
    text(svg, x(i), H - 8, fmtDate(new Date(days[i]).getTime() / 1000), "axis-text", "middle");
  }
  const cross = line(svg, 0, m.top, 0, m.top + ih, "crosshair");
  cross.style.opacity = "0";
  const dotMax = circle(svg, 0, 0, 4, "hover-dot"); dotMax.setAttribute("fill", "var(--max)"); dotMax.style.opacity = "0";
  const dotMin = circle(svg, 0, 0, 4, "hover-dot"); dotMin.setAttribute("fill", "var(--min)"); dotMin.style.opacity = "0";
  const tip = document.createElement("div");
  tip.className = "tooltip";
  chart.appendChild(tip);
  const overlay = document.createElementNS(NS, "rect");
  overlay.setAttribute("x", m.left); overlay.setAttribute("y", m.top);
  overlay.setAttribute("width", iw); overlay.setAttribute("height", ih);
  overlay.setAttribute("fill", "transparent");
  svg.appendChild(overlay);
  overlay.addEventListener("mousemove", (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    let i = Math.round(((px - m.left) / iw) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    const xx = x(i);
    cross.setAttribute("x1", xx); cross.setAttribute("x2", xx); cross.style.opacity = "1";
    if (maxs[i] != null) { dotMax.setAttribute("cx", xx); dotMax.setAttribute("cy", y(maxs[i])); dotMax.style.opacity = "1"; } else dotMax.style.opacity = "0";
    if (mins[i] != null) { dotMin.setAttribute("cx", xx); dotMin.setAttribute("cy", y(mins[i])); dotMin.style.opacity = "1"; } else dotMin.style.opacity = "0";
    const dstr = new Date(days[i]).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
    let html = `<b>${dstr}</b><br>Max ${fmt(maxs[i])}°C · Min ${fmt(mins[i])}°C`;
    if (rains[i] != null && rains[i] > 0) html += `<br>Pluie ${fmt(rains[i], 1)} mm`;
    tip.innerHTML = html;
    tip.style.left = (xx / W) * rect.width + "px";
    tip.style.top = (y(Math.max(maxs[i] ?? lo, mins[i] ?? lo)) / H) * rect.height + "px";
    tip.style.opacity = "1";
  });
  overlay.addEventListener("mouseleave", () => {
    cross.style.opacity = dotMax.style.opacity = dotMin.style.opacity = tip.style.opacity = "0";
  });
  chart.appendChild(svg);
}

// helpers SVG
function line(svg, x1, y1, x2, y2, cls) {
  const e = document.createElementNS(NS, "line");
  e.setAttribute("x1", x1); e.setAttribute("y1", y1);
  e.setAttribute("x2", x2); e.setAttribute("y2", y2);
  e.setAttribute("class", cls); svg.appendChild(e); return e;
}
function text(svg, x, y, str, cls, anchor) {
  const e = document.createElementNS(NS, "text");
  e.setAttribute("x", x); e.setAttribute("y", y);
  e.setAttribute("class", cls); if (anchor) e.setAttribute("text-anchor", anchor);
  e.textContent = str; svg.appendChild(e); return e;
}
function circle(svg, cx, cy, r, cls) {
  const e = document.createElementNS(NS, "circle");
  e.setAttribute("cx", cx); e.setAttribute("cy", cy); e.setAttribute("r", r);
  e.setAttribute("class", cls); svg.appendChild(e); return e;
}
function path(svg, arr, x, y, cls) {
  let d = "", started = false;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] == null) { started = false; continue; }
    d += (started ? "L" : "M") + x(i) + "," + y(arr[i]) + " ";
    started = true;
  }
  if (!d) return;
  const e = document.createElementNS(NS, "path");
  e.setAttribute("d", d); e.setAttribute("class", cls); svg.appendChild(e);
}

// ---------- Contrôles ----------
$("refresh").addEventListener("click", () => {
  invalidateTabs();
  loadDashboard();
  loadSeries(currentDays);
  const active = document.querySelector("#tabs button.active").dataset.tab;
  if (active !== "overview" && active !== "search") loadStatTab(active);
});
$("theme").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  if (lastSeries) drawChart(lastSeries);
});
$("range-btns").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  document.querySelectorAll(".range-btns button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const days = parseInt(btn.dataset.days, 10);
  const labels = { 7: "7 derniers jours", 30: "30 derniers jours", 90: "90 derniers jours", 365: "12 derniers mois" };
  $("range-label").textContent = labels[days] || days + " jours";
  loadSeries(days);
});
$("station-select").addEventListener("change", (e) => {
  currentStation = e.target.value;
  localStorage.setItem("station", currentStation);
  lastSeries = null;
  invalidateTabs();
  loadDashboard();
  loadSeries(currentDays);
  loadOverviewExtra();
  const active = document.querySelector("#tabs button.active").dataset.tab;
  if (active !== "overview" && active !== "search") loadStatTab(active);
});

// ---------- État de la base (pied de page) ----------
async function loadDbStatus() {
  try {
    const res = await smartFetch("/api/db-status");
    const d = await res.json();
    if (d.ready && currentStation && d.stations[currentStation]) {
      const s = d.stations[currentStation];
      $("db-note").textContent = `historique local : ${s.days} jours (${s.first} → ${s.last})`;
    } else if (!d.ready) {
      $("db-note").textContent = "base en cours de synchronisation…";
    } else {
      $("db-note").textContent = "outil climat perso";
    }
  } catch (e) { /* rien */ }
}

// ---------- Records récents / bascule de saison ----------
function fmtDayShort(dayStr) {
  if (!dayStr) return "—";
  const d = new Date(dayStr + "T12:00:00");
  const s = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return d.getDate() === 1 ? s.replace(/^1\b/, "1er") : s;
}
function agoLabel(days) {
  if (days === null || days === undefined) return "";
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return "il y a " + days + " j";
  const m = Math.round(days / 30);
  return "il y a " + m + " mois";
}

async function loadOverviewExtra() {
  try {
    const res = await smartFetch("/api/overview" + deviceParam());
    const d = await res.json();
    if (!res.ok || d.error) return;
    renderOverviewExtra(d);
  } catch (e) { /* silencieux */ }
}

function renderOverviewExtra(d) {
  const cold = d.focus === "cold";
  // Extrêmes récents (60 j)
  const rmin = d.recent && d.recent.min, rmax = d.recent && d.recent.max;
  $("recent-extremes").innerHTML = `
    <div class="rex rex-min">
      <div class="rex-ic">${ic("snowflake")}</div>
      <div><div class="rex-label">Mini récent</div>
        <div class="rex-val">${fmt(rmin && rmin.value)}<span class="u">°</span></div>
        <div class="rex-when">${rmin ? fmtDayShort(rmin.day) + " · " + agoLabel(rmin.days_ago) : "—"}</div></div>
    </div>
    <div class="rex rex-max">
      <div class="rex-ic">${ic("flame")}</div>
      <div><div class="rex-label">Maxi récent</div>
        <div class="rex-val">${fmt(rmax && rmax.value)}<span class="u">°</span></div>
        <div class="rex-when">${rmax ? fmtDayShort(rmax.day) + " · " + agoLabel(rmax.days_ago) : "—"}</div></div>
    </div>`;

  // Record de la saison en cours
  const sr = d.season_record;
  if (sr) {
    const since = fmtDayShort(sr.since);
    $("season-record").innerHTML =
      `<span class="sr-ic ${cold ? "cold" : "hot"}">${ic(cold ? "snowflake" : "flame")}</span>
       ${cold ? "Le plus froid" : "Le plus chaud"} depuis le ${since} :
       <b>${fmt(sr.value)}°</b> <span class="sr-when">(${fmtDayShort(sr.day)}, ${agoLabel(sr.days_ago)})</span>`;
  } else $("season-record").innerHTML = "";

  // Escalier des seuils : dernière fois franchi
  const th = d.thresholds || [];
  $("thresholds").innerHTML = th.map((t) => {
    const recent = t.days_ago !== null && t.days_ago <= 21;
    return `<div class="thr ${recent ? "thr-recent" : ""}">
      <span class="thr-chip">${t.op === "<=" ? "≤" : "≥"} ${t.value}°</span>
      <span class="thr-when">${fmtDayShort(t.day)}</span>
      <span class="thr-ago">${agoLabel(t.days_ago)}</span>
    </div>`;
  }).join("");

  // Dernière pluie (dans la tuile pluie)
  const lr = d.last_rain, host = $("last-rain");
  if (host) {
    host.innerHTML = lr
      ? `${ic("droplet")} Dernière pluie <b>${agoLabel(lr.days_ago)}</b> · ${fmtDayShort(lr.day)} · ${fmt(lr.mm)} mm`
      : "";
  }
  paintIcons(document.getElementById("tab-overview"));
}

// Tuiles cliquables → ouvrent le détail
document.getElementById("tab-overview").addEventListener("click", (e) => {
  const card = e.target.closest("[data-goto]");
  if (card) activateTab(card.dataset.goto);
});

// ---------- Démarrage ----------
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

(async function start() {
  await loadStations();
  loadDashboard();
  loadSeries(30);
  loadOverviewExtra();
  loadDbStatus();
  paintIcons(document);
})();
setInterval(loadDashboard, 5 * 60 * 1000);
