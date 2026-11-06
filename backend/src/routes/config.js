import { Router } from "express";
import { getThresholds, setThresholds } from "../config.js";

export function createConfigRouter({ adminApiKey }) {
  const router = Router();

  router.get("/config/thresholds", (req, res) => {
    res.json(getThresholds());
  });

  router.put("/config/thresholds", (req, res) => {
    const apiKey = req.header("x-api-key");
    if (!adminApiKey || apiKey !== adminApiKey) {
      return res.status(401).json({ error: "API key admin tidak valid." });
    }

    const body = req.body ?? {};
    const allowedKeys = ["lowWaterCm", "phMin", "phMax", "turbidityMaxNtu"];
    const partial = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        const n = Number(body[key]);
        if (!Number.isFinite(n)) {
          return res.status(400).json({ error: `Field '${key}' harus angka.` });
        }
        partial[key] = n;
      }
    }

    const next = setThresholds(partial);
    res.json(next);
  });

  return router;
}
