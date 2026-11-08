# AI Agent Layanan & CRM Awards — Demo MSI-A1A6 (SIMULASI)

> **SIMULASI.** Semua data, nama perusahaan, dan aturan di repo ini fiktif. Tidak ada pesan nyata yang dikirim.

Demo AI agent layanan awards (A1) yang terhubung ke CRM prospek (A6), dibangun dengan n8n dan Google Sheets.
Rencana lengkap: [docs/PERENCANAAN.md](docs/PERENCANAAN.md).

## Struktur repo

```
docs/       Dokumen perencanaan dan panduan staf
seed/       Data awal CSV, satu file per sheet Google Spreadsheet
n8n/        Workflow JSON (workflows/), system prompt (prompts/), kode Code node (code/)
web/        Situs publik (index.html, template Eventify) dan panel admin (admin/, template Duralux), config.js
scripts/    Script Python: uji otomatis dan reset seed
```

## Prasyarat

- Docker Desktop (atau Docker Engine + Compose v2)
- Python 3.11 atau lebih baru (untuk `scripts/`)
- Akun Google (Google Sheets) dan API key Claude — dipasang di n8n, bukan di repo

## Langkah setup

1. **Siapkan file `.env`.** Salin `.env.example` menjadi `.env`, lalu isi `N8N_ENCRYPTION_KEY` dengan string acak:
   ```
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
   Jangan ganti kunci ini setelah kredensial dipasang.
2. **Jalankan n8n dengan Docker.**
   ```
   docker compose up -d
   ```
   Buka http://localhost:5678 dan buat akun owner lokal. Port hanya terbuka di localhost.
   Menghentikan: `docker compose down` (data n8n tetap tersimpan di volume `n8n_data`).
3. Buat Google Spreadsheet dan impor seed — _belum diisi_
4. Pasang kredensial di n8n — _belum diisi_
5. **Rakit dan pasang workflow.** Workflow dirakit dari sumber di `n8n/prompts/` dan `n8n/code/`:
   ```
   python scripts/build_workflows.py
   ```
   - Pertama kali: di n8n, **Create > Workflow > ⋯ > Import from File**, pilih file di `n8n/workflows/`,
     pasang kredensial di node Google Sheets dan "Panggil Claude", lalu **Publish**.
   - Perubahan berikutnya: isi `N8N_API_KEY` di `.env` (n8n: Settings > n8n API), lalu
     `python scripts/deploy_workflows.py`. Kredensial yang sudah terpasang dipertahankan dan versi baru langsung di-publish.
6. **Buka halaman web.** Pastikan workflow WF-01 sudah di-publish di n8n, lalu:
   ```
   cd web
   python -m http.server 8000 --bind 127.0.0.1
   ```
   Buka **http://localhost:8000** (situs publik; panel admin di `/admin/`, tanpa login) (bukan `127.0.0.1:8000` dan bukan membuka file langsung: webhook hanya
   mengizinkan origin `WEB_ORIGIN` di `.env`). Alamat n8n diatur di `web/config.js`.
7. **Jalankan uji otomatis.** Uji dimulai dengan reset seed (semua data demo ditulis ulang dari `seed/`):
   ```
   python scripts/run_tests.py          # minta konfirmasi RESET
   python scripts/run_tests.py --ya     # tanpa konfirmasi
   ```
   Hasil tersimpan di `bukti/hasil_uji_<waktu>.txt` dan `.json`. Uji unit tanpa n8n: `node --test "n8n/code/*.test.js"`.
   Reset saja: `python scripts/reset_seed.py`.

## Catatan repo publik

Repo ini tidak menyertakan file template pihak ketiga (Eventify, Duralux) karena lisensinya tidak mengizinkan penyebaran, jadi halaman web tidak bisa dijalankan dari repo. Tampilan ditinjau lewat rekaman dan screenshot; kode buatan sendiri tetap ada di `web/`.

## Keamanan

- API key dan akses Google hanya disimpan di credential store n8n.
- File `.env` tidak pernah di-commit (tercantum di `.gitignore`).
- n8n hanya diakses lewat localhost.
