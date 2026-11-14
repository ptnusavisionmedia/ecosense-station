import { Router } from "express";
import {
  listUsers,
  createUser,
  getUserById,
  updateUserRole,
  updateUserPassword,
  deleteUser,
  countAdmins,
  getUserByUsername,
} from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

export function createUsersRouter() {
  const router = Router();

  router.use(requireAuth, requireRole("admin"));

  router.get("/", (req, res) => {
    res.json(listUsers());
  });

  router.post("/", (req, res) => {
    const { username, password, role } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password wajib diisi." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Password minimal 6 karakter." });
    }
    const normalizedRole = role === "admin" ? "admin" : "viewer";
    if (getUserByUsername(String(username).trim())) {
      return res.status(409).json({ error: "Username sudah dipakai." });
    }
    try {
      const user = createUser(String(username).trim(), String(password), normalizedRole);
      res.status(201).json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put("/:id", (req, res) => {
    const id = Number(req.params.id);
    const target = getUserById(id);
    if (!target) return res.status(404).json({ error: "User tidak ditemukan." });

    const { role, password } = req.body ?? {};
    if (role && role !== target.role) {
      if (target.role === "admin" && role !== "admin" && countAdmins() <= 1) {
        return res.status(400).json({ error: "Tidak bisa menghapus admin terakhir." });
      }
      try {
        updateUserRole(id, role);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ error: "Password minimal 6 karakter." });
      }
      updateUserPassword(id, String(password));
    }
    res.json(getUserById(id));
  });

  router.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    const target = getUserById(id);
    if (!target) return res.status(404).json({ error: "User tidak ditemukan." });
    if (target.id === req.user.id) {
      return res.status(400).json({ error: "Tidak bisa menghapus akun yang sedang digunakan." });
    }
    if (target.role === "admin" && countAdmins() <= 1) {
      return res.status(400).json({ error: "Tidak bisa menghapus admin terakhir." });
    }
    deleteUser(id);
    res.json({ ok: true });
  });

  return router;
}
