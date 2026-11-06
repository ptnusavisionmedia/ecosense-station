import TelegramBot from "node-telegram-bot-api";
import { addSubscriber, removeSubscriber, getSubscribers } from "./db.js";

let bot = null;

function formatReadingMessage(reading, deviceOnline) {
  if (!reading) {
    return "Belum ada data dari perangkat sama sekali.";
  }

  const fmt = (v, unit = "") =>
    v === null || v === undefined ? "n/a" : `${Number(v).toFixed(2)}${unit}`;

  const lines = [
    `*EcoSense Station* (${reading.deviceId})`,
    `Status perangkat: ${deviceOnline ? "🟢 online" : "🔴 offline"}`,
    `Waktu data: ${new Date(reading.ts).toLocaleString("id-ID")}`,
    "",
    `Tinggi air: ${fmt(reading.waterHeightCm, " cm")}`,
    `pH: ${fmt(reading.ph)}`,
    `Turbidity: ${fmt(reading.turbidityNtu, " NTU")}`,
    `Flow: ${fmt(reading.flowLpm, " L/menit")}`,
    `Volume kumulatif: ${fmt(reading.volumeL, " L")}`,
    `Suhu: ${fmt(reading.tempC, " °C")}`,
    `Kelembapan: ${fmt(reading.rh, " %")}`,
    "",
    reading.lowWaterAlarm ? "⚠️ Alarm air rendah AKTIF" : "Air rendah: normal",
    reading.phAlarm ? "⚠️ Alarm pH AKTIF" : "pH: normal",
    reading.turbAlarm ? "⚠️ Alarm turbidity AKTIF" : "Turbidity: normal",
  ];

  return lines.join("\n");
}

export function initTelegramBot({ token, getLatestReadingFn, isDeviceOnlineFn }) {
  if (!token) {
    console.warn(
      "[telegram] TELEGRAM_BOT_TOKEN kosong — bot Telegram tidak diaktifkan."
    );
    return null;
  }

  bot = new TelegramBot(token, { polling: true });

  bot.onText(/^\/start/, (msg) => {
    addSubscriber(msg.chat.id);
    bot.sendMessage(
      msg.chat.id,
      [
        "Halo! Kamu sekarang berlangganan notifikasi EcoSense Station.",
        "",
        "Perintah yang tersedia:",
        "/status — lihat kondisi reservoir terkini",
        "/stop — berhenti menerima notifikasi",
      ].join("\n")
    );
  });

  bot.onText(/^\/stop/, (msg) => {
    removeSubscriber(msg.chat.id);
    bot.sendMessage(
      msg.chat.id,
      "Kamu sudah berhenti berlangganan. Kirim /start lagi kalau mau aktif kembali."
    );
  });

  bot.onText(/^\/status/, (msg) => {
    const reading = getLatestReadingFn();
    const online = isDeviceOnlineFn(reading);
    bot.sendMessage(msg.chat.id, formatReadingMessage(reading, online), {
      parse_mode: "Markdown",
    });
  });

  bot.on("polling_error", (err) => {
    console.error("[telegram] polling_error:", err.message);
  });

  console.log("[telegram] Bot aktif (polling mode).");
  return bot;
}

export function broadcastToSubscribers(text) {
  if (!bot) return;
  const subscribers = getSubscribers();
  for (const chatId of subscribers) {
    bot.sendMessage(chatId, text, { parse_mode: "Markdown" }).catch((err) => {
      console.error(`[telegram] gagal kirim ke ${chatId}:`, err.message);
    });
  }
}

export { formatReadingMessage };
