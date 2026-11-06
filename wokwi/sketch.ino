/*
  EcoSense Station — Wokwi simulation build (WiFi + HTTP POST)

  Versi untuk SIMULASI di wokwi.com saja. Berbeda dari
  ../firmware/esp32-wifi/esp32-wifi.ino (yang untuk perangkat ESP32 fisik):
    - WIFI_SSID diset ke "Wokwi-GUEST" / password kosong — ini jaringan
      WiFi virtual bawaan Wokwi yang punya akses internet sungguhan dari
      simulator (lihat https://docs.wokwi.com/guides/esp32-wifi).
    - INGEST_URL diarahkan ke https://httpbin.org/post (endpoint publik yang
      sekadar meng-echo balik request yang diterima) — dipakai untuk
      MEMVALIDASI alur WiFi connect + HTTP POST JSON-nya, BUKAN backend
      sungguhan. Backend asli di ../backend berjalan di localhost komputer
      Anda sendiri, yang TIDAK bisa dijangkau dari simulator Wokwi (jalan di
      cloud, bukan di komputer Anda) — perlu tunnel (ngrok dsb.) atau
      backend yang sudah online publik kalau mau tes ingest sungguhan dari
      Wokwi.

  Sensor pengganti (sama seperti ../../ecosense-station-wokwi di repo
  Aplikasi-Pendeteksi-Buronan): HC-SR04 (pengganti JSN-SR04T), dua
  potentiometer (pengganti PH-4502C & SEN0189), pushbutton (pengganti pulsa
  YF-S201). Buzzer digerakkan langsung dari GPIO (Wokwi versi gratis tidak
  punya part transistor).

  Library Arduino: DHT sensor library (Adafruit), Adafruit Unified Sensor,
  LiquidCrystal_I2C, ArduinoJson (Benoit Blanchon).
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ---------- WiFi & server (khusus simulasi Wokwi) ----------
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";
const char* INGEST_URL = "http://httpbin.org/post"; // endpoint uji publik, bukan backend asli
const char* DEVICE_API_KEY = "wokwi-sim-key";
const char* DEVICE_ID = "ecosense-01-sim";

const unsigned long WIFI_RECONNECT_INTERVAL_MS = 15000;
const unsigned long SEND_INTERVAL_MS = 5000;

// ---------- Pin map (sama dengan diagram.json di folder ini) ----------
#define PIN_TRIG      5
#define PIN_ECHO      18
#define PIN_PH_PO     34
#define PIN_TURB_OUT  35
#define PIN_FLOW      27
#define PIN_DHT       4
#define PIN_BUZZER    19
#define PIN_LED       23

#define DHT_TYPE      DHT22
#define LCD_ADDR      0x27
#define LCD_COLS      16
#define LCD_ROWS      2

// ---------- Kalibrasi & ambang: placeholder, cukup untuk simulasi ----------
float RESERVOIR_HEIGHT_CM = 100.0;
float LOW_WATER_THRESHOLD_CM = 15.0;

const float DIVIDER_RATIO = 0.5;
const float ADC_VREF = 3.3;
const int   ADC_MAX  = 4095;

float PH_CAL_V_AT_HIGH = 2.50;
float PH_CAL_V_AT_LOW  = 3.00;
const float PH_HIGH = 7.00;
const float PH_LOW  = 4.00;
bool PH_CALIBRATED = false;

float TURB_CAL_V_CLEAR = 2.80;
float TURB_CAL_V_MAX_NTU = 1.00;
bool TURB_CALIBRATED = false;

volatile uint32_t flowPulseCount = 0;
float FLOW_PULSES_PER_LITER = 450.0;
unsigned long flowWindowStart = 0;
float flowRateLpm = 0.0;
float flowVolumeLiters = 0.0;

DHT dht(PIN_DHT, DHT_TYPE);
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

    float litersThisWindow = pulses / FLOW_PULSES_PER_LITER;
    flowVolumeLiters += litersThisWindow;
    flowRateLpm = litersThisWindow * (60000.0 / elapsed);

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
      lcd.print("WiFi:");
      lcd.setCursor(0, 1);
      lcd.print(WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "disconnected");
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

void setNumberOrNull(JsonDocument &doc, const char* key, float value) {
  if (isnan(value)) {
    doc[key] = nullptr;
  } else {
    doc[key] = value;
  }
}

void sendReadingToServer(float distanceCm, float waterHeightCm, float ph, float turbidityNtu) {
  if (WiFi.status() != WL_CONNECTED) return;

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
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

  HTTPClient http;
  http.setTimeout(4000);
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", DEVICE_API_KEY);

  Serial.print("HTTP POST -> ");
  Serial.println(INGEST_URL);
  Serial.print("Payload: ");
  Serial.println(payload);

  int statusCode = http.POST(payload);
  if (statusCode <= 0) {
    Serial.print("Kirim ke server gagal, error: ");
    Serial.println(http.errorToString(statusCode));
  } else {
    Serial.print("HTTP status: ");
    Serial.println(statusCode);
  }
  http.end();
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

  dht.begin();

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("EcoSense Station");
  lcd.setCursor(0, 1);
  lcd.print("Booting...");
  delay(1200);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.println("EcoSense Station - Wokwi WiFi sim ready");
}

void loop() {
  unsigned long now = millis();

  ensureWifiConnected();

  float distanceCm = readUltrasonicDistanceCm();
  float waterHeightCm = computeWaterHeightCm(distanceCm);
  float ph = readPhValue();
  float turbidityNtu = readTurbidityNtu();

  updateFlowCalculation();

  if (now - lastDhtRead >= DHT_INTERVAL_MS) {
    lastDhtRead = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      dhtTemperature = t;
      dhtHumidity = h;
    } else {
      dhtTemperature = NAN;
      dhtHumidity = NAN;
    }
  }

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

  Serial.print("dist_cm=");
  Serial.print(isnan(distanceCm) ? -1 : distanceCm);
  Serial.print(" water_cm=");
  Serial.print(isnan(waterHeightCm) ? -1 : waterHeightCm);
  Serial.print(" wifi=");
  Serial.println(WiFi.status() == WL_CONNECTED ? "up" : "down");

  delay(500);
}
