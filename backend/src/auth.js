// Auth berbasis session cookie sederhana (tanpa dependency tambahan):
// token acak disimpan di tabel `sessions`, dikirim ke klien lewat cookie
// httpOnly `sid`. Tidak ada JWT/refresh token — cukup untuk tim kecil.

import { getSessionUser, deleteSession } from "./db.js";

const COOKIE_NAME = "sid";
const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function setSessionCookie(res, token, secure) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_S}`,
  ];
  if (secure) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

export function clearSessionCookie(res, secure) {
  const attrs = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

export function getSessionToken(req) {
  return parseCookies(req)[COOKIE_NAME] || null;
}

export function currentUser(req) {
  return getSessionUser(getSessionToken(req));
}

export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "Belum login." });
  }
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Belum login." });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Tidak punya izin untuk aksi ini." });
    }
    next();
  };
}

export function logout(req, res) {
  const token = getSessionToken(req);
  if (token) deleteSession(token);
  clearSessionCookie(res, req.secure);
  res.json({ ok: true });
}
