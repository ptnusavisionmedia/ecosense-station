import { Router } from "express";
import { insertReading } from "../db.js";
import { evaluateAlarmTransitions } from "../alarms.js";

export function createIngestRouter({ deviceApiKey }) {
  const router = Router();

  router.post("/ingest", (req, res) => {
    const apiKey = req.header("x-api-key");
    if (!deviceApiKey || apiKey !== deviceApiKey) {
      return res.status(401).json({ error: "API key perangkat tidak valid." });
    }

    const body = req.body ?? {};
    if (!body.deviceId || typeof body.deviceId !== "string") {
      return res.status(400).json({ error: "Field 'deviceId' wajib diisi." });
    }

    const reading = {
      deviceId: body.deviceId,
      ts: Date.now(),
      distanceCm: toNumberOrNull(body.distanceCm),
      waterHeightCm: toNumberOrNull(body.waterHeightCm),
      ph: toNumberOrNull(body.ph),
      turbidityNtu: toNumberOrNull(body.turbidityNtu),
      flowLpm: toNumberOrNull(body.flowLpm),
      volumeL: toNumberOrNull(body.volumeL),
      tempC: toNumberOrNull(body.tempC),
      rh: toNumberOrNull(body.rh),
      lowWaterAlarm: !!body.lowWaterAlarm,
      phAlarm: !!body.phAlarm,
      turbAlarm: !!body.turbAlarm,
    };

    const id = insertReading(reading);
    evaluateAlarmTransitions(reading);

    res.status(201).json({ id, ts: reading.ts });
  });

  return router;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
