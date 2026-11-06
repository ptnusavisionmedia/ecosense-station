// Konfigurasi runtime (bisa diubah lewat PUT /api/config/thresholds,
// tersimpan di tabel `config` di SQLite supaya persist antar-restart).

import { getConfigValue, setConfigValue } from "./db.js";

export const DEFAULT_DEVICE_ID = "ecosense-01";

const THRESHOLDS_KEY = "thresholds";

const DEFAULT_THRESHOLDS = {
  lowWaterCm: 15,
  phMin: 6.5,
  phMax: 8.5,
  turbidityMaxNtu: 50,
};

export function getThresholds() {
  return getConfigValue(THRESHOLDS_KEY, DEFAULT_THRESHOLDS);
}

export function setThresholds(partial) {
  const current = getThresholds();
  const next = { ...current, ...partial };
  setConfigValue(THRESHOLDS_KEY, next);
  return next;
}
