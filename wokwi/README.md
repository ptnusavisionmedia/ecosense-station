# EcoSense Station — Simulasi Wokwi (WiFi + HTTP POST)

Versi Wokwi dari firmware `../firmware/esp32-wifi/esp32-wifi.ino`, dipakai
untuk menguji coba alur **WiFi connect + kirim data via HTTP POST** tanpa
perangkat fisik, sebelum lanjut ke integrasi backend/Telegram/web yang
sesungguhnya.

## Cara pakai

1. Buka [wokwi.com/projects/new/esp32](https://wokwi.com/projects/new/esp32).
2. Install library Arduino di `libraries.txt` (DHT sensor library, Adafruit
   Unified Sensor, LiquidCrystal_I2C, **ArduinoJson**) lewat Library Manager
   (perlu sign in ke akun Wokwi — lihat catatan di bawah).
3. Ganti isi `diagram.json` dan `sketch.ino` project Wokwi dengan file di
   folder ini.
4. Jalankan simulasi. ESP32 akan konek ke jaringan WiFi virtual bawaan
   Wokwi (`Wokwi-GUEST`, tanpa password) yang punya akses internet
   sungguhan dari dalam simulator.

## Kenapa target-nya httpbin.org, bukan backend asli

`INGEST_URL` di sketch ini diarahkan ke `http://httpbin.org/post` (endpoint
publik yang sekadar meng-*echo* balik request yang diterima), **bukan**
`../backend` yang sesungguhnya. Backend asli berjalan di `localhost`
komputer Anda sendiri, sementara simulator Wokwi jalan di cloud —
keduanya tidak saling terjangkau secara langsung. Untuk menguji ingest ke
backend asli dari Wokwi, backend itu perlu diekspos ke internet dulu, misalnya
lewat [ngrok](https://ngrok.com/) (`ngrok http 3000`, lalu pakai URL `https://...ngrok-free.app/api/ingest`
sebagai `INGEST_URL`) — belum dilakukan di pengujian ini.

## Status pengujian (sudah dicoba langsung di wokwi.com)

- **Board & wiring**: sama seperti `../../Aplikasi-Pendeteksi-Buronan/ecosense-station-wokwi`
  yang sudah tervalidasi — tipe board `board-esp32-devkit-c-v4`, semua part
  (DHT22, HC-SR04, dua potentiometer, pushbutton, LCD1602 I2C, LED, buzzer
  langsung GPIO) ter-render dan tersambung tanpa indikator putus.
- **Compile penuh** (dengan `#include <ArduinoJson.h>`, `<DHT.h>`,
  `<LiquidCrystal_I2C.h>`) **gagal** di sesi anonim karena tombol
  "Add a new library" di Library Manager Wokwi tidak merespons tanpa
  sign-in — sama seperti kendala yang sudah didokumentasikan di
  `ecosense-station-wokwi/README.md` sebelumnya. `WiFi.h` dan
  `HTTPClient.h` **tidak** bermasalah karena sudah bawaan core ESP32
  (tidak perlu Library Manager).
- **Untuk tetap memvalidasi logika WiFi/HTTP**, tiga include tadi distub
  sementara (class dummy + implementasi `JsonDocument`/`serializeJson`
  minimal, hanya untuk tes, tidak disimpan ke file ini) dan di-compile +
  dijalankan ulang. Hasilnya **berhasil end-to-end**, terlihat di Serial
  Monitor:
  ```
  EcoSense Station - Wokwi WiFi sim ready
  dist_cm=-1.00 water_cm=-1.00 wifi=down
  dist_cm=-1.00 water_cm=-1.00 wifi=up
  HTTP POST -> http://httpbin.org/post
  Payload: {"deviceId":"ecosense-01-sim","distanceCm":null,"flowLpm":0.0000,
  "lowWaterAlarm":false,"ph":null,"phAlarm":false,"rh":55.0000,"tempC":25.0000,
  "turbAlarm":false,"turbidityNtu":null,"volumeL":0.0000,"waterHeightCm":null}
  HTTP status: 200
  ```
  Ini mengonfirmasi: WiFi berhasil konek ke `Wokwi-GUEST`, payload JSON
  terbentuk benar (field NAN dikirim sebagai `null`, bukan `0`/`nan` yang
  menyesatkan), dan request HTTP POST benar-benar sampai ke internet nyata
  lewat simulator Wokwi dengan respons `200`.
- `dist_cm=-1.00` di log adalah perilaku normal/terdokumentasi (bukan bug):
  itu artinya pembacaan ultrasonic timeout → ditandai `NAN` → dicetak
  sebagai `-1`, sesuai desain "pembacaan tidak valid ditandai error, bukan
  dianggap reservoir kosong".
- **Belum diverifikasi**: compile dengan ketiga library asli terpasang
  (perlu sign-in Wokwi), dan ingest ke backend `../backend` yang
  sesungguhnya (perlu tunnel seperti ngrok, belum dilakukan).

## Perbedaan dengan firmware fisik (`../firmware/esp32-wifi`)

Hanya tiga konstanta yang berbeda, khusus untuk simulasi:

| Konstanta | Wokwi (`wokwi/sketch.ino`) | Fisik (`firmware/esp32-wifi/esp32-wifi.ino`) |
| --- | --- | --- |
| `WIFI_SSID` / `WIFI_PASSWORD` | `"Wokwi-GUEST"` / `""` | WiFi asli lokasi Anda |
| `INGEST_URL` | `http://httpbin.org/post` (uji publik) | URL backend asli Anda |
| `DEVICE_API_KEY` | `"wokwi-sim-key"` (bebas) | harus sama dengan `backend/.env` |

Logika sensor, kalibrasi, alarm, dan LCD identik dengan firmware fisik.
