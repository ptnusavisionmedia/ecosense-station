import { Router } from "express";
import { getLatestReading } from "../db.js";
import { DEFAULT_DEVICE_ID } from "../config.js";

export function createStatusRouter({ offlineMinutes }) {
  const router = Router();

  function isOnline(reading) {
    if (!reading) return false;
    const ageMs = Date.now() - reading.ts;
    return ageMs <= offlineMinutes * 60 * 1000;
  }

  router.get("/latest", (req, res) => {
    const deviceId = req.query.deviceId || DEFAULT_DEVICE_ID;
    const reading = getLatestReading(deviceId);
    res.json({
      reading: reading ?? null,
      online: isOnline(reading),
    });
  });

  router.get("/status", (req, res) => {
    const deviceId = req.query.deviceId || DEFAULT_DEVICE_ID;
    const reading = getLatestReading(deviceId);
    res.json({
      deviceId,
      online: isOnline(reading),
      lastSeenTs: reading ? reading.ts : null,
      alarms: {
        lowWaterAlarm: !!reading?.lowWaterAlarm,
        phAlarm: !!reading?.phAlarm,
        turbAlarm: !!reading?.turbAlarm,
      },
    });
  });

  return router;
}

export function makeOnlineChecker(offlineMinutes) {
  return (reading) => {
    if (!reading) return false;
    const ageMs = Date.now() - reading.ts;
    return ageMs <= offlineMinutes * 60 * 1000;
  };
}
