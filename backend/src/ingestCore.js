import { insertReading } from "./db.js";
import { evaluateAlarmTransitions } from "./alarms.js";
import { getThresholds } from "./config.js";

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Alarm dihitung ulang di server dari ambang batas yang tersimpan
// (bisa diubah admin lewat PUT /api/config/thresholds), bukan dipercaya
// mentah-mentah dari flag yang dikirim perangkat — supaya mengubah
// threshold di dashboard benar-benar berpengaruh ke notifikasi, dan
// perangkat tidak bisa membungkam/memalsukan alarm lewat flag sendiri.
// Flag dari perangkat hanya dipakai sebagai fallback kalau sensor terkait
// tidak mengirim nilai numerik sama sekali.
function computeAlarms(reading, body) {
  const t = getThresholds();

  const lowWaterAlarm =
    reading.waterHeightCm !== null ? reading.waterHeightCm < t.lowWaterCm : !!body.lowWaterAlarm;
  const phAlarm =
    reading.ph !== null ? reading.ph < t.phMin || reading.ph > t.phMax : !!body.phAlarm;
  const turbAlarm =
    reading.turbidityNtu !== null ? reading.turbidityNtu > t.turbidityMaxNtu : !!body.turbAlarm;

  return { lowWaterAlarm, phAlarm, turbAlarm };
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
    ...computeAlarms(
      {
        waterHeightCm: toNumberOrNull(body.waterHeightCm),
        ph: toNumberOrNull(body.ph),
        turbidityNtu: toNumberOrNull(body.turbidityNtu),
      },
      body
    ),
  };

  const id = insertReading(reading);
  evaluateAlarmTransitions(reading);

  return { id, reading };
}
