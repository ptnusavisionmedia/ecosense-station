/*
  EcoSense Station — Wokwi simulation build (WiFi + MQTT)

  Versi untuk SIMULASI di wokwi.com saja. Berbeda dari
  ../firmware/esp32-wifi/esp32-wifi.ino (yang untuk perangkat ESP32 fisik):
    - WIFI_SSID diset ke "Wokwi-GUEST" / password kosong — ini jaringan
      WiFi virtual bawaan Wokwi yang punya akses internet sungguhan dari
      simulator (lihat https://docs.wokwi.com/guides/esp32-wifi).
    - Data dikirim lewat MQTT (bukan HTTP POST) ke broker publik
      broker.hivemq.com:1883 (plain TCP, tanpa TLS — Wokwi TIDAK bisa
      membuka koneksi HTTPS/TLS sama sekali, lihat wokwi/README.md).
      Backend ../backend berlangganan topic yang sama lewat
      backend/src/mqtt.js, jadi TIDAK perlu tunnel (ngrok/localtunnel) sama
      sekali — baik simulator maupun backend cuma membuat koneksi KELUAR ke
      broker. MQTT_TOPIC di bawah pakai namespace demo bersama; untuk
      pemakaian sungguhan ganti ke topic unik (lihat MQTT_TOPIC di
      backend/.env) supaya tidak bentrok dengan pengguna lain broker publik.

  Sensor pengganti (sama seperti ../../ecosense-station-wokwi di repo
  Aplikasi-Pendeteksi-Buronan): HC-SR04 (pengganti JSN-SR04T), dua
  potentiometer (pengganti PH-4502C & SEN0189), pushbutton (pengganti pulsa
  YF-S201). Buzzer digerakkan langsung dari GPIO (Wokwi versi gratis tidak
  punya part transistor).

  Board di diagram.json: wokwi-esp32-devkit-v1 (BUKAN board-esp32-devkit-c-v4)
  -- board ini satu-satunya yang mensimulasikan chip DHT22 & HC-SR04 secara
  nyata (sinyal bit-banged beneran disimulasikan, bukan selalu NaN), sehingga
  suhu/kelembapan/jarak bisa dikontrol langsung lewat slider/knob part itu
  sendiri, persis seperti project referensi resmi Wokwi
  (https://wokwi.com/projects/new/esp32). GPIO4 KHUSUS TIDAK BISA dipakai
  untuk DHT22 di board ini -- sinyal bit-banged-nya selalu timeout walau
  wiring benar (terbukti lewat project official Wokwi sendiri yang juga
  gagal di GPIO4 tapi sukses di GPIO15); karena itu DHT22 dipindah ke GPIO15.
  SATU SYARAT PENTING: board ini
  memakai alias pin "D<n>" untuk semua pin digital (esp:D15, esp:D5, esp:D18,
  esp:D19, esp:D21, esp:D22, esp:D23, esp:D27) -- TANPA prefix "D" (esp:4 dst)
  wire-nya terlihat tersambung di kanvas tapi SEBENARNYA tidak terhubung
  secara elektrik (bug penamaan pin khusus board ini, kebalikan dari
  board-esp32-devkit-c-v4 yang justru butuh TANPA "D"). Pin ADC-only
  (GPIO32-39, dipakai pot_ph/pot_turb di esp:34/esp:35) TIDAK pakai alias "D".
  Nomor GPIO di firmware (angka di #define PIN_xxx di bawah) tetap sama
  persis, prefix "D" itu cuma label routing di diagram.json.

  Library Arduino: "DHT sensor library for ESPx" (beegee_tokyo -- WAJIB, pakai
  #include "DHTesp.h" + class DHTesp; library DHT.h generik dari Adafruit
  TIDAK reliable, dan DHTlib/Rob Tillaart gagal compile untuk ESP32 sama
  sekali karena library itu AVR-only), LiquidCrystal_I2C, ArduinoJson
  (Benoit Blanchon), PubSubClient (Nick O'Leary).

  CATATAN SIMULASI: potentiometer pH/turbidity kadang butuh reload bersih +
  klik ulang tombol Play supaya attrs/posisi knob ikut terbaca firmware saat
  boot pertama -- ini keterbatasan sesi simulator Wokwi, BUKAN bug wiring.
  Untuk sensor flow (pushbutton, pengganti pulsa YF-S201), nilainya HANYA naik
  kalau tombolnya benar-benar diklik di kanvas (setiap klik = satu pulsa);
  supaya demo tidak perlu klik berkali-kali, pakai override Serial "F<angka>"
  (lihat handleSerialOverrideCommands) yang otomatis mengakumulasi volume
  seolah air mengalir terus.
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "DHTesp.h"
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ---------- WiFi & MQTT (khusus simulasi Wokwi) ----------
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";
const char* MQTT_BROKER = "broker.hivemq.com";
const int   MQTT_PORT = 1883;
const char* MQTT_TOPIC = "ecosense-station-24b6a0f8/ingest"; // samakan dengan MQTT_TOPIC di backend/.env
const char* DEVICE_API_KEY = "wokwi-sim-key"; // dikirim di field "apiKey" tiap payload (MQTT tidak punya header)
const char* DEVICE_ID = "ecosense-01"; // samakan dengan DEFAULT_DEVICE_ID di backend/src/config.js

const unsigned long WIFI_RECONNECT_INTERVAL_MS = 15000;
const unsigned long MQTT_RECONNECT_INTERVAL_MS = 5000;
const unsigned long SEND_INTERVAL_MS = 5000;

WiFiClient espClient;
PubSubClient mqttClient(espClient);
unsigned long lastMqttAttempt = 0;

// ---------- Pin map (sama dengan diagram.json di folder ini) ----------
#define PIN_TRIG      5
#define PIN_ECHO      18
#define PIN_PH_PO     34
#define PIN_TURB_OUT  35
#define PIN_FLOW      27
#define PIN_DHT       15
#define PIN_BUZZER    19
#define PIN_LED       23

#define LCD_ADDR      0x27
#define LCD_COLS      16
#define LCD_ROWS      2

// ---------- Kalibrasi & ambang: placeholder, cukup untuk simulasi ----------
// RESERVOIR_HEIGHT_CM dinaikkan ke 400 (jangkauan maksimum HC-SR04) karena
// sensor ultrasonic simulasi Wokwi terbaca di kisaran ~300cm, bukan nilai
// "distance" di diagram.json — kalau RESERVOIR_HEIGHT_CM tetap 100, hasil
// (100 - ~300) selalu negatif lalu di-clamp ke 0, sehingga waterHeightCm
// macet di 0 terus. Di perangkat fisik, ganti sesuai tinggi reservoir asli.
float RESERVOIR_HEIGHT_CM = 400.0;
float LOW_WATER_THRESHOLD_CM = 15.0;

const float DIVIDER_RATIO = 0.5;
const float ADC_VREF = 3.3;
const int   ADC_MAX  = 4095;

// Kalibrasi diaktifkan untuk simulasi Wokwi, dipetakan ke seluruh rentang
// putaran potentiometer (0-5V) supaya memutar pot_ph/pot_turb langsung
// terlihat mengubah nilai pH/turbidity. Di perangkat fisik, nilai-nilai
// ini HARUS diganti lewat prosedur kalibrasi 2 titik sensor sungguhan.
float PH_CAL_V_AT_HIGH = 0.00;
float PH_CAL_V_AT_LOW  = 5.00;
const float PH_HIGH = 7.00;
const float PH_LOW  = 4.00;
bool PH_CALIBRATED = true;

float TURB_CAL_V_CLEAR = 5.00;
float TURB_CAL_V_MAX_NTU = 0.00;
bool TURB_CALIBRATED = true;

volatile uint32_t flowPulseCount = 0;
float FLOW_PULSES_PER_LITER = 450.0;
unsigned long flowWindowStart = 0;
float flowRateLpm = 0.0;
float flowVolumeLiters = 0.0;

DHTesp dhtSensor;
LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);

float dhtTemperature = NAN;
float dhtHumidity = NAN;
unsigned long lastDhtRead = 0;
const unsigned long DHT_INTERVAL_MS = 2500;

int lcdPage = 0;
unsigned long lastPageSwitch = 0;
const unsigned long PAGE_INTERVAL_MS = 3000;

bool lowWaterAlarm = false;
bool phAlarm = false;
bool turbAlarm = false;

unsigned long lastSendAttempt = 0;
unsigned long lastWifiAttempt = 0;

// ---------- Override manual lewat Serial Monitor (khusus simulasi Wokwi) ----------
// Wokwi tidak membawa nilai diagram.json/slider part (distance, posisi
// potentiometer) ke sinyal yang benar-benar dibaca firmware (pulseIn()/
// analogRead() tetap di posisi default) — ini keterbatasan simulator, bukan
// bug wiring/kode (lihat wokwi/README.md). Suhu/kelembapan DHT22 TIDAK kena
// batasan ini -- slider "Editing DHT22" dibaca langsung lewat dhtSensor.
// Supaya tetap bisa demo data berubah-ubah secara live di Wokwi, ketik
// perintah ini di kotak input Serial Monitor lalu Enter:
//   D20      -> set tinggi air seolah distance 20cm dari sensor (water = 100-20 = 80cm)
//   T28.5    -> set suhu 28.5 C
//   H55      -> set kelembapan 55 %
//   P6.8     -> set pH 6.8
//   U15      -> set turbidity 15 NTU
//   F3.2     -> set flow 3.2 L/menit
//   R        -> reset semua override, kembali membaca sensor simulasi asli
bool overrideActive = false;
float overrideDistanceCm = NAN;
float overrideTempC = NAN;
float overrideHumidity = NAN;
float overridePh = NAN;
float overrideTurbidityNtu = NAN;
float overrideFlowLpm = NAN;

void handleSerialOverrideCommands() {
  while (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;

    char cmd = toupper(line.charAt(0));
    if (cmd == 'R' && line.length() == 1) {
      overrideActive = false;
      overrideDistanceCm = overrideTempC = overrideHumidity = NAN;
      overridePh = overrideTurbidityNtu = overrideFlowLpm = NAN;
      Serial.println("[override] Direset — kembali pakai sensor simulasi asli.");
      continue;
    }

    float value = line.substring(1).toFloat();
    overrideActive = true;
    switch (cmd) {
      case 'D': overrideDistanceCm = value; Serial.print("[override] distance="); Serial.println(value); break;
      case 'T': overrideTempC = value; Serial.print("[override] tempC="); Serial.println(value); break;
      case 'H': overrideHumidity = value; Serial.print("[override] humidity="); Serial.println(value); break;
      case 'P': overridePh = value; Serial.print("[override] ph="); Serial.println(value); break;
      case 'U': overrideTurbidityNtu = value; Serial.print("[override] turbidityNtu="); Serial.println(value); break;
      case 'F': overrideFlowLpm = value; Serial.print("[override] flowLpm="); Serial.println(value); break;
      default: Serial.println("[override] Perintah tidak dikenal. Pakai D/T/H/P/U/F<angka> atau R."); break;
    }
  }
}

void IRAM_ATTR onFlowPulse() {
  flowPulseCount++;
}

float readUltrasonicDistanceCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  unsigned long duration = pulseIn(PIN_ECHO, HIGH, 25000UL);
  if (duration == 0) {
    return NAN;
  }
  return (duration / 2.0) * 0.0343;
}

float computeWaterHeightCm(float distanceCm) {
  if (isnan(distanceCm)) return NAN;
  float height = RESERVOIR_HEIGHT_CM - distanceCm;
  if (height < 0) height = 0;
  if (height > RESERVOIR_HEIGHT_CM) height = RESERVOIR_HEIGHT_CM;
  return height;
}

float readAveragedVoltageAtPin(int pin, int samples = 16) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delay(2);
  }
  float avgAdc = (float)sum / samples;
  return (avgAdc / ADC_MAX) * ADC_VREF;
}

float voltageBeforeDivider(float voltageAtGpio) {
  return voltageAtGpio / DIVIDER_RATIO;
}

float readPhValue() {
  float vAtGpio = readAveragedVoltageAtPin(PIN_PH_PO);
  float vPo = voltageBeforeDivider(vAtGpio);
  if (!PH_CALIBRATED) return NAN;

  float slope = (PH_LOW - PH_HIGH) / (PH_CAL_V_AT_LOW - PH_CAL_V_AT_HIGH);
  return PH_HIGH + slope * (vPo - PH_CAL_V_AT_HIGH);
}

float readTurbidityNtu() {
  float vAtGpio = readAveragedVoltageAtPin(PIN_TURB_OUT);
  float vPo = voltageBeforeDivider(vAtGpio);
  if (!TURB_CALIBRATED) return NAN;

  float ntu = (TURB_CAL_V_CLEAR - vPo) / (TURB_CAL_V_CLEAR - TURB_CAL_V_MAX_NTU) * 100.0;
  if (ntu < 0) ntu = 0;
  return ntu;
}

void updateFlowCalculation() {
  unsigned long now = millis();
  unsigned long elapsed = now - flowWindowStart;
  if (elapsed >= 1000) {
    noInterrupts();
    uint32_t pulses = flowPulseCount;
    flowPulseCount = 0;
    interrupts();

    if (!isnan(overrideFlowLpm)) {
      // Override aktif (lihat handleSerialOverrideCommands): pakai rate yang
      // diset manual, dan tetap akumulasi volume seolah air mengalir terus
      // -- supaya demo di Wokwi tidak perlu klik pushbutton berkali-kali.
      flowRateLpm = overrideFlowLpm;
      flowVolumeLiters += flowRateLpm * (elapsed / 60000.0);
    } else {
      float litersThisWindow = pulses / FLOW_PULSES_PER_LITER;
      flowVolumeLiters += litersThisWindow;
      flowRateLpm = litersThisWindow * (60000.0 / elapsed);
    }

    flowWindowStart = now;
  }
}

void updateAlarms(float waterHeightCm) {
  lowWaterAlarm = (!isnan(waterHeightCm) && waterHeightCm <= LOW_WATER_THRESHOLD_CM);
  phAlarm = false;
  turbAlarm = false;

  bool anyAlarm = lowWaterAlarm || phAlarm || turbAlarm;
  digitalWrite(PIN_LED, anyAlarm ? HIGH : LOW);
  digitalWrite(PIN_BUZZER, anyAlarm ? HIGH : LOW);
}

void renderLcdPage(float waterHeightCm, float ph, float turbidityNtu) {
  lcd.clear();
  switch (lcdPage) {
    case 0:
      lcd.setCursor(0, 0);
      lcd.print("Air (cm):");
      lcd.setCursor(0, 1);
      if (isnan(waterHeightCm)) {
        lcd.print("ERR SENSOR");
      } else {
        lcd.print(waterHeightCm, 1);
        if (lowWaterAlarm) lcd.print(" !LOW");
      }
      break;
    case 1:
      lcd.setCursor(0, 0);
      lcd.print("pH / Turb:");
      lcd.setCursor(0, 1);
      lcd.print(isnan(ph) ? "cal?" : String(ph, 2));
      lcd.print(" ");
      lcd.print(isnan(turbidityNtu) ? "cal?" : String(turbidityNtu, 0) + "NTU");
      break;
    case 2:
      lcd.setCursor(0, 0);
      lcd.print("Flow/Vol:");
      lcd.setCursor(0, 1);
      lcd.print(flowRateLpm, 2);
      lcd.print("L/m ");
      lcd.print(flowVolumeLiters, 1);
      lcd.print("L");
      break;
    case 3:
      lcd.setCursor(0, 0);
      lcd.print("Suhu/RH:");
      lcd.setCursor(0, 1);
      if (isnan(dhtTemperature) || isnan(dhtHumidity)) {
        lcd.print("ERR DHT22");
      } else {
        lcd.print(dhtTemperature, 1);
        lcd.print("C ");
        lcd.print(dhtHumidity, 0);
        lcd.print("%");
      }
      break;
    case 4:
      lcd.setCursor(0, 0);
      lcd.print("MQTT:");
      lcd.setCursor(0, 1);
      lcd.print(mqttClient.connected() ? "connected" : "disconnected");
      break;
  }
}

void ensureWifiConnected() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWifiAttempt < WIFI_RECONNECT_INTERVAL_MS) return;
  lastWifiAttempt = now;

  Serial.println("WiFi: mencoba konek...");
  WiFi.disconnect();
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void ensureMqttConnected() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  unsigned long now = millis();
  if (now - lastMqttAttempt < MQTT_RECONNECT_INTERVAL_MS) return;
  lastMqttAttempt = now;

  String clientId = String("ecosense-wokwi-") + String((uint32_t)esp_random(), HEX);
  Serial.print("MQTT: mencoba konek sebagai ");
  Serial.println(clientId);

  if (mqttClient.connect(clientId.c_str())) {
    Serial.println("MQTT: terhubung ke broker");
  } else {
    Serial.print("MQTT: gagal konek, state=");
    Serial.println(mqttClient.state());
  }
}

void setNumberOrNull(JsonDocument &doc, const char* key, float value) {
  if (isnan(value)) {
    doc[key] = nullptr;
  } else {
    doc[key] = value;
  }
}

void sendReadingToServer(float distanceCm, float waterHeightCm, float ph, float turbidityNtu) {
  if (!mqttClient.connected()) return;

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["apiKey"] = DEVICE_API_KEY;
  setNumberOrNull(doc, "distanceCm", distanceCm);
  setNumberOrNull(doc, "waterHeightCm", waterHeightCm);
  setNumberOrNull(doc, "ph", ph);
  setNumberOrNull(doc, "turbidityNtu", turbidityNtu);
  doc["flowLpm"] = flowRateLpm;
  doc["volumeL"] = flowVolumeLiters;
  setNumberOrNull(doc, "tempC", dhtTemperature);
  setNumberOrNull(doc, "rh", dhtHumidity);
  doc["lowWaterAlarm"] = lowWaterAlarm;
  doc["phAlarm"] = phAlarm;
  doc["turbAlarm"] = turbAlarm;

  String payload;
  serializeJson(doc, payload);

  Serial.print("MQTT PUBLISH -> ");
  Serial.println(MQTT_TOPIC);
  Serial.print("Payload: ");
  Serial.println(payload);

  bool ok = mqttClient.publish(MQTT_TOPIC, payload.c_str());
  Serial.print("MQTT publish result: ");
  Serial.println(ok ? "OK" : "GAGAL");
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_FLOW, INPUT_PULLUP);
  analogReadResolution(12);

  digitalWrite(PIN_LED, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  attachInterrupt(digitalPinToInterrupt(PIN_FLOW), onFlowPulse, FALLING);
  flowWindowStart = millis();

  dhtSensor.setup(PIN_DHT, DHTesp::DHT22);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("EcoSense Station");
  lcd.setCursor(0, 1);
  lcd.print("Booting...");
  delay(1200);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setBufferSize(512);

  Serial.println("EcoSense Station - Wokwi WiFi+MQTT sim ready");
}

void loop() {
  unsigned long now = millis();

  handleSerialOverrideCommands();

  ensureWifiConnected();
  ensureMqttConnected();
  mqttClient.loop();

  float distanceCm = readUltrasonicDistanceCm();
  float waterHeightCm = computeWaterHeightCm(distanceCm);
  float ph = readPhValue();
  float turbidityNtu = readTurbidityNtu();

  updateFlowCalculation();

  if (now - lastDhtRead >= DHT_INTERVAL_MS) {
    lastDhtRead = now;
    TempAndHumidity dhtData = dhtSensor.getTempAndHumidity();
    float t = dhtData.temperature;
    float h = dhtData.humidity;
    if (!isnan(t) && !isnan(h)) {
      dhtTemperature = t;
      dhtHumidity = h;
    }
    // Kalau pembacaan gagal (NaN), pertahankan nilai dhtTemperature/dhtHumidity
    // yang terakhir berhasil dibaca -- supaya suhu/kelembapan murni
    // dikendalikan oleh part DHT22 sendiri (slider "Editing DHT22" di Wokwi,
    // atau sensor fisik asli di perangkat).
  }

  // Override manual (lihat handleSerialOverrideCommands) menang atas
  // pembacaan sensor simulasi asli — supaya demo di Wokwi tetap bisa
  // menunjukkan data berubah-ubah walau attrs/slider part tidak ikut terbaca.
  if (!isnan(overrideDistanceCm)) distanceCm = overrideDistanceCm;
  waterHeightCm = computeWaterHeightCm(distanceCm);
  if (!isnan(overridePh)) ph = overridePh;
  if (!isnan(overrideTurbidityNtu)) turbidityNtu = overrideTurbidityNtu;
  if (!isnan(overrideTempC)) dhtTemperature = overrideTempC;
  if (!isnan(overrideHumidity)) dhtHumidity = overrideHumidity;

  updateAlarms(waterHeightCm);

  if (now - lastPageSwitch >= PAGE_INTERVAL_MS) {
    lastPageSwitch = now;
    lcdPage = (lcdPage + 1) % 5;
  }
  renderLcdPage(waterHeightCm, ph, turbidityNtu);

  if (now - lastSendAttempt >= SEND_INTERVAL_MS) {
    lastSendAttempt = now;
    sendReadingToServer(distanceCm, waterHeightCm, ph, turbidityNtu);
  }

  // Ringkasan status tiap loop, lengkap dengan keterangan Bahasa Indonesia
  // supaya gampang dibaca di Serial Monitor (bukan cuma dist_cm/water_cm).
  Serial.print("Jarak sensor: ");
  Serial.print(isnan(distanceCm) ? -1 : distanceCm);
  Serial.print(" cm | Tinggi air: ");
  Serial.print(isnan(waterHeightCm) ? -1 : waterHeightCm);
  Serial.print(" cm");
  Serial.print(lowWaterAlarm ? " [ALARM: AIR RENDAH]" : "");

  Serial.print(" | pH: ");
  Serial.print(isnan(ph) ? -1 : ph);
  Serial.print(" | Kekeruhan: ");
  Serial.print(isnan(turbidityNtu) ? -1 : turbidityNtu);
  Serial.print(" NTU");

  Serial.print(" | Suhu: ");
  Serial.print(isnan(dhtTemperature) ? -1 : dhtTemperature);
  Serial.print(" C | Kelembapan: ");
  Serial.print(isnan(dhtHumidity) ? -1 : dhtHumidity);
  Serial.print(" %");

  Serial.print(" | Debit air: ");
  Serial.print(flowRateLpm);
  Serial.print(" L/menit | Volume kumulatif: ");
  Serial.print(flowVolumeLiters);
  Serial.print(" L");

  Serial.print(" | WiFi: ");
  Serial.print(WiFi.status() == WL_CONNECTED ? "terhubung" : "terputus");
  Serial.print(" | MQTT: ");
  Serial.println(mqttClient.connected() ? "terhubung" : "terputus");

  delay(500);
}
