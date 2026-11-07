import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

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

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    passwordSalt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL
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

// --- Users & sessions (akun admin/viewer dashboard) ---

const PUBLIC_ROLES = ["admin", "viewer"];

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

function toPublicUser(row) {
  if (!row) return null;
  return { id: row.id, username: row.username, role: row.role, createdAt: row.createdAt };
}

export function countUsers() {
  return db.prepare(`SELECT COUNT(*) AS n FROM users`).get().n;
}

export function createUser(username, password, role = "viewer") {
  if (!PUBLIC_ROLES.includes(role)) throw new Error("Role tidak valid.");
  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const stmt = db.prepare(`
    INSERT INTO users (username, passwordHash, passwordSalt, role, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(username, passwordHash, salt, role, Date.now());
  return toPublicUser(db.prepare(`SELECT * FROM users WHERE id = ?`).get(result.lastInsertRowid));
}

export function listUsers() {
  return db.prepare(`SELECT * FROM users ORDER BY createdAt ASC`).all().map(toPublicUser);
}

export function getUserById(id) {
  return toPublicUser(db.prepare(`SELECT * FROM users WHERE id = ?`).get(id));
}

export function getUserByUsername(username) {
  return db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
}

export function verifyPassword(userRow, password) {
  if (!userRow) return false;
  const candidate = hashPassword(password, userRow.passwordSalt);
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(userRow.passwordHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function updateUserRole(id, role) {
  if (!PUBLIC_ROLES.includes(role)) throw new Error("Role tidak valid.");
  db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, id);
  return getUserById(id);
}

export function updateUserPassword(id, password) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  db.prepare(`UPDATE users SET passwordHash = ?, passwordSalt = ? WHERE id = ?`).run(
    passwordHash,
    salt,
    id
  );
}

export function deleteUser(id) {
  db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  db.prepare(`DELETE FROM sessions WHERE userId = ?`).run(id);
}

export function countAdmins() {
  return db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`).get().n;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createSession(userId) {
  const token = randomUUID() + randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.prepare(`INSERT INTO sessions (token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)`).run(
    token,
    userId,
    expiresAt,
    Date.now()
  );
  return { token, expiresAt };
}

export function getSessionUser(token) {
  if (!token) return null;
  const session = db.prepare(`SELECT * FROM sessions WHERE token = ?`).get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return null;
  }
  return getUserById(session.userId);
}

export function deleteSession(token) {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}
