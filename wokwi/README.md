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

## Kenapa default-nya httpbin.org, bukan backend asli

Agar project ini bisa langsung dicoba siapa pun tanpa setup tambahan,
`INGEST_URL` default di sketch diarahkan ke `http://httpbin.org/post`
(endpoint publik yang sekadar meng-*echo* balik request yang diterima),
**bukan** `../backend` yang sesungguhnya. Backend asli berjalan di
`localhost` komputer Anda sendiri, sementara simulator Wokwi jalan di
cloud — keduanya tidak saling terjangkau secara langsung kecuali backend
diekspos lewat tunnel. Ini **sudah dicoba dan berhasil** — lihat bagian
"Ingest ke backend asli (sudah diverifikasi)" di bawah.

### Ingest ke backend asli (sudah diverifikasi)

Untuk menguji ingest sungguhan ke `../backend`, backend perlu diekspos ke
internet lewat tunnel. Dua catatan penting dari hasil uji coba:

1. **Wokwi tidak bisa membuka koneksi HTTPS/TLS sama sekali** dari dalam
   simulator (dicoba ke `https://httpbin.org` pun gagal dengan error
   `connection refused`, bukan masalah spesifik ngrok). Jadi tunnel yang
   dipakai **wajib mengizinkan akses HTTP polos** tanpa redirect paksa ke
   HTTPS.
   - `ngrok http` di akun gratis **tidak bisa dipakai** — domain
     `*.ngrok-free.dev` selalu redirect `307` ke HTTPS.
   - `ngrok tcp` (raw TCP, tanpa TLS) bisa dipakai, tapi akun gratis
     ngrok sekarang mewajibkan verifikasi kartu kredit untuk fitur ini.
   - **[localtunnel](https://github.com/localtunnel/localtunnel)** (npm,
     tanpa akun) terbukti bisa: `http://<subdomain>.loca.lt/...` bisa
     diakses lewat HTTP polos tanpa redirect. Jalankan dengan
     `npx localtunnel --port 3000` (atau install lokal lalu
     `node node_modules/localtunnel/bin/lt.js --port 3000` supaya lebih
     stabil daripada lewat `npx`).
2. **Naikkan timeout HTTP di sketch** (`http.setTimeout(...)`) dari 4000ms
   ke sekitar 15000ms — round-trip lewat tunnel + jaringan simulasi Wokwi
   lebih lambat daripada akses langsung, jadi 4 detik kerap menghasilkan
   `HTTP status: 408` meski request sebenarnya sampai.

Dengan dua penyesuaian itu, hasilnya **berhasil end-to-end**:
`HTTP status: 201` di Serial Monitor Wokwi, dan baris data baru
(`deviceId: "ecosense-01-sim"`) benar-benar masuk ke database SQLite
backend asli (diverifikasi langsung lewat query ke `backend/data/ecosense.db`,
bukan cuma asumsi dari status code).

File `sketch.ino` yang di-commit ke repo ini **tetap** memakai
`http://httpbin.org/post` sebagai default (bukan URL tunnel, karena URL
tunnel gratis bersifat sementara dan berubah tiap kali dijalankan ulang).
Untuk reproduksi tes ingest-ke-backend-asli, ganti `INGEST_URL` dan
`http.setTimeout(...)` sesuai poin di atas sebelum menjalankan simulasi.

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
- **Memutar potentiometer `pot_ph`/`pot_turb` awalnya tidak berefek ke
  nilai pH/turbidity** — ini **bukan bug wiring**, melainkan karena
  `PH_CALIBRATED`/`TURB_CALIBRATED` sengaja di-set `false` pada draf awal
  (mewakili kondisi "sensor belum dikalibrasi" di perangkat fisik), yang
  membuat `readPhValue()`/`readTurbidityNtu()` selalu `return NAN` tanpa
  pernah membaca pin GPIO-nya sama sekali. **Sudah diperbaiki**: kedua
  flag di-set `true` dan rentang kalibrasi (`PH_CAL_V_AT_HIGH/LOW`,
  `TURB_CAL_V_CLEAR`/`TURB_CAL_V_MAX_NTU`) dipetakan ke seluruh rentang
  putaran pot (0-5V), dikonfirmasi lewat payload yang sebelumnya
  `"ph":null,"turbidityNtu":null` menjadi `"ph":7,"turbidityNtu":100`
  setelah fix. Kalau Anda mencoba sendiri dan memutar knob pot di kanvas
  Wokwi tetap tidak terlihat berubah, pastikan sudah memakai versi
  `sketch.ino` terbaru dari folder ini (bukan versi lama yang masih
  `PH_CALIBRATED = false`).
- **Ingest ke backend asli**: sudah diverifikasi penuh lewat tunnel
  localtunnel — lihat bagian "Ingest ke backend asli (sudah diverifikasi)"
  di atas untuk detail lengkapnya.
- **Belum diverifikasi**: tampilan visual LCD (teks tidak sempat dibaca
  jelas dari screenshot, meski render & wiring-nya tidak error), dan
  reload halaman Wokwi dari URL project untuk memastikan perubahan
  tersimpan permanen (sesi uji coba ini anonim, perubahan di editor hanya
  berlaku untuk sesi berjalan kecuali disimpan manual oleh pemilik akun).

## Perbedaan dengan firmware fisik (`../firmware/esp32-wifi`)

Hanya tiga konstanta yang berbeda, khusus untuk simulasi:

| Konstanta | Wokwi (`wokwi/sketch.ino`) | Fisik (`firmware/esp32-wifi/esp32-wifi.ino`) |
| --- | --- | --- |
| `WIFI_SSID` / `WIFI_PASSWORD` | `"Wokwi-GUEST"` / `""` | WiFi asli lokasi Anda |
| `INGEST_URL` | `http://httpbin.org/post` (uji publik) | URL backend asli Anda |
| `DEVICE_API_KEY` | `"wokwi-sim-key"` (bebas) | harus sama dengan `backend/.env` |

Logika sensor, kalibrasi, alarm, dan LCD identik dengan firmware fisik.
