import { insertReading } from "./db.js";
import { evaluateAlarmTransitions } from "./alarms.js";

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Dipakai bersama oleh route HTTP /api/ingest dan subscriber MQTT — satu
// jalur validasi + simpan + evaluasi alarm untuk kedua sumber data.
export function processIngestBody(body) {
  if (!body || !body.deviceId || typeof body.deviceId !== "string") {
    throw new Error("Field 'deviceId' wajib diisi.");
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

  return { id, reading };
}
