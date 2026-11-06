# AI Agent Layanan & CRM Awards — Demo MSI-A1A6 (SIMULASI)

> **SIMULASI.** Semua data, nama perusahaan, dan aturan di repo ini fiktif. Tidak ada pesan nyata yang dikirim.

Demo AI agent layanan awards (A1) yang terhubung ke CRM prospek (A6), dibangun dengan n8n dan Google Sheets.
Rencana lengkap: [docs/PERENCANAAN.md](docs/PERENCANAAN.md).

## Struktur repo

```
docs/       Dokumen perencanaan dan panduan staf
seed/       Data awal CSV, satu file per sheet Google Spreadsheet
n8n/        Workflow JSON (workflows/), system prompt (prompts/), kode Code node (code/)
web/        Halaman chat, panel staf, dan dashboard (index.html + config.js)
scripts/    Script Python: uji otomatis dan reset seed
```

## Prasyarat

_Belum diisi._

## Langkah setup

1. Siapkan file `.env` — _belum diisi_
2. Jalankan n8n dengan Docker — _belum diisi_
3. Buat Google Spreadsheet dan impor seed — _belum diisi_
4. Pasang kredensial di n8n — _belum diisi_
5. Import workflow — _belum diisi_
6. Buka halaman web — _belum diisi_
7. Jalankan uji otomatis — _belum diisi_

## Keamanan

- API key dan akses Google hanya disimpan di credential store n8n.
- File `.env` tidak pernah di-commit (tercantum di `.gitignore`).
- n8n hanya diakses lewat localhost.
