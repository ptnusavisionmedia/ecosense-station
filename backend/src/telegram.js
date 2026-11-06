import TelegramBot from "node-telegram-bot-api";
import {
  addSubscriber,
  removeSubscriber,
  getSubscribers,
  getHistory,
} from "./db.js";
import { DEFAULT_DEVICE_ID } from "./config.js";

let bot = null;

// Reply keyboard permanen di bawah layar chat — memudahkan pengguna yang
// tidak terbiasa mengetik perintah "/...".
const MAIN_KEYBOARD = {
  reply_markup: {
    keyboard: [
      ["📊 Status", "📈 Histori 24 Jam"],
      ["❓ Bantuan", "🔕 Berhenti Notifikasi"],
    ],
    resize_keyboard: true,
  },
};

function fmt(v, unit = "") {
  return v === null || v === undefined || Number.isNaN(Number(v))
    ? "n/a"
    : `${Number(v).toFixed(2)}${unit}`;
}

function formatReadingMessage(reading, deviceOnline) {
  if (!reading) {
    return "Belum ada data dari perangkat sama sekali.";
  }

  const lines = [
    `*EcoSense Station* (${reading.deviceId})`,
    `Status perangkat: ${deviceOnline ? "🟢 online" : "🔴 offline"}`,
    `Waktu data: ${new Date(reading.ts).toLocaleString("id-ID")}`,
    "",
    `💧 Tinggi air: ${fmt(reading.waterHeightCm, " cm")}`,
    `🧪 pH: ${fmt(reading.ph)}`,
    `🌫️ Turbidity: ${fmt(reading.turbidityNtu, " NTU")}`,
    `🚿 Flow: ${fmt(reading.flowLpm, " L/menit")}`,
    `🪣 Volume kumulatif: ${fmt(reading.volumeL, " L")}`,
    `🌡️ Suhu: ${fmt(reading.tempC, " °C")}`,
    `☁️ Kelembapan: ${fmt(reading.rh, " %")}`,
    "",
    reading.lowWaterAlarm ? "⚠️ Alarm air rendah AKTIF" : "✅ Air rendah: normal",
    reading.phAlarm ? "⚠️ Alarm pH AKTIF" : "✅ pH: normal",
    reading.turbAlarm ? "⚠️ Alarm turbidity AKTIF" : "✅ Turbidity: normal",
  ];

  return lines.join("\n");
}

function summarize(values) {
  const nums = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)));
  if (nums.length === 0) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return { min, max, avg };
}

function formatHistoryMessage(readings) {
  if (!readings || readings.length === 0) {
    return "Belum ada data histori dalam 24 jam terakhir.";
  }

  const metrics = [
    { key: "waterHeightCm", label: "💧 Tinggi air", unit: " cm" },
    { key: "ph", label: "🧪 pH", unit: "" },
    { key: "turbidityNtu", label: "🌫️ Turbidity", unit: " NTU" },
    { key: "tempC", label: "🌡️ Suhu", unit: " °C" },
    { key: "rh", label: "☁️ Kelembapan", unit: " %" },
  ];

  const lines = [
    `*Ringkasan 24 jam terakhir* (${readings.length} pembacaan)`,
    "",
  ];

  for (const m of metrics) {
    const s = summarize(readings.map((r) => r[m.key]));
    if (!s) {
      lines.push(`${m.label}: belum ada data valid`);
      continue;
    }
    lines.push(
      `${m.label}: min ${fmt(s.min, m.unit)} · rata-rata ${fmt(s.avg, m.unit)} · maks ${fmt(s.max, m.unit)}`
    );
  }

  const alarmCount = readings.filter(
    (r) => r.lowWaterAlarm || r.phAlarm || r.turbAlarm
  ).length;
  lines.push("");
  lines.push(
    alarmCount > 0
      ? `⚠️ ${alarmCount} pembacaan dengan alarm aktif dalam periode ini.`
      : "✅ Tidak ada alarm aktif dalam periode ini."
  );

  return lines.join("\n");
}

function helpMessage() {
  return [
    "*Perintah yang tersedia:*",
    "",
    "📊 /status — lihat kondisi reservoir terkini",
    "📈 /histori — ringkasan min/rata-rata/maks 24 jam terakhir",
    "🔔 /start — mulai berlangganan notifikasi alarm",
    "🔕 /stop — berhenti menerima notifikasi alarm",
    "❓ /bantuan — tampilkan pesan ini",
    "",
    "Tombol di bawah chat juga bisa dipakai, tidak perlu mengetik perintah.",
  ].join("\n");
}

export function initTelegramBot({ token, getLatestReadingFn, isDeviceOnlineFn }) {
  if (!token) {
    console.warn(
      "[telegram] TELEGRAM_BOT_TOKEN kosong — bot Telegram tidak diaktifkan."
    );
    return null;
  }

  bot = new TelegramBot(token, { polling: true });

  function sendStatus(chatId) {
    const reading = getLatestReadingFn();
    const online = isDeviceOnlineFn(reading);
    bot.sendMessage(chatId, formatReadingMessage(reading, online), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 Refresh", callback_data: "status" },
            { text: "📈 Histori 24 Jam", callback_data: "history" },
          ],
        ],
      },
    });
  }

  function sendHistory(chatId) {
    const to = Date.now();
    const from = to - 24 * 60 * 60 * 1000;
    const readings = getHistory({
      deviceId: DEFAULT_DEVICE_ID,
      from,
      to,
      limit: 5000,
    });
    bot.sendMessage(chatId, formatHistoryMessage(readings), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "📊 Status Sekarang", callback_data: "status" }]],
      },
    });
  }

  bot.onText(/^\/start/, (msg) => {
    addSubscriber(msg.chat.id);
    bot.sendMessage(
      msg.chat.id,
      [
        "Halo! 👋 Kamu sekarang berlangganan notifikasi *EcoSense Station*.",
        "Kamu akan otomatis dikirimi pesan kalau ada alarm (air rendah, pH, atau turbidity di luar ambang).",
        "",
        helpMessage(),
      ].join("\n"),
      { parse_mode: "Markdown", ...MAIN_KEYBOARD }
    );
  });

  bot.onText(/^\/(stop|bantuan|help|histori|history|status)/, (msg, match) => {
    const cmd = match[1];
    if (cmd === "stop") {
      removeSubscriber(msg.chat.id);
      bot.sendMessage(
        msg.chat.id,
        "Kamu sudah berhenti berlangganan notifikasi alarm. Kirim /start lagi kalau mau aktif kembali.",
        MAIN_KEYBOARD
      );
      return;
    }
    if (cmd === "bantuan" || cmd === "help") {
      bot.sendMessage(msg.chat.id, helpMessage(), { parse_mode: "Markdown", ...MAIN_KEYBOARD });
      return;
    }
    if (cmd === "histori" || cmd === "history") {
      sendHistory(msg.chat.id);
      return;
    }
    if (cmd === "status") {
      sendStatus(msg.chat.id);
      return;
    }
  });

  // Tombol reply keyboard (teks biasa, bukan "/command") supaya pengguna
  // awam cukup tap tombol di bawah chat tanpa mengetik.
  bot.on("message", (msg) => {
    const text = (msg.text || "").trim();
    if (text === "📊 Status") sendStatus(msg.chat.id);
    else if (text === "📈 Histori 24 Jam") sendHistory(msg.chat.id);
    else if (text === "❓ Bantuan")
      bot.sendMessage(msg.chat.id, helpMessage(), { parse_mode: "Markdown", ...MAIN_KEYBOARD });
    else if (text === "🔕 Berhenti Notifikasi") {
      removeSubscriber(msg.chat.id);
      bot.sendMessage(
        msg.chat.id,
        "Kamu sudah berhenti berlangganan notifikasi alarm. Kirim /start lagi kalau mau aktif kembali.",
        MAIN_KEYBOARD
      );
    }
  });

  // Tombol inline (di bawah pesan /status dan /histori).
  bot.on("callback_query", (query) => {
    const chatId = query.message.chat.id;
    if (query.data === "status") sendStatus(chatId);
    else if (query.data === "history") sendHistory(chatId);
    bot.answerCallbackQuery(query.id).catch(() => {});
  });

  bot.on("polling_error", (err) => {
    console.error("[telegram] polling_error:", err.message);
  });

  console.log("[telegram] Bot aktif (polling mode, menu interaktif siap).");
  return bot;
}

export function broadcastToSubscribers(text) {
  if (!bot) return;
  const subscribers = getSubscribers();
  for (const chatId of subscribers) {
    bot
      .sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "📊 Lihat Status", callback_data: "status" }]],
        },
      })
      .catch((err) => {
        console.error(`[telegram] gagal kirim ke ${chatId}:`, err.message);
      });
  }
}

export { formatReadingMessage, formatHistoryMessage };
