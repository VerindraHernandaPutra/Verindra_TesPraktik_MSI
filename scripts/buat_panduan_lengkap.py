"""Membuat docs/PANDUAN_LENGKAP.md: panduan copy-paste dari folder kosong sampai uji 27/27.

Isi setiap file kode disalin OTOMATIS dari repo, sehingga panduan selalu sama dengan kode yang teruji.
Jalankan ulang setelah kode berubah:  python scripts/buat_panduan_lengkap.py
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BAHASA = {".py": "python", ".js": "javascript", ".json": "json", ".md": "markdown", ".csv": "csv",
          ".yml": "yaml", ".html": "html", ".example": "bash", "": "text"}

FOLDER = [
    "docs", "seed", "web", "scripts", "n8n/workflows", "n8n/prompts",
    "n8n/code/wf01", "n8n/code/wf02", "n8n/code/wf03", "n8n/code/wf04", "n8n/code/wf05", "n8n/code/wf90",
]


def blok_file(path: str, keterangan: str) -> str:
    isi = (ROOT / path).read_text(encoding="utf-8").replace("\r\n", "\n")
    terpanjang = max([len(m) for m in re.findall(r"`+", isi)] + [2])
    pagar = "`" * max(3, terpanjang + 1)
    nama = Path(path).name
    bahasa = BAHASA.get(Path(path).suffix if not nama.startswith(".") else Path(nama).suffix, "text")
    if nama == ".gitignore":
        bahasa = "text"
    return f"#### `{path}`\n\n{keterangan}\n\n{pagar}{bahasa}\n{isi.rstrip()}\n{pagar}\n"


def daftar_file(*pasangan: tuple[str, str]) -> str:
    return "\n".join(blok_file(p, k) for p, k in pasangan)


def bagian_error() -> str:
    teks = (ROOT / "docs/PANDUAN_REPRODUKSI.md").read_text(encoding="utf-8")
    m = re.search(r"## 5\. Error yang pernah terjadi dan solusinya\n(.*?)\n---", teks, re.S)
    return m.group(1).strip() if m else "(lihat docs/PANDUAN_REPRODUKSI.md Bagian 5)"


def main() -> None:
    perintah_folder = "New-Item -ItemType Directory -Force " + ", ".join(FOLDER)
    bagian = []
    tambah = bagian.append

    tambah(f"""# Panduan Lengkap Membangun Aplikasi dari Nol (Copy-Paste)

**AI Agent Layanan & CRM Awards (SIMULASI MSI)** · dibuat otomatis oleh `scripts/buat_panduan_lengkap.py`

Panduan ini membawa Anda dari folder kosong sampai aplikasi berjalan dan **27 uji otomatis lulus**. Ikuti langkahnya **berurutan**; setiap langkah punya titik cek. Isi semua file kode di bawah disalin otomatis dari repo yang sudah teruji, jadi cukup salin-tempel apa adanya.

> **Cara menyalin file:** di VS Code buat file baru dengan path persis seperti judulnya (huruf besar/kecil berpengaruh), tempel seluruh isi blok kode, simpan dengan encoding UTF-8. Jangan menambah atau mengurangi apa pun.

> **Keamanan:** API key, client secret, dan token hanya diketik di `.env` atau di n8n. Jangan menempelnya ke chat, dokumen, atau screenshot. File `.env` tidak pernah di-commit.

## Daftar isi

- Langkah 0 – Pasang alat
- Langkah 1 – Folder proyek dan file dasar
- Langkah 2 – Data seed
- Langkah 3 – Jalankan n8n
- Langkah 4 – Google Cloud, spreadsheet, dan kredensial
- Langkah 5 – Prompt dan skema AI
- Langkah 6 – Modul kode bersama + uji unit
- Langkah 7 – Kode setiap workflow
- Langkah 8 – Script perakit, deploy, reset, dan uji
- Langkah 9 – Rakit dan pasang workflow ke n8n
- Langkah 10 – Isi data dan halaman web
- Langkah 11 – Uji akhir (27/27)
- Lampiran – Error yang mungkin muncul

---

## Langkah 0 – Pasang alat

| Alat | Unduh | Cek setelah dipasang (PowerShell) |
| --- | --- | --- |
| Git | git-scm.com | `git --version` |
| Docker Desktop | docker.com | `docker --version` lalu buka aplikasi Docker Desktop sampai statusnya *running* |
| Python 3.11+ | python.org (centang *Add to PATH*) | `python --version` |
| Node.js 20+ | nodejs.org (LTS) | `node --version` |
| VS Code | code.visualstudio.com | – |
| Ollama (opsional) | ollama.com | `ollama pull qwen2.5:3b` |

Siapkan juga: **akun Google** pribadi dan **API key Claude** dari console.anthropic.com (menu *API Keys*, akun harus punya saldo).

> Di macOS/Linux, ganti `python` dengan `python3` pada semua perintah.

---

## Langkah 1 – Folder proyek dan file dasar

**1.1** Buat folder proyek, misalnya `D:\\msi-a1a6-demo`, buka di VS Code (*File → Open Folder*), lalu buka terminal PowerShell di VS Code (*Terminal → New Terminal*) dan jalankan:

```powershell
git init -b main
{perintah_folder}
```

**1.2** Buat file-file berikut:

""")
    tambah(daftar_file(
        (".gitignore", "Daftar file yang tidak boleh masuk git, terutama `.env`."),
        (".env.example", "Contoh konfigurasi. File rahasia `.env` dibuat dari sini di Langkah 1.3."),
        ("docker-compose.yml", "Menjalankan n8n hanya di `127.0.0.1:5678` dengan zona waktu Asia/Jakarta."),
        ("README.md", "Ringkasan proyek dan langkah setup."),
        ("CLAUDE.md", "Aturan kerja untuk Claude Code (opsional bila tidak memakai Claude Code)."),
    ))
    tambah("""
**1.3** Buat file `.env` dari contohnya, lalu isi dua nilai acak:

```powershell
Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Buka `.env`, tempel hasil perintah pertama ke `N8N_ENCRYPTION_KEY=` dan hasil kedua ke `RESET_TOKEN=`. Biarkan `GOOGLE_SHEET_ID` dan `N8N_API_KEY` kosong dulu (diisi di Langkah 4).

> Jangan pernah mengganti `N8N_ENCRYPTION_KEY` setelah kredensial dipasang di n8n; kredensial lama tidak akan bisa dibuka.

---

## Langkah 2 – Data seed

Delapan file CSV, satu per sheet. Header harus persis seperti di bawah.

""")
    tambah(daftar_file(*[(f"seed/{n}.csv", d) for n, d in [
        ("KB", "Empat butir knowledge base."), ("Prospek", "Sepuluh prospek fiktif P01–P10 (status 3/3/3/1)."),
        ("Konfigurasi", "Tanggal simulasi, mode gagal, model AI."), ("Percakapan", "Header saja."),
        ("Antrean_Staf", "Header saja."), ("Draf", "Header saja."), ("Histori", "Header saja."), ("Log_Error", "Header saja."),
    ]]))
    tambah("""
---

## Langkah 3 – Jalankan n8n

```powershell
docker compose up -d
```

**Titik cek:** buka **http://localhost:5678**. Isi form *Set up owner account* (akun lokal, tidak dikirim ke mana pun). Lewati survei atau tawaran lisensi.

---

## Langkah 4 – Google Cloud, spreadsheet, dan kredensial

**4.1 Google Cloud** (console.cloud.google.com)
1. Buat project baru, mis. `msi-demo`.
2. *APIs & Services → Library*: aktifkan **Google Sheets API** dan **Google Drive API**.
3. *Google Auth Platform*: isi nama aplikasi `MSI Demo` dan email Anda, Audience **External**, selesaikan.
4. *Audience → Test users → Add users*: masukkan **Gmail yang sama** dengan yang akan dipakai login. *Publishing status* tetap **Testing**.
5. *Clients → Create client* → **Web application**. Kolom **Authorized JavaScript origins** dibiarkan kosong. Di **Authorized redirect URIs** tambahkan persis:
   ```
   http://localhost:5678/rest/oauth2-credential/callback
   ```
6. Simpan **Client ID** dan **Client Secret** sementara (jangan ke repo).

**4.2 Spreadsheet**
1. Di Google Sheets buat spreadsheet baru bernama `MSI Demo (SIMULASI)`.
2. Buat **8 tab** dengan nama persis: `KB`, `Prospek`, `Percakapan`, `Antrean_Staf`, `Draf`, `Histori`, `Konfigurasi`, `Log_Error`. Tab boleh kosong; isinya ditulis otomatis di Langkah 10.
3. Hapus tab bawaan *Sheet1* bila masih ada.
4. Salin ID spreadsheet dari URL (bagian di antara `/d/` dan `/edit`) ke `.env`: `GOOGLE_SHEET_ID=...`
5. Tombol *Share* → *General access* tetap **Restricted**.

**4.3 Kredensial di n8n** (Overview → panah di tombol *Create* → *Credential*). Ganti nama kredensial di kiri atas **persis** seperti ini:

| Nama | Jenis | Isi |
| --- | --- | --- |
| `Claude API (demo)` | Anthropic | API Key dari console.anthropic.com |
| `Google Sheets (demo)` | Google Sheets OAuth2 API | Client ID + Client Secret dari 4.1 → **Sign in with Google** → pilih akun → "Google hasn't verified this app" → **Continue** → centang semua izin |
| `Ollama lokal (demo)` (opsional) | Ollama | Base URL `http://host.docker.internal:11434` |

**Titik cek:** setiap kredensial menampilkan pesan hijau (*Connection tested successfully* / *Account connected*).

**4.4 API key n8n:** *Settings → n8n API → Create an API key* (label `msi-deploy-lokal`, centang semua scope *Workflow* bila ditanya). Tempel ke `.env`: `N8N_API_KEY=...`

---

## Langkah 5 – Prompt dan skema AI

Instruksi untuk Claude dan skema JSON jawaban. Penanda `[[...]]` diisi workflow saat berjalan.

""")
    tambah(daftar_file(
        ("n8n/prompts/agent_system.md", "System prompt agent: aturan AR-01–AR-08, topik, kapan eskalasi, format JSON."),
        ("n8n/prompts/draf_followup.md", "Prompt draf follow-up setelah chat (AR-08)."),
        ("n8n/prompts/draf_penawaran.md", "Prompt draf penawaran dari catatan AE (FR-23)."),
        ("n8n/prompts/skema_jawaban.json", "Skema structured outputs untuk jawaban agent."),
        ("n8n/prompts/skema_draf.json", "Skema structured outputs untuk draf."),
        ("n8n/prompts/README.md", "Catatan penanda dan pemakaian prompt."),
    ))
    tambah("""
---

## Langkah 6 – Modul kode bersama + uji unit

Kode JavaScript yang dipakai banyak workflow. Setiap modul punya file uji `*.test.js`.

""")
    tambah(daftar_file(
        ("n8n/code/pemeriksa_jawaban.js", "Pemeriksa jawaban tanpa AI (PJ-01–PJ-04): uang, tanggal, janji, rujukan; pengecualian sapaan."),
        ("n8n/code/pemeriksa_jawaban.test.js", "Uji unit pemeriksa (termasuk T-07)."),
        ("n8n/code/normalisasi_kunci.js", "Membentuk `kunci_normal` dan menormalkan ID prospek (anti-dobel)."),
        ("n8n/code/normalisasi_kunci.test.js", "Uji unit normalisasi (termasuk T-10)."),
        ("n8n/code/log_error.js", "Menyusun baris Log_Error dan menyamarkan pola kredensial."),
        ("n8n/code/log_error.test.js", "Uji unit penyusun log."),
        ("n8n/code/sheet_tulis.js", "Menyusun permintaan `spreadsheets.batchUpdate` (tambah baris, ubah sel, nomor ID)."),
        ("n8n/code/sheet_tulis.test.js", "Uji unit penyusun batchUpdate."),
        ("n8n/code/olah_data_sheet.js", "Mengubah respons `spreadsheets.get` menjadi tabel objek per kolom."),
        ("n8n/code/siapkan_log_error.js", "Node awal jalur gagal: mencatat node asal error."),
        ("n8n/code/susun_baris_log.js", "Node yang menyusun baris Log_Error."),
        ("n8n/code/periksa_draf.js", "Pemeriksa untuk draf AI (follow-up dan penawaran)."),
    ))
    tambah("""
**Titik cek:** jalankan uji unit.

```powershell
node --test "n8n/code/*.test.js"
```

Hasil yang benar di akhir keluaran: `pass 43` dan `fail 0`. Bila ada yang gagal, periksa kembali file yang disebut di pesan error (biasanya ada bagian yang terlewat saat menempel).

---

## Langkah 7 – Kode setiap workflow

Setiap file di bawah menjadi isi satu Code node di n8n. Folder menunjukkan workflow pemiliknya.

### WF-01 Agent chat (`POST /chat`)

""")
    tambah(daftar_file(*[(f"n8n/code/wf01/{n}.js", d) for n, d in [
        ("validasi_masukan", "Langkah 1: membaca dan memvalidasi body permintaan."),
        ("cek_permintaan_lama", "Idempotensi: id_permintaan yang sudah tercatat mengembalikan jawaban lama."),
        ("cari_prospek", "Mencari prospek per ID atau kunci_normal; menyiapkan prospek baru."),
        ("susun_prompt", "Menyisipkan KB ke prompt dan menyusun body Claude/Ollama."),
        ("ambil_teks_model", "Menyamakan respons Claude dan Ollama."),
        ("periksa_jawaban", "Menjalankan pemeriksa pada jawaban agent."),
        ("susun_prompt_draf", "Menyusun prompt draf follow-up."),
        ("cek_mode_gagal", "Error buatan bila MODE_GAGAL = TRUE (demo kegagalan)."),
        ("siapkan_penulisan", "Menyusun semua baris baru menjadi satu batchUpdate atomik."),
    ]]))
    tambah("\n### WF-02 Data panel (`GET /panel`)\n\n")
    tambah(daftar_file(
        ("n8n/code/wf02/validasi_peran.js", "Memvalidasi peran dan opsi ekspor."),
        ("n8n/code/wf02/susun_panel.js", "Ringkasan, antrean, draf, pengingat, ekspor; disaring per peran."),
    ))
    tambah("\n### WF-03 Keputusan dan status (`POST /approve`, `/prospek/status`, `/prospek/draf`)\n\n")
    tambah(daftar_file(*[(f"n8n/code/wf03/{n}.js", d) for n, d in [
        ("validasi_keputusan", "Validasi setuju/tolak/siap_kirim; hanya staf."),
        ("proses_keputusan", "Transisi status draf dan Histori draf_diputuskan."),
        ("validasi_status", "Validasi status pipeline dan peran."),
        ("proses_status", "Ubah status prospek (AE hanya miliknya) dan Histori ubah_status."),
        ("validasi_draf", "Validasi catatan AE."),
        ("susun_prompt_penawaran", "Prompt draf penawaran dari catatan AE."),
        ("siapkan_draf_penawaran", "Baris Draf + Histori draf_dibuat."),
    ]]))
    tambah("\n### WF-04 Pengingat harian, WF-05 Penanganan error, WF-90 Utilitas uji\n\n")
    tambah(daftar_file(
        ("n8n/code/wf04/tandai_pengingat.js", "Menandai kolom pengingat (Terlewat / Jatuh tempo hari ini)."),
        ("n8n/code/wf05/siapkan_log_wf05.js", "Error Trigger menjadi baris Log_Error."),
        ("n8n/code/wf90/susun_reset.js", "Menulis ulang semua sheet dari seed (data uji)."),
        ("n8n/code/wf90/validasi_konfigurasi.js", "Hanya MODE_GAGAL, MODEL_AI, TANGGAL_SIMULASI yang boleh diubah."),
        ("n8n/code/wf90/proses_konfigurasi.js", "Mengubah satu nilai Konfigurasi."),
        ("n8n/code/wf90/data_uji.js", "Membaca isi semua sheet untuk run_tests.py."),
    ))
    tambah("""
---

## Langkah 8 – Script perakit, deploy, reset, dan uji

""")
    tambah(daftar_file(
        ("scripts/build_workflows.py", "Merakit 6 workflow n8n (JSON) dari prompt, kode, dan `.env`."),
        ("scripts/deploy_workflows.py", "Memasang workflow ke n8n lewat Public API dan mewariskan kredensial."),
        ("scripts/reset_seed.py", "Mengembalikan spreadsheet ke data seed bersih."),
        ("scripts/run_tests.py", "Menjalankan 27 uji Section 13 dan menyimpan hasilnya ke `bukti/`."),
    ))
    tambah("""
---

## Langkah 9 – Rakit dan pasang workflow ke n8n

**9.1 Rakit workflow**

```powershell
python scripts/build_workflows.py
```

**Titik cek:** enam baris `Ditulis:` muncul, yaitu WF-01 (33 node), WF-02 (13), WF-03 (51), WF-04 (16), WF-05 (5), WF-90 (34). Bila muncul "Nilai berikut belum diisi di .env", lengkapi `.env` (Langkah 1.3 dan 4).

**9.2 Import WF-01 sekali secara manual** (agar script deploy punya contoh kredensial untuk diwariskan)
1. Di n8n: *Create → Workflow* → menu **⋯** kanan atas → *Import from File* → pilih `n8n/workflows/WF-01_agent_chat.json`.
2. Klik dua kali node **Baca Semua Sheet** → *Credential to connect with* → pilih `Google Sheets (demo)`.
3. Klik dua kali node **Panggil Claude** → *Credential for Anthropic* → pilih `Claude API (demo)`.
4. Klik **Save**. Jangan klik Publish dulu; node lain belum punya kredensial.

**9.3 Pasang semua workflow**

```powershell
python scripts/deploy_workflows.py
```

**Titik cek:** keluaran menyebut keenam workflow dengan `Status: versi terbaru sudah di-publish.` dan kredensial `Reset seed token (demo)` dibuat. Di n8n, keenam workflow tampil dengan status Published.

> Setiap kali kode di `n8n/` berubah: jalankan `build_workflows.py` lalu `deploy_workflows.py` lagi. Tidak perlu import ulang.

---

## Langkah 10 – Isi data dan halaman web

**10.1 Isi spreadsheet dari seed** (ketik `RESET` saat diminta):

```powershell
python scripts/reset_seed.py
```

**Titik cek:** `KB 4, Prospek 10, Konfigurasi 3`, sheet lain `0`. Buka spreadsheet: semua tab kini berisi header dan data.

**10.2 Buat file halaman web:**

""")
    tambah(daftar_file(
        ("web/config.js", "Alamat n8n dan daftar prospek untuk pemilih perusahaan. Tanpa kredensial."),
        ("web/index.html", "Satu halaman: tab Chat, Panel staf, Dashboard."),
    ))
    tambah("""
**10.3 Jalankan server halaman** (biarkan terminal ini tetap terbuka):

```powershell
cd web
python -m http.server 8000 --bind 127.0.0.1
```

Buka **http://localhost:8000** (harus `localhost`, bukan `127.0.0.1`).

**Titik cek manual:**
1. **Chat:** tanya `Apakah harus menjadi sponsor?` → jawaban dengan chip **KB03**. Tanya `Bisakah dijamin mendapat bintang 5?` → chip **KB04** + label kuning **Diteruskan ke staf**.
2. **Panel staf:** tiket eskalasi dan draf menunggu tampil; coba **Setujui** lalu **Tandai Siap kirim (simulasi)**.
3. **Dashboard:** ringkasan **3/3/3/1** dan AE **5/5** (pada seed bersih); pilih peran **AE A** → hanya 5 prospek.

---

## Langkah 11 – Uji akhir (27/27)

Buka terminal kedua di folder proyek (server halaman tetap berjalan):

```powershell
python scripts/run_tests.py
```

Ketik `RESET` saat diminta. Script mereset data lalu menjalankan 27 uji (sekitar 5 menit).

**Titik cek akhir:** baris terakhir `27/27 lulus` dan file hasil di `bukti/hasil_uji_<waktu>.txt`. Untuk perbandingan dengan Ollama tambahkan `--ollama`.

Simpan pekerjaan ke git:

```powershell
git add -A
git commit -m "Aplikasi MSI-A1A6 selesai: 27/27 uji lulus"
```

**Selesai.** Aplikasi berjalan penuh: chat agent, CRM anti-dobel, draf dengan persetujuan staf, dashboard, pengingat, ekspor CSV, penanganan gagal, dan uji otomatis.

Penjelasan teknis setiap komponen dan bahan presentasi ada di `docs/PANDUAN_REPRODUKSI.md`; rencana dan kebutuhan di `docs/PERENCANAAN.md`.

---

## Lampiran – Error yang mungkin muncul

""")
    tambah(bagian_error() + "\n")

    keluaran = ROOT / "docs/PANDUAN_LENGKAP.md"
    keluaran.write_text("".join(bagian), encoding="utf-8")
    n_file = sum(1 for _ in re.finditer(r"^#### `", keluaran.read_text(encoding="utf-8"), re.M))
    print(f"Ditulis: docs/PANDUAN_LENGKAP.md ({n_file} file kode, {keluaran.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
