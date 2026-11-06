import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { getLatestReading } from "./db.js";
import { DEFAULT_DEVICE_ID } from "./config.js";
import { createIngestRouter } from "./routes/ingest.js";
import { createStatusRouter, makeOnlineChecker } from "./routes/status.js";
import { createHistoryRouter } from "./routes/history.js";
import { createConfigRouter } from "./routes/config.js";
import { initTelegramBot } from "./telegram.js";
import { evaluateOfflineTransition } from "./alarms.js";
import { initMqttIngest } from "./mqtt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, "..", "..", "web");

const PORT = Number(process.env.PORT) || 3000;
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || "";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const OFFLINE_MINUTES = Number(process.env.DEVICE_OFFLINE_MINUTES) || 5;
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "";

if (!DEVICE_API_KEY) {
  console.warn(
    "[server] DEVICE_API_KEY belum diisi di .env — semua POST /api/ingest akan ditolak."
  );
}

const isOnline = makeOnlineChecker(OFFLINE_MINUTES);

const app = express();
app.use(cors());
app.use(express.json({ limit: "32kb" }));

app.use("/api", createIngestRouter({ deviceApiKey: DEVICE_API_KEY }));
app.use("/api", createStatusRouter({ offlineMinutes: OFFLINE_MINUTES }));
app.use("/api", createHistoryRouter());
app.use("/api", createConfigRouter({ adminApiKey: ADMIN_API_KEY }));

app.use(express.static(WEB_DIR));

app.use((err, req, res, next) => {
  console.error("[server] unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

initTelegramBot({
  token: TELEGRAM_BOT_TOKEN,
  getLatestReadingFn: () => getLatestReading(DEFAULT_DEVICE_ID),
  isDeviceOnlineFn: isOnline,
});

initMqttIngest({
  brokerUrl: MQTT_BROKER_URL,
  topic: MQTT_TOPIC,
  deviceApiKey: DEVICE_API_KEY,
});

// Cek berkala apakah perangkat berhenti mengirim data (FR-02).
setInterval(() => {
  const reading = getLatestReading(DEFAULT_DEVICE_ID);
  evaluateOfflineTransition(isOnline(reading), DEFAULT_DEVICE_ID);
}, 60 * 1000);

app.listen(PORT, () => {
  console.log(`[server] EcoSense Station backend jalan di http://localhost:${PORT}`);
});
