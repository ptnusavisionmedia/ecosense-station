import { Router } from "express";
import { processIngestBody } from "../ingestCore.js";

export function createIngestRouter({ deviceApiKey }) {
  const router = Router();

  router.post("/ingest", (req, res) => {
    const apiKey = req.header("x-api-key");
    if (!deviceApiKey || apiKey !== deviceApiKey) {
      return res.status(401).json({ error: "API key perangkat tidak valid." });
    }

    try {
      const { id, reading } = processIngestBody(req.body ?? {});
      res.status(201).json({ id, ts: reading.ts });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
