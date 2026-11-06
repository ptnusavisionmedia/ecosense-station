import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_FILE = process.env.DB_FILE || "./data/ecosense.sqlite";
mkdirSync(dirname(DB_FILE), { recursive: true });

export const db = new DatabaseSync(DB_FILE);

db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT NOT NULL,
    ts INTEGER NOT NULL,
    distanceCm REAL,
    waterHeightCm REAL,
    ph REAL,
    turbidityNtu REAL,
    flowLpm REAL,
    volumeL REAL,
    tempC REAL,
    rh REAL,
    lowWaterAlarm INTEGER NOT NULL DEFAULT 0,
    phAlarm INTEGER NOT NULL DEFAULT 0,
    turbAlarm INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings (ts);

  CREATE TABLE IF NOT EXISTS subscribers (
    chatId TEXT PRIMARY KEY,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const insertReadingStmt = db.prepare(`
  INSERT INTO readings (
    deviceId, ts, distanceCm, waterHeightCm, ph, turbidityNtu,
    flowLpm, volumeL, tempC, rh, lowWaterAlarm, phAlarm, turbAlarm
  ) VALUES (
    @deviceId, @ts, @distanceCm, @waterHeightCm, @ph, @turbidityNtu,
    @flowLpm, @volumeL, @tempC, @rh, @lowWaterAlarm, @phAlarm, @turbAlarm
  )
`);

export function insertReading(reading) {
  const result = insertReadingStmt.run({
    deviceId: reading.deviceId,
    ts: reading.ts,
    distanceCm: reading.distanceCm ?? null,
    waterHeightCm: reading.waterHeightCm ?? null,
    ph: reading.ph ?? null,
    turbidityNtu: reading.turbidityNtu ?? null,
    flowLpm: reading.flowLpm ?? null,
    volumeL: reading.volumeL ?? null,
    tempC: reading.tempC ?? null,
    rh: reading.rh ?? null,
    lowWaterAlarm: reading.lowWaterAlarm ? 1 : 0,
    phAlarm: reading.phAlarm ? 1 : 0,
    turbAlarm: reading.turbAlarm ? 1 : 0,
  });
  return result.lastInsertRowid;
}

export function getLatestReading(deviceId) {
  const stmt = db.prepare(
    `SELECT * FROM readings WHERE deviceId = ? ORDER BY ts DESC LIMIT 1`
  );
  return stmt.get(deviceId) ?? null;
}

export function getHistory({ deviceId, from, to, limit }) {
  const stmt = db.prepare(`
    SELECT * FROM readings
    WHERE deviceId = ? AND ts >= ? AND ts <= ?
    ORDER BY ts ASC
    LIMIT ?
  `);
  return stmt.all(deviceId, from, to, limit);
}

export function addSubscriber(chatId) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO subscribers (chatId, createdAt) VALUES (?, ?)`
  );
  stmt.run(String(chatId), Date.now());
}

export function removeSubscriber(chatId) {
  const stmt = db.prepare(`DELETE FROM subscribers WHERE chatId = ?`);
  stmt.run(String(chatId));
}

export function getSubscribers() {
  const stmt = db.prepare(`SELECT chatId FROM subscribers`);
  return stmt.all().map((row) => row.chatId);
}

export function getConfigValue(key, fallback) {
  const stmt = db.prepare(`SELECT value FROM config WHERE key = ?`);
  const row = stmt.get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

export function setConfigValue(key, value) {
  const stmt = db.prepare(`
    INSERT INTO config (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  stmt.run(key, JSON.stringify(value));
}
