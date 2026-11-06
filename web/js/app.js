// EcoSense Station dashboard — vanilla JS, polling-based (lihat PRD FR-11..FR-15).

const API_BASE = ""; // sama origin (dilayani oleh backend Express yang sama)
const POLL_INTERVAL_MS = 10000;

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const alarmBanner = document.getElementById("alarmBanner");
const connError = document.getElementById("connError");
const cardsEl = document.getElementById("cards");
const filterForm = document.getElementById("filterForm");
const fromDateInput = document.getElementById("fromDate");
const toDateInput = document.getElementById("toDate");
const filterError = document.getElementById("filterError");
const volumeSummaryValue = document.getElementById("volumeSummaryValue");

const ALARM_LABELS = {
  lowWaterAlarm: "Air rendah",
  phAlarm: "pH di luar ambang",
  turbAlarm: "Turbidity di luar ambang",
};

let charts = {};

function fmt(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(digits);
}

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Request ke ${path} gagal dengan status ${res.status}`);
  }
  return res.json();
}

function renderCards(reading) {
  const cards = cardsEl.querySelectorAll(".card");
  cards.forEach((card) => {
    const key = card.dataset.key;
    const valueEl = card.querySelector(".card-value");
    valueEl.textContent = reading ? fmt(reading[key]) : "—";
  });
}

function renderStatus({ online, lastSeenTs }) {
  statusDot.className = `dot ${online ? "online" : "offline"}`;
  if (!lastSeenTs) {
    statusText.textContent = "Belum ada data";
  } else {
    const ago = Math.round((Date.now() - lastSeenTs) / 1000);
    statusText.textContent = `${online ? "Online" : "Offline"} — data terakhir ${ago}s lalu`;
  }
}

function renderAlarmBanner(alarms) {
  const active = Object.entries(alarms || {}).filter(([, v]) => v);
  if (active.length === 0) {
    alarmBanner.classList.add("hidden");
    alarmBanner.textContent = "";
    return;
  }
  const lines = active.map(([key]) => `⚠️ ${ALARM_LABELS[key] || key} AKTIF`);
  alarmBanner.textContent = lines.join("\n");
  alarmBanner.classList.remove("hidden");
}

async function pollLatestAndStatus() {
  try {
    const [latest, status] = await Promise.all([
      fetchJson("/api/latest"),
      fetchJson("/api/status"),
    ]);
    connError.classList.add("hidden");
    renderCards(latest.reading);
    renderStatus(status);
    renderAlarmBanner(status.alarms);
  } catch (err) {
    console.error(err);
    connError.classList.remove("hidden");
    statusText.textContent = "Tidak terhubung";
    statusDot.className = "dot offline";
  }
}

function toEpochMs(dateStr, endOfDay = false) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from, to };
}

function dateInputValue(d) {
  return d.toISOString().slice(0, 10);
}

function ensureChart(id, config) {
  const ctx = document.getElementById(id).getContext("2d");
  if (charts[id]) {
    charts[id].destroy();
  }
  charts[id] = new Chart(ctx, config);
}

function baseLineOptions() {
  return {
    responsive: true,
    animation: false,
    scales: {
      x: {
        type: "linear",
        ticks: {
          color: "#94a3b8",
          callback: (value) =>
            new Date(value).toLocaleString("id-ID", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }),
        },
        grid: { color: "#334155" },
      },
      y: {
        ticks: { color: "#94a3b8" },
        grid: { color: "#334155" },
      },
    },
    plugins: {
      legend: { labels: { color: "#e2e8f0" } },
      tooltip: {
        callbacks: {
          title: (items) =>
            items.length
              ? new Date(items[0].parsed.x).toLocaleString("id-ID")
              : "",
        },
      },
    },
  };
}

function renderCharts(readings) {
  const points = (key) =>
    readings
      .filter((r) => r[key] !== null && r[key] !== undefined)
      .map((r) => ({ x: r.ts, y: r[key] }));

  ensureChart("chartWater", {
    type: "line",
    data: {
      datasets: [
        {
          label: "Tinggi air (cm)",
          data: points("waterHeightCm"),
          borderColor: "#38bdf8",
          backgroundColor: "transparent",
          tension: 0.2,
        },
      ],
    },
    options: baseLineOptions(),
  });

  ensureChart("chartQuality", {
    type: "line",
    data: {
      datasets: [
        {
          label: "pH",
          data: points("ph"),
          borderColor: "#22c55e",
          backgroundColor: "transparent",
          tension: 0.2,
          yAxisID: "y",
        },
        {
          label: "Turbidity (NTU)",
          data: points("turbidityNtu"),
          borderColor: "#f59e0b",
          backgroundColor: "transparent",
          tension: 0.2,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      ...baseLineOptions(),
      scales: {
        ...baseLineOptions().scales,
        y1: {
          position: "right",
          ticks: { color: "#94a3b8" },
          grid: { display: false },
        },
      },
    },
  });

  ensureChart("chartClimate", {
    type: "line",
    data: {
      datasets: [
        {
          label: "Suhu (°C)",
          data: points("tempC"),
          borderColor: "#ef4444",
          backgroundColor: "transparent",
          tension: 0.2,
        },
        {
          label: "Kelembapan (%)",
          data: points("rh"),
          borderColor: "#a855f7",
          backgroundColor: "transparent",
          tension: 0.2,
        },
      ],
    },
    options: baseLineOptions(),
  });
}

function renderVolumeSummary(readings) {
  const volumes = readings
    .map((r) => r.volumeL)
    .filter((v) => v !== null && v !== undefined);

  if (volumes.length < 2) {
    volumeSummaryValue.textContent = "data belum cukup";
    return;
  }

  const diff = volumes[volumes.length - 1] - volumes[0];
  volumeSummaryValue.textContent = `${fmt(diff, 1)} L`;
}

async function loadHistory(fromMs, toMs) {
  try {
    const query = new URLSearchParams({
      from: String(fromMs),
      to: String(toMs),
      limit: "5000",
    });
    const data = await fetchJson(`/api/history?${query.toString()}`);
    renderCharts(data.readings);
    renderVolumeSummary(data.readings);
    filterError.classList.add("hidden");
  } catch (err) {
    console.error(err);
    filterError.textContent = "Gagal memuat histori dari server.";
    filterError.classList.remove("hidden");
  }
}

filterForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fromMs = toEpochMs(fromDateInput.value, false);
  const toMs = toEpochMs(toDateInput.value, true);

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

function init() {
  const { from, to } = defaultDateRange();
  fromDateInput.value = dateInputValue(from);
  toDateInput.value = dateInputValue(to);

  pollLatestAndStatus();
  loadHistory(from.getTime(), to.getTime());

  setInterval(pollLatestAndStatus, POLL_INTERVAL_MS);
}

init();
