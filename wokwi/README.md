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
   dengan dialog "Build failed!" karena library belum terpasang — untuk
   `ArduinoJson.h`, `DHT.h`, `LiquidCrystal_I2C.h` klik tombol **"Install
   ... Library"** langsung di dialog itu (tidak perlu sign in ke akun
   Wokwi). `PubSubClient.h` tidak punya tombol install langsung di dialog
   — buka panel **Library Manager** (tab di atas editor), klik `+`, cari
   "PubSubClient", lalu klik hasil yang namanya persis "PubSubClient"
   (karya Nick O'Leary). Bisa juga install semuanya sekaligus lewat
   Library Manager, cari tiap nama di `libraries.txt`.
4. Jalankan ulang simulasi. ESP32 akan konek ke jaringan WiFi virtual
   bawaan Wokwi (`Wokwi-GUEST`, tanpa password) yang punya akses internet
   sungguhan dari dalam simulator.

## Kenapa pakai MQTT, bukan HTTP POST ke backend langsung

Sketch ini mengirim data lewat **MQTT** ke broker publik
`broker.hivemq.com:1883` (plain TCP, bukan TLS), bukan HTTP POST langsung
ke `../backend`. Backend berlangganan topic yang sama lewat
`backend/src/mqtt.js`. Alasannya:

1. **Wokwi tidak bisa membuka koneksi HTTPS/TLS sama sekali** dari dalam
   simulator (dicoba ke `https://httpbin.org` pun gagal dengan error
   `connection refused`). Backend asli berjalan di `localhost` komputer
   Anda sendiri, sementara simulator Wokwi jalan di cloud — supaya
   terjangkau lewat HTTP POST biasa, backend harus diekspos lewat tunnel
   (ngrok/localtunnel).
2. **Tunnel gratis terbukti tidak stabil** untuk pemakaian ini: `ngrok
   http` di akun gratis selalu redirect `307` ke HTTPS (tidak bisa
   dipakai sama sekali karena Wokwi butuh HTTP polos); `ngrok tcp` butuh
   verifikasi kartu kredit; **localtunnel** awalnya berhasil (`HTTP
   status: 201`, data masuk ke database, diverifikasi lewat query
   langsung), tapi pada percobaan-percobaan berikutnya proses
   localtunnel-nya sendiri sering mati tanpa alasan jelas, dan bahkan
   saat prosesnya hidup, request dari Wokwi berulang kali mendapat
   `HTTP status: 408`/`502`/`503` (dikonfirmasi juga lewat `curl` langsung
   ke URL tunnel dari komputer yang sama, bukan cuma dari simulator
   Wokwi) — jadi bukan masalah di kode sketch atau backend.
3. **MQTT menghindari masalah ini sepenuhnya**: baik simulator Wokwi
   maupun backend sama-sama cuma membuat koneksi **keluar** ke broker
   publik (port 1883, plain TCP — diizinkan Wokwi karena bukan TLS).
   Tidak ada yang perlu menerima koneksi masuk, jadi tidak perlu tunnel
   sama sekali.

### Ingest ke backend asli lewat MQTT (sudah diverifikasi)

Hasilnya **berhasil end-to-end dan stabil** — Serial Monitor Wokwi
menunjukkan `MQTT publish result: OK` tiap 5 detik, dan tiap pesan
benar-benar masuk ke database SQLite backend asli (dikonfirmasi lewat log
`[mqtt] Reading tersimpan (id=..., deviceId=..., ts=...)` di backend, id
bertambah terus selama simulasi berjalan).

Cara menjalankan:

1. Isi `MQTT_BROKER_URL` dan `MQTT_TOPIC` di `backend/.env` (lihat
   `.env.example` — topic **harus** unik per instalasi karena
   `broker.hivemq.com` publik dan dipakai banyak orang; kalau dua orang
   pakai topic yang sama, data akan tercampur).
2. Jalankan backend (`npm start` di folder `backend`) — subscriber MQTT
   otomatis aktif kalau `MQTT_BROKER_URL` terisi.
3. Samakan `MQTT_TOPIC` di `sketch.ino` dengan nilai di `backend/.env`,
   lalu jalankan simulasi Wokwi seperti biasa.
4. Kalau ingin device muncul sebagai device default dashboard
   (`ecosense-01`, dipakai `/api/latest` & `/api/status` saat tidak ada
   query `deviceId`), ganti juga `DEVICE_ID` di sketch dari
   `"ecosense-01-sim"` ke `"ecosense-01"`.

File `sketch.ino` yang di-commit ke repo ini memakai topic demo bersama
`ecosense-station-demo/ingest` — ganti sebelum pemakaian sungguhan supaya
tidak bentrok dengan pengguna lain.

## Status pengujian (sudah dicoba langsung di wokwi.com)

- **Board & wiring**: sama seperti `../../Aplikasi-Pendeteksi-Buronan/ecosense-station-wokwi`
  yang sudah tervalidasi — tipe board `board-esp32-devkit-c-v4`, semua part
  (DHT22, HC-SR04, dua potentiometer, pushbutton, LCD1602 I2C, LED, buzzer
  langsung GPIO) ter-render dan tersambung tanpa indikator putus.
- **Compile penuh dengan library asli terpasang** (`ArduinoJson.h`, `DHT.h`,
  `LiquidCrystal_I2C.h`, `PubSubClient.h` — bukan stub) sudah dicoba dan
  **berhasil**. `ArduinoJson`/`DHT`/`LiquidCrystal_I2C` lewat tombol
  "Install ... Library" di dialog "Build failed!" (tidak butuh sign-in);
  `PubSubClient` lewat panel Library Manager (tombol `+`, cari nama,
  pilih hasil yang namanya persis "PubSubClient"). `WiFi.h` sudah bawaan
  core ESP32 (tidak perlu Library Manager).
- Simulasi dijalankan ulang setelah keempat library terpasang dan
  **berhasil end-to-end lewat MQTT**, terlihat di Serial Monitor:
  ```
  EcoSense Station - Wokwi WiFi+MQTT sim ready
  dist_cm=-1.00 water_cm=-1.00 wifi=down mqtt=down
  MQTT: mencoba konek sebagai ecosense-wokwi-af1ee385
  MQTT: terhubung ke broker
  dist_cm=-1.00 water_cm=-1.00 wifi=up mqtt=up
  MQTT PUBLISH -> ecosense-station-demo/ingest
  Payload: {"deviceId":"ecosense-01-sim","apiKey":"wokwi-sim-key","distanceCm":null,
  "waterHeightCm":null,"ph":7,"turbidityNtu":100,"flowLpm":0,"volumeL":0,"tempC":null,
  "rh":null,"lowWaterAlarm":false,"phAlarm":false,"turbAlarm":false}
  MQTT publish result: OK
  ```
  Ini mengonfirmasi: WiFi berhasil konek ke `Wokwi-GUEST`, broker MQTT
  publik (`broker.hivemq.com:1883`, plain TCP) berhasil dijangkau dari
  dalam simulator Wokwi (berbeda dari HTTPS yang selalu gagal), payload
  JSON terbentuk benar (field NAN dikirim sebagai `null`), dan publish
  MQTT berhasil terus-menerus tiap 5 detik tanpa error.
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
- **Ingest ke backend asli**: sudah diverifikasi penuh lewat MQTT (tanpa
  tunnel sama sekali) — lihat bagian "Ingest ke backend asli lewat MQTT
  (sudah diverifikasi)" di atas untuk detail lengkapnya. Data dari Wokwi
  (`deviceId: "ecosense-01"` setelah DEVICE_ID disamakan dengan default
  dashboard) muncul live di dashboard `http://localhost:3000/` — status
  "Online", pH & Turbidity ikut berubah saat pot diputar, kartu nilai
  ter-update tiap 10 detik dan grafik ikut auto-refresh.
- **Belum diverifikasi**: tampilan visual LCD (teks tidak sempat dibaca
  jelas dari screenshot, meski render & wiring-nya tidak error), dan
  reload halaman Wokwi dari URL project untuk memastikan perubahan
  tersimpan permanen (sesi uji coba ini anonim, perubahan di editor hanya
  berlaku untuk sesi berjalan kecuali disimpan manual oleh pemilik akun).

## Perbedaan dengan firmware fisik (`../firmware/esp32-wifi`)

Firmware fisik memakai HTTP POST langsung ke backend (perangkat fisik di
jaringan WiFi asli tidak punya keterbatasan HTTPS/TLS seperti Wokwi, dan
biasanya 1 arah ke 1 backend saja sehingga tidak perlu broker MQTT publik
dengan risiko topic bentrok). Wokwi memakai MQTT karena keterbatasan
simulator (lihat bagian "Kenapa pakai MQTT" di atas).

| Konstanta | Wokwi (`wokwi/sketch.ino`) | Fisik (`firmware/esp32-wifi/esp32-wifi.ino`) |
| --- | --- | --- |
| `WIFI_SSID` / `WIFI_PASSWORD` | `"Wokwi-GUEST"` / `""` | WiFi asli lokasi Anda |
| Jalur kirim data | MQTT ke `broker.hivemq.com:1883` | HTTP POST ke `INGEST_URL` backend asli Anda |
| `DEVICE_API_KEY` | `"wokwi-sim-key"` (bebas, dikirim di field `apiKey`) | harus sama dengan `backend/.env`, dikirim di header `x-api-key` |

Logika sensor, kalibrasi, alarm, dan LCD identik dengan firmware fisik.
