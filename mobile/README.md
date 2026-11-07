# EcoSense Station — Mobile (Flutter)

Aplikasi mobile untuk monitoring reservoir EcoSense Station secara
real-time: tinggi air, pH, turbidity, flow, volume kumulatif, suhu, dan
kelembapan. Konsumsi API dari backend yang sama dengan dashboard web
(`../backend`), jadi butuh backend tersebut berjalan lebih dulu.

## Cara pakai

1. Jalankan backend (lihat `../backend/README.md` kalau ada, singkatnya:
   `cd ../backend && npm install && npm start` — defaultnya di
   `http://localhost:3000`).
2. Jalankan aplikasi:
   ```
   flutter pub get
   flutter run
   ```
3. Di tab **Pengaturan**, isi alamat backend:
   - Emulator Android: `http://10.0.2.2:3000` (default, sudah terisi).
   - HP fisik / web / desktop: `http://<IP-lokal-komputer>:3000` — HP dan
     komputer backend harus di jaringan WiFi yang sama.
   - iOS Simulator / desktop (macOS/Windows/Linux) di komputer yang sama
     dengan backend: `http://localhost:3000` atau `http://127.0.0.1:3000`.
   
   Tekan **Tes Koneksi** untuk memastikan berhasil sebelum **Simpan**.

## Struktur

- `lib/models/reading.dart` — model data pembacaan sensor & status alarm,
  mengikuti bentuk JSON dari `backend/src/routes/*`.
- `lib/services/api_service.dart` — klien HTTP ke `/api/latest`,
  `/api/status`, `/api/history`; base URL disimpan lewat
  `shared_preferences`.
- `lib/screens/dashboard_screen.dart` — kartu metrik real-time (polling
  tiap 10 detik) + banner alarm.
- `lib/screens/history_screen.dart` — grafik tren (fl_chart) untuk rentang
  24 jam / 7 hari / 30 hari.
- `lib/screens/settings_screen.dart` — konfigurasi & tes alamat backend.

## Catatan

- Backend EcoSense Station **tidak** di-deploy ke internet publik secara
  default (lihat `../wokwi/README.md` soal keterbatasan tunnel gratis),
  jadi aplikasi ini perlu diarahkan ke alamat LAN backend-nya, bukan
  domain publik.
- Notifikasi alarm realtime (push notification) tidak diimplementasikan di
  app ini — untuk notifikasi alarm instan, gunakan bot Telegram
  (`../backend/src/telegram.js`, kirim `/start` ke bot EcoSense Station).
  Tab Dashboard & Histori di app ini untuk monitoring aktif (buka app lalu
  lihat datanya), bukan notifikasi background.
