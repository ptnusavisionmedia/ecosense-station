import { Router } from "express";
import { getUserByUsername, verifyPassword, createSession, updateUserPassword } from "../db.js";
import { setSessionCookie, currentUser, logout, requireAuth } from "../auth.js";

export function createAuthRouter() {
  const router = Router();

  router.post("/auth/login", (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password wajib diisi." });
    }

    const userRow = getUserByUsername(String(username).trim());
    if (!userRow || !verifyPassword(userRow, String(password))) {
      return res.status(401).json({ error: "Username atau password salah." });
    }

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
    res.json({ ok: true });
  });

  return router;
}
