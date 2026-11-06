# PRD: EcoSense Station — Telegram & Web Monitoring

**Status:** Draft v1
**Lingkup:** Lanjutan dari hardware/firmware EcoSense Station (ESP32 + sensor
reservoir) yang sudah ada. PRD ini mencakup penambahan (1) integrasi Telegram
bot untuk notifikasi & cek status, dan (2) website monitoring real-time &
histori.

---

## 1. Visi & Tujuan Produk

### Visi Produk

EcoSense Station membantu pengelola reservoir/tandon air skala kecil—menengah
(rumah tangga, komunitas, UMKM budidaya, sekolah/kampus) memantau ketinggian
air, kualitas air (pH, kekeruhan), aliran/volume, serta suhu & kelembapan
udara sekitar reservoir secara real-time, tanpa harus datang langsung ke
lokasi. Data dari perangkat ESP32 dikirim ke server, ditampilkan di website
monitoring, dan kondisi abnormal (air rendah, kualitas air di luar ambang)
langsung diberitahukan lewat Telegram agar pengguna bisa bertindak cepat.

### Tujuan Utama

1. **Visibilitas real-time** — pengguna bisa melihat kondisi reservoir
   terkini dari mana saja, bukan hanya dari LCD lokal di perangkat.
   *Indikator:* data terbaru di web dashboard tidak lebih dari 1 menit
   tertinggal dari pembacaan sensor asli.
2. **Notifikasi proaktif** — pengguna tahu saat air rendah atau kualitas air
   bermasalah tanpa harus terus-menerus mengecek.
   *Indikator:* notifikasi Telegram terkirim dalam ≤30 detik sejak alarm
   aktif di perangkat.
3. **Histori terpakai untuk keputusan** — pengguna bisa melihat tren
   ketinggian air, pH, turbidity, dan pemakaian air (volume) dari waktu ke
   waktu.
   *Indikator:* histori minimal 30 hari tersedia dan bisa difilter per
   rentang tanggal di dashboard.
4. **Setup mudah untuk non-developer** — memasang bot Telegram dan mengakses
   dashboard tidak memerlukan keahlian teknis di luar mengikuti panduan.
   *Indikator:* pengguna baru bisa menerima notifikasi pertama dan membuka
   dashboard dalam <15 menit mengikuti README.

### Value Proposition

- Satu alat ESP32 murah menggantikan kebutuhan datang fisik ke lokasi
  reservoir untuk sekadar cek kondisi.
- Notifikasi lewat Telegram (bukan aplikasi mobile khusus) — langsung jalan
  di HP yang sudah dipakai sehari-hari, tanpa instalasi app store.
- Dashboard web ringan, bisa diakses dari browser apa pun tanpa perlu
  instalasi software tambahan di sisi pengguna.

---

## 2. User Persona

### Persona 1: Pak Darto — Pengelola Tandon Komunitas

- **Usia/Pekerjaan:** 45 tahun, ketua RT/pengelola tandon air komunal warga.
- **Level Teknis:** Pemula. Terbiasa pakai WhatsApp/Telegram, tidak terbiasa
  membaca dashboard teknis yang rumit.
- **Tujuan:** Tahu kalau tandon mau habis sebelum warga komplain air mati,
  dan tahu kalau ada masalah kualitas air sebelum dikonsumsi warga.
- **Pain Points:** Harus jalan ke lokasi tandon untuk cek manual, sering
  terlambat tahu air habis di malam hari, tidak ada catatan riwayat
  pemakaian air.
- **Motivasi:** Ingin notifikasi simpel di HP ("air tandon mau habis") tanpa
  perlu buka aplikasi atau belajar istilah teknis.

### Persona 2: Rina — Mahasiswa/Hobbyist IoT & Budidaya

- **Usia/Pekerjaan:** 22 tahun, mahasiswa teknik yang menjalankan proyek
  budidaya ikan/hidroponik skala kecil sebagai sampingan.
- **Level Teknis:** Menengah—mahir. Nyaman coding, pernah pakai ESP32,
  familiar dengan konsep API/webhook.
- **Tujuan:** Memonitor kualitas air kolam (pH, turbidity, suhu) dari kamar
  kos, melihat tren data untuk laporan/tugas akhir, dan dapat alarm dini
  kalau parameter air keluar dari rentang aman untuk ikan/tanaman.
- **Pain Points:** Data sensor yang hanya tampil di LCD lokal tidak berguna
  kalau sedang tidak di lokasi; butuh data historis untuk analisis, bukan
  cuma snapshot sesaat.
- **Motivasi:** Ingin dashboard dengan grafik tren dan kemampuan menyesuaikan
  ambang alarm sendiri sesuai kebutuhan budidayanya.

---

## 3. User Stories

### Modul 1: Pengiriman & Penerimaan Data Perangkat

1. Sebagai pemilik perangkat, saya ingin ESP32 mengirim data sensor ke server
   secara berkala lewat WiFi, agar data tersedia di luar LCD lokal.
2. Sebagai pemilik perangkat, saya ingin pengiriman data diautentikasi dengan
   API key, agar orang lain tidak bisa mengirim data palsu ke akun saya.
3. Sebagai pemilik perangkat, saya ingin tahu kalau perangkat berhenti
   mengirim data (offline) dalam waktu lama, agar saya tahu ada gangguan
   jaringan/daya di lokasi.

### Modul 2: Notifikasi Telegram

4. Sebagai pengguna baru, saya ingin mendaftarkan chat Telegram saya ke bot
   dengan perintah `/start`, agar mulai menerima notifikasi.
5. Sebagai pengguna, saya ingin berhenti menerima notifikasi dengan `/stop`,
   agar tidak terus di-spam kalau sedang tidak butuh.
6. Sebagai pengguna, saya ingin menerima pesan otomatis saat alarm air
   rendah aktif, agar saya segera tahu tanpa harus membuka dashboard.
7. Sebagai pengguna, saya ingin menerima pesan otomatis saat alarm pH/
   turbidity aktif (setelah dikalibrasi & diaktifkan), agar saya tahu
   kualitas air bermasalah.
8. Sebagai pengguna, saya ingin menanyakan kondisi terkini lewat perintah
   `/status`, agar saya bisa cek kapan saja tanpa menunggu notifikasi.
9. Sebagai pengguna, saya tidak ingin menerima notifikasi berulang-ulang
   untuk alarm yang sama selama kondisi belum berubah, agar notifikasi
   tetap relevan dan tidak mengganggu.

### Modul 3: Dashboard Web — Monitoring Real-time

10. Sebagai pengguna, saya ingin melihat nilai terkini (tinggi air, pH,
    turbidity, flow/volume, suhu, kelembapan) di satu halaman web, agar
    saya tidak perlu ke lokasi perangkat.
11. Sebagai pengguna, saya ingin dashboard menunjukkan status alarm secara
    jelas (misalnya banner merah), agar saya langsung sadar ada masalah.
12. Sebagai pengguna, saya ingin dashboard memperbarui data secara otomatis
    tanpa saya refresh manual, agar informasi selalu terkini saat dibuka.
13. Sebagai pengguna, saya ingin tahu kapan data terakhir diterima dari
    perangkat, agar saya tahu kalau data yang ditampilkan sudah usang.

### Modul 4: Dashboard Web — Histori & Tren

14. Sebagai pengguna, saya ingin melihat grafik tren ketinggian air, pH,
    turbidity, dan suhu/kelembapan dalam rentang waktu tertentu, agar saya
    bisa menganalisis pola.
15. Sebagai pengguna, saya ingin melihat total volume air yang mengalir
    dalam periode tertentu, agar saya bisa memperkirakan konsumsi air.
16. Sebagai pengguna, saya ingin memfilter histori berdasarkan rentang
    tanggal, agar saya bisa fokus pada periode yang relevan.

### Modul 5: Konfigurasi

17. Sebagai pengguna teknis, saya ingin mengubah ambang alarm (air rendah,
    pH, turbidity) lewat konfigurasi backend, agar sesuai kebutuhan
    spesifik reservoir saya tanpa flash ulang firmware.

---

## 4. Functional Requirements

### Modul 1: Ingest Data Perangkat

**FR-01: Terima Data Sensor dari Perangkat**
- **Input:** JSON berisi waterHeightCm, distanceCm, ph, turbidityNtu,
  flowLpm, volumeL, tempC, rh, lowWaterAlarm, phAlarm, turbAlarm, timestamp
  perangkat (opsional), dikirim via `POST /api/ingest` dengan header
  `x-api-key`.
- **Proses:** Validasi API key, validasi tipe/rentang data dasar, simpan
  sebagai satu baris reading baru dengan timestamp server.
- **Output:** HTTP 201 dengan id reading, atau 401/400 jika gagal.
- **Aturan Bisnis:** Request tanpa API key valid ditolak. Reading dengan
  field wajib hilang ditolak (400), bukan disimpan sebagai data kosong.

**FR-02: Deteksi Perangkat Offline**
- **Input:** Timestamp reading terakhir yang tersimpan.
- **Proses:** Backend membandingkan waktu sekarang dengan timestamp reading
  terakhir secara berkala (job terjadwal).
- **Output:** Jika selisih > ambang offline (default 5 menit), tandai status
  perangkat sebagai "offline" dan kirim satu notifikasi Telegram.
- **Aturan Bisnis:** Notifikasi offline hanya dikirim sekali per transisi
  online→offline, bukan berulang selama tetap offline.

### Modul 2: Telegram Bot

**FR-03: Registrasi Chat (/start)**
- **Input:** Perintah `/start` dari user Telegram.
- **Proses:** Simpan chat ID ke daftar subscriber jika belum ada.
- **Output:** Pesan sambutan + ringkasan perintah yang tersedia.
- **Aturan Bisnis:** Chat ID duplikat tidak membuat entri ganda.

**FR-04: Berhenti Berlangganan (/stop)**
- **Input:** Perintah `/stop`.
- **Proses:** Hapus/nonaktifkan chat ID dari daftar subscriber.
- **Output:** Pesan konfirmasi berhenti.
- **Aturan Bisnis:** Chat yang sudah berhenti tidak menerima notifikasi
  apa pun sampai `/start` lagi.

**FR-05: Cek Status (/status)**
- **Input:** Perintah `/status` dari chat yang terdaftar.
- **Proses:** Ambil reading terbaru dari storage.
- **Output:** Pesan terformat berisi nilai terkini + status alarm + waktu
  data terakhir.
- **Aturan Bisnis:** Jika belum ada data sama sekali, balas pesan informatif
  ("belum ada data"), bukan error mentah.

**FR-06: Notifikasi Alarm Otomatis**
- **Input:** Perubahan status alarm (lowWaterAlarm/phAlarm/turbAlarm) pada
  reading baru dibanding reading sebelumnya.
- **Proses:** Deteksi transisi false→true (alarm baru aktif) dan true→false
  (alarm pulih) per jenis alarm.
- **Output:** Kirim pesan ke semua chat subscriber aktif saat transisi
  terjadi, berbeda teks untuk "aktif" vs "pulih".
- **Aturan Bisnis:** Tidak mengirim pesan berulang selama status alarm tidak
  berubah antar-reading.

### Modul 3: API Dashboard

**FR-07: Ambil Reading Terbaru**
- **Input:** `GET /api/latest`.
- **Proses:** Query reading dengan timestamp terbesar.
- **Output:** JSON reading terbaru + status online/offline perangkat.
- **Aturan Bisnis:** Jika belum ada data, kembalikan `null`/objek kosong
  dengan status 200, bukan error.

**FR-08: Ambil Histori Reading**
- **Input:** `GET /api/history?from=&to=&limit=` (query opsional).
- **Proses:** Query reading dalam rentang tanggal, urut waktu naik, batasi
  jumlah hasil sesuai `limit` (default & maksimum ditentukan backend).
- **Output:** Array reading terurut waktu.
- **Aturan Bisnis:** `limit` di luar batas wajar (mis. negatif atau sangat
  besar) di-clamp ke nilai default/maksimum, bukan menyebabkan error.

**FR-09: Ambil Status Alarm & Perangkat**
- **Input:** `GET /api/status`.
- **Proses:** Gabungkan status alarm terkini + status online/offline +
  waktu data terakhir.
- **Output:** JSON ringkas untuk header/banner dashboard.
- **Aturan Bisnis:** Status "offline" dihitung dari ambang waktu yang sama
  dengan FR-02.

**FR-10: Ubah Ambang Alarm**
- **Input:** `PUT /api/config/thresholds` dengan body ambang baru (low
  water cm, pH min/max, turbidity max), terautentikasi admin (API key
  admin terpisah dari API key perangkat).
- **Proses:** Validasi nilai masuk akal, simpan ke config storage.
- **Output:** Config tersimpan dikembalikan sebagai konfirmasi.
- **Aturan Bisnis:** Config tanpa autentikasi admin ditolak (401).

### Modul 4: Web Dashboard (Frontend)

**FR-11: Halaman Ringkasan Real-time**
- **Input:** Data dari `GET /api/latest` dan `GET /api/status`.
- **Proses:** Polling berkala (default setiap 10 detik) dan render ulang
  nilai di halaman.
- **Output:** Kartu nilai untuk setiap parameter + indikator online/offline.
- **Aturan Bisnis:** Jika fetch gagal (server tidak terjangkau), tampilkan
  pesan status "tidak bisa terhubung" alih-alih membiarkan data lama tanpa
  keterangan.

**FR-12: Banner Alarm**
- **Input:** Field alarm dari `GET /api/status`.
- **Proses:** Evaluasi apakah ada alarm aktif.
- **Output:** Banner visual mencolok (warna merah) berisi jenis alarm aktif
  saat ada, tersembunyi saat tidak ada alarm aktif.
- **Aturan Bisnis:** Banner menampilkan semua alarm aktif sekaligus jika
  lebih dari satu aktif bersamaan.

**FR-13: Grafik Tren Historis**
- **Input:** Data dari `GET /api/history` sesuai filter tanggal yang dipilih
  pengguna.
- **Proses:** Render grafik garis per parameter (tinggi air, pH, turbidity,
  suhu/kelembapan) menggunakan data histori.
- **Output:** Grafik interaktif (hover untuk lihat nilai per titik waktu).
- **Aturan Bisnis:** Rentang tanggal default menampilkan 7 hari terakhir
  jika pengguna belum memilih filter.

**FR-14: Filter Rentang Tanggal**
- **Input:** Tanggal awal & akhir dari pengguna di dashboard.
- **Proses:** Kirim ulang request `GET /api/history` dengan parameter
  tanggal baru.
- **Output:** Grafik & ringkasan volume diperbarui sesuai rentang terpilih.
- **Aturan Bisnis:** Tanggal awal tidak boleh setelah tanggal akhir; jika
  terjadi, tampilkan pesan validasi di UI tanpa mengirim request.

**FR-15: Ringkasan Volume Air**
- **Input:** Data histori dalam rentang terpilih.
- **Proses:** Hitung total/selisih volume air (dari field volumeL
  kumulatif) dalam rentang tersebut.
- **Output:** Angka ringkasan "total pemakaian air periode ini".
- **Aturan Bisnis:** Jika data tidak cukup (misalnya hanya satu titik),
  tampilkan "data belum cukup" alih-alih angka menyesatkan.

### Modul 5: Firmware (Pembaruan)

**FR-16: Kirim Data via WiFi**
- **Input:** Hasil pembacaan sensor yang sudah dihitung firmware (sama
  seperti yang sebelumnya hanya ditampilkan di LCD/Serial).
- **Proses:** Hubungkan ke WiFi, kirim `POST` JSON ke endpoint ingest server
  setiap interval tertentu (default selaras dengan siklus baca sensor yang
  sudah ada).
- **Output:** Data tersimpan di server; LCD & Serial tetap berfungsi seperti
  sebelumnya sebagai fallback lokal.
- **Aturan Bisnis:** Kegagalan kirim (WiFi putus/server tidak terjangkau)
  tidak boleh memblokir loop utama firmware (pembacaan sensor & LCD lokal
  tetap jalan).

**FR-17: Konfigurasi Kredensial di Firmware**
- **Input:** SSID, password WiFi, URL server, API key perangkat.
- **Proses:** Disimpan sebagai konstanta/`#define` yang jelas ditandai perlu
  diisi pengguna sebelum flashing ke perangkat fisik.
- **Output:** Firmware siap connect begitu nilai diisi.
- **Aturan Bisnis:** Nilai placeholder default tidak boleh berupa kredensial
  nyata siapa pun.

---

## 5. Non-Functional Requirements

### Performa

- Endpoint `GET /api/latest` dan `GET /api/status` merespons < 500ms pada
  kondisi normal (data lokal, bukan beban tinggi).
- Dashboard melakukan polling, bukan long-request yang memblokir; interval
  polling dapat dikonfigurasi (default 10 detik untuk ringkasan, histori
  hanya diambil ulang saat filter berubah).
- Backend menangani minimal 1 perangkat aktif mengirim data setiap 1–5
  detik tanpa penurunan performa — ini adalah sistem skala kecil (bukan
  multi-tenant ribuan perangkat).

### Keamanan

- Endpoint ingest (`POST /api/ingest`) wajib API key perangkat; endpoint
  konfigurasi (`PUT /api/config/thresholds`) wajib API key admin terpisah.
- API key disimpan sebagai environment variable di server, tidak
  di-hardcode di source code yang di-commit.
- Token bot Telegram disimpan sebagai environment variable, tidak pernah
  dicetak ke log atau ditampilkan di UI.
- Dashboard web versi awal bersifat read-only publik di jaringan lokal/
  privat pengguna (tidak ada data pribadi sensitif); autentikasi
  pengguna dashboard di luar scope v1 (lihat bagian 6).

### Skalabilitas

- Target awal: 1 perangkat per deployment backend (rumah tangga/komunitas
  kecil). Desain data model memakai `deviceId` agar bisa diperluas ke
  multi-perangkat di versi mendatang tanpa migrasi besar.
- Storage awal cukup dengan database file-based (mis. SQLite) — tidak perlu
  infrastruktur database terpisah untuk skala target ini.

### Usability

- Pesan Telegram dan teks dashboard berbahasa Indonesia.
- Dashboard responsif untuk dibuka dari HP maupun desktop (pengguna seperti
  Pak Darto kemungkinan besar membuka dari HP).
- Status "offline"/"tidak ada data" selalu ditampilkan dengan jelas, tidak
  pernah dibiarkan kosong tanpa keterangan.

---

## 6. Out of Scope & Dependensi

### Out of Scope (Tidak Dikerjakan di V1)

- Autentikasi multi-user untuk dashboard web (login/role) — v1 dashboard
  read-only tanpa login, diasumsikan diakses di jaringan privat/dengan URL
  yang tidak disebar publik.
- Dukungan multi-perangkat/multi-reservoir dalam satu dashboard — v1 fokus
  satu perangkat.
- Kontrol aktuator dari jarak jauh (mis. menyalakan pompa dari Telegram/web)
  — v1 hanya monitoring & notifikasi, bukan kendali.
- Kalibrasi pH/turbidity otomatis dari dashboard — kalibrasi tetap manual
  lewat konstanta firmware sesuai dokumentasi hardware yang sudah ada.
- Aplikasi mobile native (Android/iOS) — notifikasi cukup lewat Telegram,
  monitoring cukup lewat web responsif.
- Penyimpanan data jangka panjang tak terbatas / data warehouse — retensi
  histori v1 dibatasi (mis. 30–90 hari) untuk menjaga ukuran storage.

### Dependensi

- **Hardware & firmware EcoSense Station** (ESP32 + sensor) yang sudah ada
  di proyek `ecosense-station-wokwi` — PRD ini menambah kemampuan kirim data
  WiFi di atas firmware tersebut, bukan menggantikannya.
- **Telegram Bot API** (lewat BotFather) — untuk notifikasi & perintah
  `/status`; butuh koneksi internet dari server backend ke Telegram.
- **Koneksi WiFi di lokasi reservoir** — perangkat ESP32 butuh akses WiFi
  dengan internet untuk mengirim data ke server.
- **Hosting backend** — server Node.js perlu berjalan terus-menerus (mis.
  di jaringan lokal/Raspberry Pi/VPS kecil) agar bisa menerima data kapan
  saja dan membalas perintah Telegram.
- **Library Arduino**: WiFi client bawaan ESP32 + `HTTPClient` + `ArduinoJson`
  (untuk encode payload), di luar library sensor yang sudah dipakai
  sebelumnya (DHT, LiquidCrystal_I2C).

### Asumsi

- Perangkat ESP32 dan server backend berada dalam jangkauan jaringan WiFi
  yang sama atau server dapat diakses dari jaringan tempat ESP32 berada
  (lewat internet/VPN/port forwarding sesuai setup pengguna).
- Pengguna memiliki akun Telegram aktif dan bisa membuat bot lewat
  BotFather sendiri (token bot adalah kredensial milik pengguna, bukan
  dibagikan).
- Satu backend melayani satu perangkat fisik untuk v1; kebutuhan
  multi-perangkat ditangani di iterasi berikutnya.
- Kalibrasi pH/turbidity nyata (bukan placeholder) sudah/akan dilakukan
  terpisah sesuai catatan di dokumentasi hardware yang sudah ada — PRD ini
  tidak mengubah proses kalibrasi tersebut.
