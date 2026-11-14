import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { getLatestReading, countUsers, createUser } from "./db.js";
import { DEFAULT_DEVICE_ID } from "./config.js";
import { createIngestRouter } from "./routes/ingest.js";
import { createStatusRouter, makeOnlineChecker } from "./routes/status.js";
import { createHistoryRouter } from "./routes/history.js";
import { createConfigRouter } from "./routes/config.js";
import { createAuthRouter } from "./routes/auth.js";
import { createUsersRouter } from "./routes/users.js";
import { requireAuth } from "./auth.js";
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
const TELEGRAM_ALLOWED_CHAT_IDS = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!DEVICE_API_KEY) {
  console.warn(
    "[server] DEVICE_API_KEY belum diisi di .env — semua POST /api/ingest akan ditolak."
  );
}

// Seed akun admin pertama kali jika tabel users masih kosong, supaya
// dashboard baru (dengan login) tidak terkunci di instalasi baru.
if (countUsers() === 0) {
  const seedUsername = process.env.ADMIN_USERNAME || "admin";
  const seedPassword = process.env.ADMIN_PASSWORD || "ecosense123";
  createUser(seedUsername, seedPassword, "admin");
  console.warn(
    `[server] Akun admin awal dibuat — username: "${seedUsername}", password: "${seedPassword}". ` +
      "Segera login dan ganti password ini (atau set ADMIN_USERNAME/ADMIN_PASSWORD di .env sebelum run pertama)."
  );
}

const isOnline = makeOnlineChecker(OFFLINE_MINUTES);

const app = express();
// Di belakang reverse proxy (Tailscale Funnel dll) koneksi masuk ke proses
// Node selalu plain HTTP; tanpa ini, req.secure selalu false dan cookie
// sesi tidak pernah dapat flag Secure walau publiknya sudah HTTPS.
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "32kb" }));

app.use("/api", createIngestRouter({ deviceApiKey: DEVICE_API_KEY }));
app.use("/api", createAuthRouter());
app.use("/api/users", createUsersRouter());
app.use("/api", requireAuth, createStatusRouter({ offlineMinutes: OFFLINE_MINUTES }));
app.use("/api", requireAuth, createHistoryRouter());
app.use("/api/config/thresholds", (req, res, next) => {
  if (req.method === "GET") return requireAuth(req, res, next);
  next();
});
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
  allowedChatIds: TELEGRAM_ALLOWED_CHAT_IDS,
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
