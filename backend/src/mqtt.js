import mqtt from "mqtt";
import { processIngestBody } from "./ingestCore.js";

// Subscriber MQTT — alternatif dari POST /api/ingest untuk perangkat yang
// tidak bisa/sulit membuka koneksi HTTP masuk ke backend (mis. simulator
// Wokwi tanpa tunnel). Backend & perangkat sama-sama hanya membuat koneksi
// KELUAR ke broker publik, jadi tidak perlu ngrok/localtunnel sama sekali.
export function initMqttIngest({ brokerUrl, topic, deviceApiKey }) {
  if (!brokerUrl || !topic) {
    console.warn("[mqtt] MQTT_BROKER_URL/MQTT_TOPIC belum diisi — subscriber MQTT tidak diaktifkan.");
    return null;
  }

  const client = mqtt.connect(brokerUrl, {
    clientId: `ecosense-backend-${Math.random().toString(16).slice(2, 10)}`,
    reconnectPeriod: 2000,
  });

  client.on("connect", () => {
    console.log(`[mqtt] Terhubung ke ${brokerUrl}, subscribe topic "${topic}"`);
    client.subscribe(topic, (err) => {
      if (err) console.error("[mqtt] Gagal subscribe:", err.message);
    });
  });

  client.on("reconnect", () => {
    console.log("[mqtt] Mencoba konek ulang ke broker...");
  });

  client.on("error", (err) => {
    console.error("[mqtt] Error koneksi:", err.message);
  });

  client.on("message", (receivedTopic, payload) => {
    if (receivedTopic !== topic) return;

    let body;
    try {
      body = JSON.parse(payload.toString("utf8"));
    } catch (err) {
      console.error("[mqtt] Payload bukan JSON valid:", err.message);
      return;
    }

    if (!deviceApiKey || body.apiKey !== deviceApiKey) {
      console.warn("[mqtt] Pesan ditolak: apiKey tidak cocok atau DEVICE_API_KEY belum diisi.");
      return;
    }

    try {
      const { id, reading } = processIngestBody(body);
      console.log(`[mqtt] Reading tersimpan (id=${id}, deviceId=${reading.deviceId}, ts=${reading.ts})`);
    } catch (err) {
      console.error("[mqtt] Gagal memproses reading:", err.message);
    }
  });

  return client;
}
