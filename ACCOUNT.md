# Akun — EcoSense Station Dashboard

Akun login web dashboard disimpan di SQLite `backend/data/ecosense.db` (tabel `users`),
bukan di `.env`. Password di-hash (`scrypt`) — tidak bisa dibaca ulang dari database.

| Username | Role | Password | Dibuat |
|---|---|---|---|
| admin | admin | `ecosense123` (default seed — ganti kalau sudah pernah diganti lewat halaman Account) | 7/11/2026 |
| operator1 | viewer | Tidak diketahui — dibuat manual lewat Account > Tambah pengguna, password tidak pernah dicatat di sini | 7/11/2026 |

## Soal akun admin

Akun `admin` dibuat otomatis saat backend pertama kali jalan dan tabel `users` masih kosong
(lihat `backend/src/server.js:39-47`). Username & password default diambil dari
`ADMIN_USERNAME` / `ADMIN_PASSWORD` di `.env` kalau di-set, kalau tidak jatuh ke
`admin` / `ecosense123`. `.env` saat ini tidak men-set keduanya, jadi password aslinya
`ecosense123` **kecuali** sudah diganti lewat menu Account > "Ganti password saya" di dashboard.

## Role

Hanya ada 2 role:

- **admin** — akses penuh: ubah ambang batas alarm (Peringatan), kelola pengguna (tambah/hapus/ganti password siapa saja), ubah preferensi polling (Settings).
- **viewer** — read-only: bisa lihat Home/Monitoring/Simulasi/Data, tapi form ambang batas & kelola pengguna disembunyikan/dinonaktifkan.

## Reset / ganti password

- Ganti password sendiri: login → menu **Account** → "Ganti password saya".
- Admin bisa hapus akun lalu buat ulang lewat **Account** > "Tambah pengguna" kalau password sebuah akun (misalnya `operator1`) sudah tidak diketahui — tidak ada fitur "lupa password" / reset via email di versi ini.

## Menambah akun baru

Lewat UI saja (tidak ada script seed terpisah seperti di proyek Buronan): login sebagai admin →
**Account** → "Tambah pengguna" → isi username, password, pilih role (admin/viewer).

## Keamanan

File ini berisi kredensial **testing/dev lokal saja**. Segera ganti password default `admin`
sebelum dashboard ini diakses dari luar jaringan lokal, dan jangan commit `.env` atau
`backend/data/*.db` ke git (sudah ada di `.gitignore`).
