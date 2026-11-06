// Simulator data EcoSense Station — mengirim reading palsu secara berkala
// ke backend lokal supaya dashboard web terlihat "hidup" tanpa perangkat
// fisik atau simulasi Wokwi. HANYA untuk demo/pengembangan.
//
// Jalankan:
//   cd backend
//   node scripts/simulate-data.js
//
// Hentikan dengan Ctrl+C.

import http from "node:http";

const INGEST_URL = process.env.INGEST_URL || "http://localhost:3000/api/ingest";
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || "wokwi-sim-key";
const DEVICE_ID = process.env.DEVICE_ID || "ecosense-01";
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 5000);

const state = {
  waterHeightCm: 80,
  ph: 7.0,
  turbidityNtu: 15,
  flowLpm: 2.5,
  volumeL: 150,
  tempC: 27.0,
  rh: 65,
};

const LOW_WATER_THRESHOLD_CM = 15;

function randomWalk(value, step, min, max) {
  const next = value + (Math.random() * 2 - 1) * step;
  return Math.min(max, Math.max(min, next));
}

function tick() {
  state.waterHeightCm = randomWalk(state.waterHeightCm, 1.5, 5, 100);
  state.ph = randomWalk(state.ph, 0.05, 5.5, 8.5);
  state.turbidityNtu = randomWalk(state.turbidityNtu, 2, 0, 80);
  state.flowLpm = randomWalk(state.flowLpm, 0.3, 0, 8);
  state.volumeL += Math.max(0, state.flowLpm) * (INTERVAL_MS / 60000);
  state.tempC = randomWalk(state.tempC, 0.2, 22, 32);
  state.rh = randomWalk(state.rh, 1, 40, 90);

  const lowWaterAlarm = state.waterHeightCm <= LOW_WATER_THRESHOLD_CM;
  const phAlarm = state.ph < 6.5 || state.ph > 8.5;
  const turbAlarm = state.turbidityNtu > 50;

  const body = JSON.stringify({
    deviceId: DEVICE_ID,
    waterHeightCm: round(state.waterHeightCm),
    ph: round(state.ph, 2),
    turbidityNtu: round(state.turbidityNtu),
    flowLpm: round(state.flowLpm, 2),
    volumeL: round(state.volumeL),
    tempC: round(state.tempC, 1),
    rh: round(state.rh),
    lowWaterAlarm,
    phAlarm,
    turbAlarm,
  });

  const url = new URL(INGEST_URL);
  const req = http.request(
    {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": DEVICE_API_KEY,
        "Content-Length": Buffer.byteLength(body),
      },
    },
    (res) => {
      res.resume();
      const ts = new Date().toLocaleTimeString("id-ID");
      console.log(`[${ts}] kirim reading -> HTTP ${res.statusCode}`);
    }
  );
  req.on("error", (err) => {
    console.error("Gagal kirim reading:", err.message);
  });
  req.write(body);
  req.end();
}

function round(n, decimals = 0) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

console.log(`Simulator EcoSense Station jalan. Kirim ke ${INGEST_URL} tiap ${INTERVAL_MS / 1000}s.`);
console.log("Tekan Ctrl+C untuk berhenti.\n");
tick();
setInterval(tick, INTERVAL_MS);
