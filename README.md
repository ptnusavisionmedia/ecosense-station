# EcoSense Station — Telegram & Web Monitoring

Perluasan dari hardware/firmware EcoSense Station (ESP32 + sensor reservoir,
lihat proyek Wokwi di `Aplikasi-Pendeteksi-Buronan/ecosense-station-wokwi`)
agar data bisa dipantau lewat **Telegram bot** dan **dashboard web**, bukan
cuma LCD lokal di perangkat.

PRD lengkap ada di [`.agents/1-PRD.md`](.agents/1-PRD.md).

## Struktur folder

```
EcoSense-Station/
├── .agents/1-PRD.md        # Product Requirement Document
├── wokwi/                  # Simulasi Wokwi untuk uji WiFi + HTTP POST (lihat wokwi/README.md)
├── firmware/esp32-wifi/    # Firmware ESP32 + WiFi untuk perangkat fisik
├── backend/                # API ingest + Telegram bot + web dashboard server
│   ├── src/
│   │   ├── server.js       # Entry point Express
│   │   ├── db.js           # SQLite (node:sqlite bawaan Node 22+)
│   │   ├── config.js       # Ambang alarm (tersimpan di DB)
│   │   ├── telegram.js     # Bot Telegram (polling)
│   │   ├── alarms.js       # Deteksi transisi alarm -> notifikasi
│   │   └── routes/         # /api/ingest, /latest, /history, /status, /config
│   └── .env.example
└── web/                     # Dashboard statis (HTML/CSS/vanilla JS + Chart.js)
```

Backend menyajikan API **dan** file statis `web/` dari satu proses yang sama
(`http://localhost:3000/` sudah langsung membuka dashboard).

## Cara menjalankan

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Isi `.env`:

- `DEVICE_API_KEY` — bebas, asal sama persis dengan `DEVICE_API_KEY` di
  firmware.
- `ADMIN_API_KEY` — bebas, dipakai hanya untuk `PUT /api/config/thresholds`.
- `TELEGRAM_BOT_TOKEN` — dari [@BotFather](https://t.me/BotFather)
  (`/newbot`). Kosongkan kalau belum mau mengaktifkan bot — backend tetap
  jalan tanpa Telegram.

Jalankan:

```bash
npm start
```

Dashboard web otomatis terbuka di `http://localhost:3000/`.

### 2. Firmware ESP32

Buka `firmware/esp32-wifi/esp32-wifi.ino` di Arduino IDE. Install library:

- DHT sensor library (Adafruit)
- Adafruit Unified Sensor
- LiquidCrystal_I2C
- ArduinoJson (Benoit Blanchon)

Isi bagian atas sketch sebelum flash ke perangkat nyata:

```cpp
const char* WIFI_SSID = "...";
const char* WIFI_PASSWORD = "...";
const char* INGEST_URL = "http://ALAMAT_BACKEND:3000/api/ingest";
const char* DEVICE_API_KEY = "..."; // samakan dengan backend/.env
```

**Jangan commit kredensial WiFi/API key asli ke git.** Sketch ini masih
memakai pin, kalibrasi, dan logika sensor yang sama dengan
`ecosense-station-wokwi/sketch.ino` — hanya menambah pengiriman data lewat
WiFi, tanpa mengubah perilaku LCD/alarm lokal.

> Catatan: firmware ini untuk **perangkat ESP32 fisik**. Logika WiFi + HTTP
> POST-nya sudah divalidasi di simulator Wokwi lewat project terpisah di
> [`wokwi/`](wokwi/) (WiFi konek, request terkirim, dapat `HTTP 200`) — lihat
> [`wokwi/README.md`](wokwi/README.md) untuk detail & cara menjalankannya.
> Ingin coba dulu tanpa perangkat fisik sama sekali? Mulai dari situ.

### 3. Telegram bot

1. Chat [@BotFather](https://t.me/BotFather) di Telegram, `/newbot`, ikuti
   instruksinya, salin token yang diberikan ke `TELEGRAM_BOT_TOKEN`.
2. Jalankan backend (`npm start`).
3. Di Telegram, cari bot kamu, kirim `/start` untuk mulai berlangganan.
4. Kirim `/status` kapan saja untuk cek kondisi terkini.
5. Kirim `/stop` untuk berhenti berlangganan.

Notifikasi otomatis terkirim ke semua yang sudah `/start` saat alarm
(air rendah / pH / turbidity) berubah status, atau saat perangkat berhenti
mengirim data (dianggap offline setelah `DEVICE_OFFLINE_MINUTES` menit).

## API ringkas

| Endpoint | Method | Auth | Keterangan |
| --- | --- | --- | --- |
| `/api/ingest` | POST | `x-api-key: DEVICE_API_KEY` | Perangkat kirim reading baru |
| `/api/latest` | GET | — | Reading terbaru + status online |
| `/api/history?from=&to=&limit=` | GET | — | Histori reading (epoch ms atau tanggal ISO) |
| `/api/status` | GET | — | Ringkasan status alarm + online/offline |
| `/api/config/thresholds` | GET | — | Lihat ambang alarm saat ini |
| `/api/config/thresholds` | PUT | `x-api-key: ADMIN_API_KEY` | Ubah ambang alarm |

## Status pengujian

- **Backend**: sudah dites langsung (bukan cuma ditulis) — `npm install`
  berhasil, server start, dan semua endpoint (`/api/ingest` dengan & tanpa
  API key, `/api/latest`, `/api/status`, `/api/history`, file statis
  `index.html`/`app.js`/`style.css`) dicoba lewat `curl` dan merespons sesuai
  harapan, termasuk notifikasi transisi alarm (low water: false → true)
  yang terpicu tanpa error di log server.
- **Telegram bot**: logika kode sudah ditulis sesuai PRD (`/start`, `/stop`,
  `/status`, broadcast transisi alarm), tapi **belum dites dengan token bot
  sungguhan** (tidak ada token Telegram yang tersedia saat development ini).
  Uji dengan token asli sebelum dipakai produksi.
- **Web dashboard**: HTML/CSS/JS sudah dicek lewat `curl` untuk memastikan
  ter-serve dengan benar oleh backend, tapi **belum dibuka di browser
  sungguhan** untuk verifikasi visual (grafik, polling, filter tanggal).
  Disarankan membuka `http://localhost:3000/` di browser dan mengecek
  console sebelum dianggap final.
- **Firmware ESP32 WiFi**: logikanya (WiFi connect, pembentukan payload JSON,
  HTTP POST) sudah dites langsung di simulator Wokwi lewat [`wokwi/`](wokwi/)
  — WiFi berhasil konek ke jaringan virtual Wokwi dan request POST ke
  `httpbin.org` mendapat balasan `HTTP 200`. `WiFi.h`/`HTTPClient.h` juga
  terkonfirmasi compile bersih (bawaan core ESP32). Yang **belum**
  terverifikasi: compile dengan ketiga library pihak ketiga (DHT,
  LiquidCrystal_I2C, ArduinoJson) benar-benar terpasang — di sesi uji coba
  ini Library Manager Wokwi butuh sign-in yang tidak tersedia, jadi ketiganya
  sempat distub sementara hanya untuk tes logika. Pasang ketiga library itu
  dan compile ulang (Arduino IDE atau Wokwi dengan akun) sebelum flash ke
  perangkat fisik. Detail lengkap ada di [`wokwi/README.md`](wokwi/README.md).

## Langkah lanjutan yang disarankan

1. Compile `firmware/esp32-wifi/esp32-wifi.ino` (Arduino IDE atau Wokwi)
   untuk memastikan tidak ada error setelah penambahan ArduinoJson/WiFi.
2. Buka dashboard di browser dan uji alur penuh: isi reading lewat `curl`
   atau perangkat asli → cek kartu nilai, banner alarm, dan grafik update.
3. Uji bot Telegram dengan token asli: `/start`, `/status`, `/stop`, dan
   picu alarm (misalnya lewat `curl` ke `/api/ingest`) untuk pastikan
   notifikasi terkirim.
4. Pertimbangkan hosting backend di perangkat yang selalu menyala (VPS kecil
   atau Raspberry Pi) di jaringan yang sama/terjangkau dari ESP32.
