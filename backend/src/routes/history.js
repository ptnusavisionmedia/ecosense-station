import { Router } from "express";
import { getHistory } from "../db.js";
import { DEFAULT_DEVICE_ID } from "../config.js";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 5000;
const DEFAULT_RANGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

export function createHistoryRouter() {
  const router = Router();

  router.get("/history", (req, res) => {
    const deviceId = req.query.deviceId || DEFAULT_DEVICE_ID;

    const now = Date.now();
    const to = parseTimestamp(req.query.to) ?? now;
    const from = parseTimestamp(req.query.from) ?? to - DEFAULT_RANGE_MS;

    let limit = Number.parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
    limit = Math.min(limit, MAX_LIMIT);

    if (from > to) {
      return res.status(400).json({
        error: "Parameter 'from' tidak boleh setelah 'to'.",
      });
    }

    const rows = getHistory({ deviceId, from, to, limit });
    res.json({ deviceId, from, to, count: rows.length, readings: rows });
  });

  return router;
}

function parseTimestamp(value) {
  if (!value) return null;
  // Terima epoch ms atau string tanggal ISO (mis. "2026-10-01").
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && String(value).trim() !== "") {
    return asNumber;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
