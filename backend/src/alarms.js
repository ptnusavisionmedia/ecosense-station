// Deteksi transisi alarm (false->true / true->false) antar-reading supaya
// notifikasi Telegram hanya dikirim sekali per perubahan status, bukan
// berulang-ulang selama kondisi tetap sama (lihat FR-06 di PRD).

import { broadcastToSubscribers } from "./telegram.js";

let lastAlarmState = {
  lowWaterAlarm: false,
  phAlarm: false,
  turbAlarm: false,
};
let hasSeenFirstReading = false;

const ALARM_LABELS = {
  lowWaterAlarm: "Air rendah",
  phAlarm: "pH di luar ambang",
  turbAlarm: "Turbidity di luar ambang",
};

export function evaluateAlarmTransitions(reading) {
  // Reading pertama hanya dipakai sebagai baseline, tidak memicu notifikasi,
  // supaya restart backend tidak langsung mengirim notifikasi palsu.
  if (!hasSeenFirstReading) {
    hasSeenFirstReading = true;
    lastAlarmState = {
      lowWaterAlarm: !!reading.lowWaterAlarm,
      phAlarm: !!reading.phAlarm,
      turbAlarm: !!reading.turbAlarm,
    };
    return;
  }

  for (const key of Object.keys(ALARM_LABELS)) {
    const prev = lastAlarmState[key];
    const curr = !!reading[key];
    if (prev !== curr) {
      const label = ALARM_LABELS[key];
      const text = curr
        ? `⚠️ *${label}* baru saja AKTIF pada ${reading.deviceId}.`
        : `✅ *${label}* sudah PULIH pada ${reading.deviceId}.`;
      broadcastToSubscribers(text);
    }
    lastAlarmState[key] = curr;
  }
}

let wasOffline = false;

export function evaluateOfflineTransition(isOnline, deviceId) {
  if (!isOnline && !wasOffline) {
    broadcastToSubscribers(
      `🔴 Perangkat *${deviceId}* berhenti mengirim data (kemungkinan offline).`
    );
  }
  if (isOnline && wasOffline) {
    broadcastToSubscribers(`🟢 Perangkat *${deviceId}* kembali online.`);
  }
  wasOffline = !isOnline;
}
