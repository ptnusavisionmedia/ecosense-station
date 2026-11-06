# EcoSense Station — Simulasi Wokwi (WiFi + HTTP POST)

Versi Wokwi dari firmware `../firmware/esp32-wifi/esp32-wifi.ino`, dipakai
untuk menguji coba alur **WiFi connect + kirim data via HTTP POST** tanpa
perangkat fisik, sebelum lanjut ke integrasi backend/Telegram/web yang
sesungguhnya.

## Cara pakai

1. Buka [wokwi.com/projects/new/esp32](https://wokwi.com/projects/new/esp32)
   (atau project yang sudah disiapkan: [wokwi.com/projects/479938633151595521](https://wokwi.com/projects/479938633151595521)).
2. Ganti isi `diagram.json` dan `sketch.ino` project Wokwi dengan file di
   folder ini.
3. Klik tombol **Start the simulation** (▶). Build pertama kali akan gagal
   dengan dialog "Build failed!" karena `ArduinoJson.h` belum terpasang —
   klik tombol **"Install ArduinoJson Library"** di dialog itu (tidak perlu
   sign in ke akun Wokwi untuk jalur ini). Ulangi hal yang sama untuk
   `DHT.h` dan `LiquidCrystal_I2C.h` jika muncul (atau install ketiganya
   sekaligus lewat panel **Library Manager**, tombol `+` → cari nama
   library di `libraries.txt`).
4. Jalankan ulang simulasi. ESP32 akan konek ke jaringan WiFi virtual
   bawaan Wokwi (`Wokwi-GUEST`, tanpa password) yang punya akses internet
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
- **Compile penuh dengan library asli terpasang** (`ArduinoJson.h`, `DHT.h`,
  `LiquidCrystal_I2C.h` — bukan stub) sudah dicoba dan **berhasil**, lewat
  tombol "Install ... Library" di dialog "Build failed!" (jalur ini tidak
  butuh sign-in ke akun Wokwi, berbeda dari tombol "Add a new library" di
  panel Library Manager yang sempat diduga perlu sign-in). `WiFi.h` dan
  `HTTPClient.h` memang sudah bawaan core ESP32 sejak awal (tidak perlu
  Library Manager sama sekali).
- Simulasi dijalankan ulang setelah ketiga library terpasang dan
  **berhasil end-to-end**, terlihat di Serial Monitor:
  ```
  EcoSense Station - Wokwi WiFi sim ready
  dist_cm=-1.00 water_cm=-1.00 wifi=down
  dist_cm=-1.00 water_cm=-1.00 wifi=up
  HTTP POST -> http://httpbin.org/post
  Payload: {"deviceId":"ecosense-01-sim","distanceCm":null,"waterHeightCm":null,
  "ph":null,"turbidityNtu":null,"flowLpm":0,"volumeL":0,"tempC":null,"rh":null,
  "lowWaterAlarm":false,"phAlarm":false,"turbAlarm":false}
  HTTP status: 200
  ```
  Ini mengonfirmasi: WiFi berhasil konek ke `Wokwi-GUEST`, payload JSON
  terbentuk benar (field NAN dikirim sebagai `null`, bukan `0`/`nan` yang
  menyesatkan), dan request HTTP POST benar-benar sampai ke internet nyata
  lewat simulator Wokwi dengan respons `200` — kali ini dengan kode asli
  yang sudah di-commit di `sketch.ino`, bukan versi stub.
- `dist_cm=-1.00` dan `tempC/rh: null` di log adalah perilaku
  normal/terdokumentasi (bukan bug): ultrasonic/DHT belum punya sumber
  input simulasi (tidak ada potentiometer/slider yang digerakkan), jadi
  pembacaan ditandai `NAN` → dikirim sebagai `null`/`-1`, sesuai desain
  "pembacaan tidak valid ditandai error, bukan dianggap nilai nol".
- **Belum diverifikasi**: ingest ke backend `../backend` yang sesungguhnya
  (perlu tunnel seperti ngrok — `INGEST_URL` saat ini masih diarahkan ke
  `httpbin.org` sebagai target uji publik, bukan backend asli), dan
  tampilan visual LCD (teks tidak sempat dibaca jelas dari screenshot,
  meski render & wiring-nya tidak error).

## Perbedaan dengan firmware fisik (`../firmware/esp32-wifi`)

Hanya tiga konstanta yang berbeda, khusus untuk simulasi:

| Konstanta | Wokwi (`wokwi/sketch.ino`) | Fisik (`firmware/esp32-wifi/esp32-wifi.ino`) |
| --- | --- | --- |
| `WIFI_SSID` / `WIFI_PASSWORD` | `"Wokwi-GUEST"` / `""` | WiFi asli lokasi Anda |
| `INGEST_URL` | `http://httpbin.org/post` (uji publik) | URL backend asli Anda |
| `DEVICE_API_KEY` | `"wokwi-sim-key"` (bebas) | harus sama dengan `backend/.env` |

Logika sensor, kalibrasi, alarm, dan LCD identik dengan firmware fisik.
