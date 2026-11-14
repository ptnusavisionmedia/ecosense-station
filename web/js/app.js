// EcoSense Station dashboard — vanilla JS, polling-based, multi-section
// (Home / Monitoring / Data / Peringatan / Account / Settings).

import { icon } from "./icons.js";

const DEFAULT_POLL_MS = 10000;
const POLL_STORAGE_KEY = "ecosense.pollIntervalMs";

const METRICS = [
  { key: "waterHeightCm", label: "Tinggi Air", unit: "cm", icon: "droplet", alarmKey: "lowWaterAlarm", digits: 1 },
  { key: "ph", label: "pH", unit: "", icon: "flask", alarmKey: "phAlarm", digits: 2 },
  { key: "turbidityNtu", label: "Turbidity", unit: "NTU", icon: "haze", alarmKey: "turbAlarm", digits: 1 },
  { key: "flowLpm", label: "Flow", unit: "L/menit", icon: "shower", digits: 1 },
  { key: "volumeL", label: "Volume Kumulatif", unit: "L", icon: "bucket", digits: 1 },
  { key: "tempC", label: "Suhu", unit: "°C", icon: "thermometer", digits: 1 },
  { key: "rh", label: "Kelembapan", unit: "%", icon: "wind", digits: 1 },
];

const ALARM_LABELS = {
  lowWaterAlarm: "Air rendah",
  phAlarm: "pH di luar ambang",
  turbAlarm: "Turbidity di luar ambang",
};

const WATER_TANK_MAX_CM = 100;

let pollIntervalMs = Number(localStorage.getItem(POLL_STORAGE_KEY)) || DEFAULT_POLL_MS;
let pollTimer = null;
let historyPollTimer = null;
let currentUser = null;
let charts = {};
const cardAnimState = {};

const els = {
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  viewTitle: document.getElementById("viewTitle"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  alarmBanner: document.getElementById("alarmBanner"),
  connError: document.getElementById("connError"),
  sessionAvatar: document.getElementById("sessionAvatar"),
  sessionName: document.getElementById("sessionName"),
  sessionRole: document.getElementById("sessionRole"),
  logoutBtn: document.getElementById("logoutBtn"),
};

const VIEW_TITLES = {
  home: "Home",
  monitoring: "Monitoring",
  simulasi: "Simulasi",
  data: "Data",
  peringatan: "Peringatan",
  account: "Account",
  settings: "Settings",
};

function fmt(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(digits);
}

// Field seperti deviceId (dikirim perangkat) dan username (dibuat admin)
// dirender lewat innerHTML di beberapa tabel — tanpa escape ini, nilai
// yang mengandung markup (mis. "<img onerror=...>") akan dieksekusi di
// DOM dashboard siapa pun yang membukanya.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

let redirectingToLogin = false;

async function fetchJson(path, options = {}) {
  const res = await fetch(path, { credentials: "same-origin", ...options });
  if (res.status === 401) {
    if (!redirectingToLogin) {
      redirectingToLogin = true;
      window.location.replace("login.html");
    }
    throw new Error("Belum login.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request ke ${path} gagal (${res.status}).`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ===================== Auth guard & session chrome =====================

async function loadSession() {
  currentUser = await fetchJson("/api/auth/me");
  els.sessionAvatar.textContent = currentUser.username.slice(0, 2);
  els.sessionName.textContent = currentUser.username;
  els.sessionRole.textContent = currentUser.role;
  document.body.classList.toggle("role-admin", currentUser.role === "admin");
  document.getElementById("userManagementPanel").classList.toggle("hidden", currentUser.role !== "admin");
  document.getElementById("thresholdSubmit").classList.toggle("hidden", currentUser.role !== "admin");
  document.getElementById("thresholdReadonlyNote").classList.toggle("hidden", currentUser.role === "admin");
  document
    .querySelectorAll("#thresholdForm input")
    .forEach((input) => (input.disabled = currentUser.role !== "admin"));
}

els.logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
  window.location.replace("login.html");
});

// ===================== Navigation / routing =====================

function renderNavIcons() {
  document.querySelectorAll(".nav-item[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon, { size: 18 }) + `<span>${el.textContent.trim()}</span>`;
  });
  els.logoutBtn.innerHTML = icon("logout", { size: 18 }) + `<span>Keluar</span>`;
  document.getElementById("sidebarToggle").innerHTML = icon("menu", { size: 20 });
  document.getElementById("addUserBtn").innerHTML =
    icon("plus", { size: 16 }) + `<span>Tambah pengguna</span>`;
}

function showView(name) {
  const valid = Object.keys(VIEW_TITLES).includes(name) ? name : "home";
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === valid));
  document.querySelectorAll(".nav-item[data-view]").forEach((n) =>
    n.classList.toggle("active", n.dataset.view === valid)
  );
  els.viewTitle.textContent = VIEW_TITLES[valid];
  els.sidebar.classList.remove("open");
  onViewShown(valid);
}

function onViewShown(name) {
  if ((name === "data" || name === "home") && !charts.chartWater) {
    const { from, to } = defaultDateRange();
    loadHistory(from.getTime(), to.getTime());
  }
  if (name === "peringatan") loadThresholds();
  if (name === "account") loadUsers();
  if (name === "settings") loadSettingsForm();
}

window.addEventListener("hashchange", () => showView(location.hash.slice(1)));
els.sidebarToggle.addEventListener("click", () => els.sidebar.classList.toggle("open"));

// ===================== Cards (Home + Monitoring) =====================

function buildCardsMarkup() {
  return METRICS.map(
    (m) => `
      <div class="card" data-key="${m.key}">
        <div class="card-top">
          <span class="card-icon-wrap">${icon(m.icon, { size: 18 })}</span>
          ${m.key === "waterHeightCm" ? '<div class="card-tank"><div class="card-tank-fill"></div></div>' : ""}
        </div>
        <div class="card-label">${m.label}</div>
        <div class="card-value-row"><span class="card-value">—</span><span class="card-unit">${m.unit}</span></div>
      </div>`
  ).join("");
}

document.getElementById("cardsHome").innerHTML = buildCardsMarkup();
document.getElementById("cardsMonitoring").innerHTML = buildCardsMarkup();

function renderCardsInto(container, reading, alarms) {
  container.querySelectorAll(".card").forEach((card) => {
    const meta = METRICS.find((m) => m.key === card.dataset.key);
    const valueEl = card.querySelector(".card-value");
    const raw = reading ? reading[meta.key] : null;
    const hasValue = raw !== null && raw !== undefined && !Number.isNaN(Number(raw));
    const stateKey = `${container.id}:${meta.key}`;

    if (hasValue) {
      const next = Number(raw);
      const prev = cardAnimState[stateKey];
      if (prev !== undefined && prev !== next) animateValue(valueEl, prev, next, meta.digits);
      else valueEl.textContent = next.toFixed(meta.digits);
      cardAnimState[stateKey] = next;
    } else {
      valueEl.textContent = "—";
      cardAnimState[stateKey] = undefined;
    }

    card.classList.toggle("alarm", Boolean(meta.alarmKey && alarms && alarms[meta.alarmKey]));

    if (meta.key === "waterHeightCm") {
      const fillEl = card.querySelector(".card-tank-fill");
      if (fillEl) {
        const pct = hasValue ? Math.max(4, Math.min(100, (Number(raw) / WATER_TANK_MAX_CM) * 100)) : 0;
        fillEl.style.transform = `scaleY(${pct / 100})`;
      }
    }
  });
}

function animateValue(el, from, to, digits) {
  const start = performance.now();
  const duration = 500;
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = (from + (to - from) * eased).toFixed(digits);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = to.toFixed(digits);
  }
  requestAnimationFrame(step);
}

function renderRawTable(reading) {
  const tbody = document.querySelector("#rawTable tbody");
  if (!reading) {
    tbody.innerHTML = `<tr><td colspan="2">Belum ada data.</td></tr>`;
    return;
  }
  const fields = [
    "deviceId",
    "ts",
    "distanceCm",
    "waterHeightCm",
    "ph",
    "turbidityNtu",
    "flowLpm",
    "volumeL",
    "tempC",
    "rh",
  ];
  tbody.innerHTML = fields
    .map((f) => {
      let v = reading[f];
      if (f === "ts" && v) v = new Date(v).toLocaleString("id-ID");
      return `<tr><td>${escapeHtml(f)}</td><td>${v === null || v === undefined ? "—" : escapeHtml(v)}</td></tr>`;
    })
    .join("");
}

// ===================== Status / alarms =====================

function renderStatus({ online, lastSeenTs }) {
  els.statusDot.className = `dot ${online ? "online" : "offline"}`;
  const text = !lastSeenTs
    ? "Belum ada data"
    : `${online ? "Online" : "Offline"} — data terakhir ${Math.round((Date.now() - lastSeenTs) / 1000)}s lalu`;
  els.statusText.textContent = text;

  document.getElementById("monitoringDeviceStatus").textContent = online ? "Online" : "Offline";
  document.getElementById("monitoringLastSeen").textContent = lastSeenTs
    ? new Date(lastSeenTs).toLocaleString("id-ID")
    : "—";
}

function renderAlarmBanner(alarms) {
  const active = Object.entries(alarms || {}).filter(([, v]) => v);
  if (active.length === 0) {
    els.alarmBanner.classList.add("hidden");
    els.alarmBanner.textContent = "";
    return;
  }
  els.alarmBanner.textContent = active.map(([key]) => `${ALARM_LABELS[key] || key} AKTIF`).join("\n");
  els.alarmBanner.classList.remove("hidden");
}

let pollInFlight = false;

async function pollLatestAndStatus() {
  // Tanpa guard ini, kalau satu request lebih lambat dari interval poll
  // (mis. interval 5s disetel tapi backend lagi lambat >5s), request
  // berikutnya bisa mulai sebelum yang lama selesai dan hasilnya bisa
  // resolve tidak berurutan — UI sempat kembali ke angka lama.
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const [latest, status] = await Promise.all([fetchJson("/api/latest"), fetchJson("/api/status")]);
    els.connError.classList.add("hidden");
    renderCardsInto(document.getElementById("cardsHome"), latest.reading, status.alarms);
    renderCardsInto(document.getElementById("cardsMonitoring"), latest.reading, status.alarms);
    renderRawTable(latest.reading);
    renderStatus(status);
    renderAlarmBanner(status.alarms);
    renderSimulation(latest.reading, status.alarms, status);
    document.getElementById("infoDeviceId").textContent = status.deviceId || "—";
  } catch (err) {
    if (err.message !== "Belum login.") {
      console.error(err);
      els.connError.classList.remove("hidden");
      els.statusText.textContent = "Tidak terhubung";
      els.statusDot.className = "dot offline";
    }
  } finally {
    pollInFlight = false;
  }
}

// ===================== Simulasi (live visual tank) =====================

function renderSimulation(reading, alarms, status) {
  const stage = document.getElementById("simStage");
  const note = document.getElementById("simNote");
  const online = Boolean(status && status.online);
  stage.classList.toggle("offline", !online);

  const waterCm = reading ? Number(reading.waterHeightCm) : NaN;
  const hasWater = !Number.isNaN(waterCm);
  const pct = hasWater ? Math.max(2, Math.min(100, (waterCm / WATER_TANK_MAX_CM) * 100)) : 0;
  const tankTop = 20;
  const tankHeight = 200;
  const fillHeight = (tankHeight * pct) / 100;
  const fillEl = document.getElementById("simTankFill");
  fillEl.setAttribute("y", tankTop + tankHeight - fillHeight);
  fillEl.setAttribute("height", fillHeight);

  const flowLpm = reading ? Number(reading.flowLpm) : 0;
  const flowing = Number.isFinite(flowLpm) && flowLpm > 0.05;
  const dashEl = document.getElementById("simFlowDash");
  dashEl.style.animationPlayState = flowing && online ? "running" : "paused";
  dashEl.style.animationDuration = `${Math.max(0.35, Math.min(3, 6 / Math.max(flowLpm, 0.5)))}s`;

  const anyAlarm = Boolean(alarms && (alarms.lowWaterAlarm || alarms.phAlarm || alarms.turbAlarm));
  document.getElementById("simLed").classList.toggle("alarm", anyAlarm);
  document.getElementById("simLed").classList.toggle("offline", !online);
  document.getElementById("simAlarmGroup").classList.toggle("alarm", anyAlarm);
  document.querySelector(".sim-tank-body").classList.toggle("alarm-low", Boolean(alarms && alarms.lowWaterAlarm));
  document.querySelector(".sim-probe-ph").classList.toggle("alarm", Boolean(alarms && alarms.phAlarm));
  document.querySelector(".sim-probe-turb").classList.toggle("alarm", Boolean(alarms && alarms.turbAlarm));

  document.getElementById("simWaterVal").textContent = hasWater ? `${fmt(waterCm, 1)} cm` : "—";
  document.getElementById("simPhVal").textContent = reading && reading.ph != null ? fmt(reading.ph, 2) : "—";
  document.getElementById("simTurbVal").textContent =
    reading && reading.turbidityNtu != null ? `${fmt(reading.turbidityNtu, 1)} NTU` : "—";
  document.getElementById("simFlowVal").textContent =
    reading && reading.flowLpm != null ? `${fmt(reading.flowLpm, 1)} L/menit` : "—";
  document.getElementById("simTempVal").textContent = reading && reading.tempC != null ? `${fmt(reading.tempC, 1)}°C` : "—";
  document.getElementById("simRhVal").textContent = reading && reading.rh != null ? `${fmt(reading.rh, 1)}%` : "—";

  note.textContent = !online
    ? "Perangkat offline — menampilkan data terakhir yang tercatat."
    : anyAlarm
      ? "Ada ambang batas yang terlampaui — lihat indikator yang menyala."
      : "Perangkat online, simulasi mengikuti data sensor secara langsung.";
}

// ===================== Charts (overview + data) =====================

function makeGradient(ctx, colorHex) {
  const area = ctx.chart.chartArea;
  if (!area) return `${colorHex}22`;
  const gradient = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gradient.addColorStop(0, `${colorHex}33`);
  gradient.addColorStop(1, `${colorHex}00`);
  return gradient;
}

function baseLineOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: "easeOutCubic" },
    interaction: { mode: "index", intersect: false },
    elements: { point: { radius: 0, hoverRadius: 4, hitRadius: 10 }, line: { borderWidth: 2 } },
    scales: {
      x: {
        type: "linear",
        ticks: {
          color: "#6e797a",
          font: { family: "-apple-system, Segoe UI, Roboto, sans-serif", size: 12 },
          callback: (v) => new Date(v).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
        },
        grid: { color: "#dee1e1" },
      },
      y: { ticks: { color: "#6e797a" }, grid: { color: "#dee1e1" } },
    },
    plugins: {
      legend: { labels: { color: "#273333", font: { size: 12, weight: "600" } } },
      tooltip: { titleColor: "#fff", bodyColor: "#fff", backgroundColor: "#273333" },
    },
  };
}

function ensureChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, config);
}

function points(readings, key) {
  return readings.filter((r) => r[key] !== null && r[key] !== undefined).map((r) => ({ x: r.ts, y: r[key] }));
}

function renderOverviewChart(readings) {
  ensureChart("chartOverview", {
    type: "line",
    data: {
      datasets: [
        { label: "Tinggi air (cm)", data: points(readings, "waterHeightCm"), borderColor: "#0ca750", backgroundColor: (c) => makeGradient(c, "#0ca750"), fill: true, tension: 0.3 },
        { label: "pH", data: points(readings, "ph"), borderColor: "#205bc3", tension: 0.3, yAxisID: "y1" },
        { label: "Turbidity (NTU)", data: points(readings, "turbidityNtu"), borderColor: "#dd9903", tension: 0.3, yAxisID: "y1" },
      ],
    },
    options: {
      ...baseLineOptions(),
      scales: { ...baseLineOptions().scales, y1: { position: "right", ticks: { color: "#6e797a" }, grid: { display: false } } },
    },
  });
}

function renderDataCharts(readings) {
  ensureChart("chartWater", {
    type: "line",
    data: { datasets: [{ label: "Tinggi air (cm)", data: points(readings, "waterHeightCm"), borderColor: "#0ca750", backgroundColor: (c) => makeGradient(c, "#0ca750"), fill: true, tension: 0.3 }] },
    options: baseLineOptions(),
  });

  ensureChart("chartQuality", {
    type: "line",
    data: {
      datasets: [
        { label: "pH", data: points(readings, "ph"), borderColor: "#205bc3", backgroundColor: (c) => makeGradient(c, "#205bc3"), fill: true, tension: 0.3 },
        { label: "Turbidity (NTU)", data: points(readings, "turbidityNtu"), borderColor: "#dd9903", tension: 0.3, yAxisID: "y1" },
      ],
    },
    options: { ...baseLineOptions(), scales: { ...baseLineOptions().scales, y1: { position: "right", ticks: { color: "#6e797a" }, grid: { display: false } } } },
  });

  ensureChart("chartClimate", {
    type: "line",
    data: {
      datasets: [
        { label: "Suhu (°C)", data: points(readings, "tempC"), borderColor: "#db3e3e", backgroundColor: (c) => makeGradient(c, "#db3e3e"), fill: true, tension: 0.3 },
        { label: "Kelembapan (%)", data: points(readings, "rh"), borderColor: "#ac44a8", tension: 0.3 },
      ],
    },
    options: baseLineOptions(),
  });
}

function numericValues(readings, key) {
  return readings.map((r) => r[key]).filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v))).map(Number);
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function statChip({ label, value, unit, accent }) {
  return `
    <div class="stat-chip${accent ? " stat-chip--accent" : ""}">
      <span class="stat-chip-label">${label}</span>
      <span class="stat-chip-value">${value}${unit ? `<span class="stat-chip-unit">${unit}</span>` : ""}</span>
    </div>`;
}

function renderPeriodStats(readings) {
  const container = document.getElementById("periodStats");
  const volumes = numericValues(readings, "volumeL");
  const totalVolume = volumes.length >= 2 ? volumes[volumes.length - 1] - volumes[0] : null;

  const water = numericValues(readings, "waterHeightCm");
  const ph = numericValues(readings, "ph");
  const turb = numericValues(readings, "turbidityNtu");
  const temp = numericValues(readings, "tempC");
  const rh = numericValues(readings, "rh");
  const alertCount = countAlertEvents(readings).filter((e) => e.active).length;

  const chips = [
    statChip({ label: "Total pemakaian air", value: totalVolume === null ? "—" : fmt(totalVolume, 1), unit: "L", accent: true }),
    statChip({ label: "Rata-rata tinggi air", value: fmt(average(water), 1), unit: "cm" }),
    statChip({ label: "Tinggi air min–maks", value: water.length ? `${fmt(Math.min(...water), 0)}–${fmt(Math.max(...water), 0)}` : "—", unit: "cm" }),
    statChip({ label: "Rata-rata pH", value: fmt(average(ph), 2) }),
    statChip({ label: "Rata-rata turbidity", value: fmt(average(turb), 1), unit: "NTU" }),
    statChip({ label: "Rata-rata suhu", value: fmt(average(temp), 1), unit: "°C" }),
    statChip({ label: "Rata-rata kelembapan", value: fmt(average(rh), 1), unit: "%" }),
    statChip({ label: "Peringatan aktif", value: String(alertCount) }),
    statChip({ label: "Jumlah data", value: String(readings.length) }),
  ];

  container.innerHTML = chips.join("");
}

function countAlertEvents(readings) {
  const alarmKeys = ["lowWaterAlarm", "phAlarm", "turbAlarm"];
  const events = [];
  const prevState = { lowWaterAlarm: 0, phAlarm: 0, turbAlarm: 0 };
  for (const r of readings) {
    for (const key of alarmKeys) {
      const value = r[key] ? 1 : 0;
      if (value !== prevState[key]) {
        events.push({ ts: r.ts, type: ALARM_LABELS[key], active: Boolean(value) });
        prevState[key] = value;
      }
    }
  }
  return events;
}

function renderAlertLog(readings) {
  const tbody = document.querySelector("#alertLogTable tbody");
  const empty = document.getElementById("alertLogEmpty");
  const events = countAlertEvents(readings).reverse();

  if (events.length === 0) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  tbody.innerHTML = events
    .map(
      (e) => `
      <tr>
        <td>${new Date(e.ts).toLocaleString("id-ID")}</td>
        <td>${e.type}</td>
        <td><span class="badge ${e.active ? "badge-active" : "badge-resolved"}">${e.active ? "Aktif" : "Selesai"}</span></td>
      </tr>`
    )
    .join("");
}

async function loadHistory(fromMs, toMs) {
  const filterError = document.getElementById("filterError");
  try {
    const query = new URLSearchParams({ from: String(fromMs), to: String(toMs), limit: "5000" });
    const data = await fetchJson(`/api/history?${query.toString()}`);
    renderDataCharts(data.readings);
    renderOverviewChart(data.readings.slice(-200));
    renderPeriodStats(data.readings);
    renderAlertLog(data.readings);
    filterError.classList.add("hidden");
  } catch (err) {
    if (err.message === "Belum login.") return;
    console.error(err);
    filterError.textContent = "Gagal memuat histori dari server.";
    filterError.classList.remove("hidden");
  }
}

function toEpochMs(dateStr, endOfDay = false) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(...(endOfDay ? [23, 59, 59, 999] : [0, 0, 0, 0]));
  return d.getTime();
}

function defaultDateRange(days = 7) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

function dateInputValue(d) {
  return d.toISOString().slice(0, 10);
}

function reloadHistoryFromCurrentFilter() {
  const fromMs = toEpochMs(document.getElementById("fromDate").value, false);
  const toMs = toEpochMs(document.getElementById("toDate").value, true);
  if (fromMs === null || toMs === null || fromMs > toMs) return;
  loadHistory(fromMs, toMs);
}

document.getElementById("filterForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const filterError = document.getElementById("filterError");
  const fromMs = toEpochMs(document.getElementById("fromDate").value, false);
  const toMs = toEpochMs(document.getElementById("toDate").value, true);
  if (fromMs === null || toMs === null) {
    filterError.textContent = "Isi kedua tanggal terlebih dahulu.";
    filterError.classList.remove("hidden");
    return;
  }
  if (fromMs > toMs) {
    filterError.textContent = "Tanggal 'Dari' tidak boleh setelah tanggal 'Sampai'.";
    filterError.classList.remove("hidden");
    return;
  }
  filterError.classList.add("hidden");
  loadHistory(fromMs, toMs);
});

document.querySelectorAll(".chip[data-range]").forEach((chip) => {
  chip.addEventListener("click", () => {
    const { from, to } = defaultDateRange(Number(chip.dataset.range));
    document.getElementById("fromDate").value = dateInputValue(from);
    document.getElementById("toDate").value = dateInputValue(to);
    loadHistory(from.getTime(), to.getTime());
  });
});

// ===================== Peringatan (thresholds) =====================

async function loadThresholds() {
  try {
    const t = await fetchJson("/api/config/thresholds");
    document.getElementById("thLowWaterCm").value = t.lowWaterCm;
    document.getElementById("thPhMin").value = t.phMin;
    document.getElementById("thPhMax").value = t.phMax;
    document.getElementById("thTurbidityMaxNtu").value = t.turbidityMaxNtu;
  } catch (err) {
    if (err.message !== "Belum login.") console.error(err);
  }
}

document.getElementById("thresholdForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("thresholdMsg");
  msg.classList.add("hidden");
  try {
    await fetchJson("/api/config/thresholds", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lowWaterCm: Number(document.getElementById("thLowWaterCm").value),
        phMin: Number(document.getElementById("thPhMin").value),
        phMax: Number(document.getElementById("thPhMax").value),
        turbidityMaxNtu: Number(document.getElementById("thTurbidityMaxNtu").value),
      }),
    });
    msg.textContent = "Ambang batas tersimpan.";
    msg.className = "form-note success";
    msg.classList.remove("hidden");
  } catch (err) {
    msg.textContent = err.message;
    msg.className = "form-note error";
    msg.classList.remove("hidden");
  }
});

// ===================== Account =====================

document.getElementById("selfPasswordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("selfPasswordMsg");
  msg.classList.add("hidden");
  try {
    await fetchJson("/api/auth/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: document.getElementById("selfNewPassword").value }),
    });
    document.getElementById("selfNewPassword").value = "";
    msg.textContent = "Password berhasil diganti.";
    msg.className = "form-note success";
    msg.classList.remove("hidden");
  } catch (err) {
    msg.textContent = err.message;
    msg.className = "form-note error";
    msg.classList.remove("hidden");
  }
});

async function loadUsers() {
  if (!currentUser || currentUser.role !== "admin") return;
  try {
    const users = await fetchJson("/api/users");
    const tbody = document.querySelector("#usersTable tbody");
    tbody.innerHTML = users
      .map(
        (u) => `
        <tr data-id="${u.id}">
          <td>${escapeHtml(u.username)}</td>
          <td><span class="badge ${u.role === "admin" ? "badge-admin" : "badge-viewer"}">${escapeHtml(u.role)}</span></td>
          <td>${new Date(u.createdAt).toLocaleDateString("id-ID")}</td>
          <td class="row-actions">
            <button class="icon-btn" data-action="toggle-role" title="Ganti role">${icon("edit", { size: 16 })}</button>
            <button class="icon-btn" data-action="delete" title="Hapus" ${u.id === currentUser.id ? "disabled" : ""}>${icon("trash", { size: 16 })}</button>
          </td>
        </tr>`
      )
      .join("");

    tbody.querySelectorAll('[data-action="toggle-role"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("tr");
        const id = row.dataset.id;
        const user = users.find((u) => String(u.id) === id);
        const nextRole = user.role === "admin" ? "viewer" : "admin";
        try {
          await fetchJson(`/api/users/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: nextRole }),
          });
          loadUsers();
        } catch (err) {
          alert(err.message);
        }
      });
    });

    tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("tr");
        const id = row.dataset.id;
        if (!confirm("Hapus pengguna ini?")) return;
        try {
          await fetchJson(`/api/users/${id}`, { method: "DELETE" });
          loadUsers();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (err) {
    if (err.message !== "Belum login.") console.error(err);
  }
}

const addUserForm = document.getElementById("addUserForm");
document.getElementById("addUserBtn").addEventListener("click", () => {
  addUserForm.classList.toggle("hidden");
});
document.getElementById("cancelAddUser").addEventListener("click", () => {
  addUserForm.reset();
  addUserForm.classList.add("hidden");
});

addUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("addUserMsg");
  msg.classList.add("hidden");
  try {
    await fetchJson("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.getElementById("newUsername").value.trim(),
        password: document.getElementById("newUserPassword").value,
        role: document.getElementById("newUserRole").value,
      }),
    });
    addUserForm.reset();
    addUserForm.classList.add("hidden");
    loadUsers();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = "form-note error";
    msg.classList.remove("hidden");
  }
});

// ===================== Settings =====================

function loadSettingsForm() {
  document.getElementById("pollInterval").value = String(pollIntervalMs);
}

document.getElementById("settingsForm").addEventListener("submit", (e) => {
  e.preventDefault();
  pollIntervalMs = Number(document.getElementById("pollInterval").value);
  localStorage.setItem(POLL_STORAGE_KEY, String(pollIntervalMs));
  restartPolling();
  const msg = document.getElementById("settingsMsg");
  msg.textContent = "Preferensi tersimpan.";
  msg.className = "form-note success";
  msg.classList.remove("hidden");
});

function restartPolling() {
  clearInterval(pollTimer);
  clearInterval(historyPollTimer);
  pollTimer = setInterval(pollLatestAndStatus, pollIntervalMs);
  historyPollTimer = setInterval(() => {
    if (document.querySelector('.view[data-view="data"]').classList.contains("active")) {
      reloadHistoryFromCurrentFilter();
    }
  }, pollIntervalMs);
}

// ===================== Init =====================

async function init() {
  renderNavIcons();

  try {
    await loadSession();
  } catch {
    return; // sudah di-redirect ke login oleh fetchJson
  }

  const { from, to } = defaultDateRange();
  document.getElementById("fromDate").value = dateInputValue(from);
  document.getElementById("toDate").value = dateInputValue(to);

  showView(location.hash.slice(1) || "home");
  pollLatestAndStatus();
  restartPolling();
}

init();
