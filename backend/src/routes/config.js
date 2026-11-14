import { Router } from "express";
import { getThresholds, setThresholds } from "../config.js";
import { currentUser } from "../auth.js";

export function createConfigRouter({ adminApiKey }) {
  const router = Router();

  router.get("/config/thresholds", (req, res) => {
    res.json(getThresholds());
  });

  router.put("/config/thresholds", (req, res) => {
    const apiKey = req.header("x-api-key");
    const apiKeyValid = Boolean(adminApiKey) && apiKey === adminApiKey;
    const sessionUser = currentUser(req);
    const sessionValid = sessionUser && sessionUser.role === "admin";
    if (!apiKeyValid && !sessionValid) {
      return res.status(401).json({ error: "Butuh login admin atau API key admin." });
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
