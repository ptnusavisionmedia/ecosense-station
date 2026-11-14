import { Router } from "express";
import {
  getUserByUsername,
  verifyPassword,
  createSession,
  updateUserPassword,
  deleteSessionsForUser,
} from "../db.js";
import { setSessionCookie, currentUser, logout, requireAuth, getSessionToken } from "../auth.js";

// Lockout brute-force sederhana di memori (per IP): cukup untuk dashboard
// kecil yang sekarang bisa diakses publik lewat Tailscale Funnel, tanpa
// perlu dependency/tabel tambahan. Reset otomatis lewat TTL, bukan dihapus
// aktif, supaya tidak perlu interval terpisah.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;
const loginAttempts = new Map(); // ip -> { count, firstAttemptAt }

function isLockedOut(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAttemptAt > LOGIN_LOCKOUT_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() - entry.firstAttemptAt > LOGIN_LOCKOUT_MS) {
    loginAttempts.set(ip, { count: 1, firstAttemptAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

export function createAuthRouter() {
  const router = Router();

  router.post("/auth/login", (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password wajib diisi." });
    }

    const ip = req.ip;
    if (isLockedOut(ip)) {
      return res.status(429).json({
        error: "Terlalu banyak percobaan login gagal. Coba lagi dalam beberapa menit.",
      });
    }

    const userRow = getUserByUsername(String(username).trim());
    if (!userRow || !verifyPassword(userRow, String(password))) {
      recordFailedAttempt(ip);
      return res.status(401).json({ error: "Username atau password salah." });
    }

    clearAttempts(ip);
    const { token } = createSession(userRow.id);
    setSessionCookie(res, token, req.secure);
    res.json({ id: userRow.id, username: userRow.username, role: userRow.role });
  });

  router.post("/auth/logout", logout);

  router.get("/auth/me", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: "Belum login." });
    res.json(user);
  });

  router.put("/auth/password", requireAuth, (req, res) => {
    const { password } = req.body ?? {};
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: "Password minimal 6 karakter." });
    }
    updateUserPassword(req.user.id, String(password));
    // Cabut semua sesi lain milik akun ini (mis. kalau cookie pernah
    // bocor) — kecuali sesi yang sedang dipakai untuk request ini, supaya
    // pengguna yang baru ganti password tidak ikut ter-logout.
    deleteSessionsForUser(req.user.id, getSessionToken(req));
    res.json({ ok: true });
  });

  return router;
}
