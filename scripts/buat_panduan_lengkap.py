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

## Gambaran besar: komponen dan alasan memilihnya

| Komponen | Dipakai untuk | Kenapa dipilih | Alternatif yang tidak dipilih |
| --- | --- | --- | --- |
| **n8n** (self-hosted) | Otak sistem: menerima permintaan, memanggil AI, membaca dan menulis data | Alur terlihat sebagai diagram sehingga bisa dirawat non-programmer; gratis dijalankan lokal; punya Code node untuk logika presisi | Make/Zapier (tidak bisa lokal, berbayar), Python murni (kurang visual) |
| **Docker** | Menjalankan n8n dalam container | Satu perintah memasang n8n dengan versi yang sama di laptop mana pun; tidak mengotori sistem; data tersimpan di volume | Instal n8n lewat npm (versi Node bisa bentrok) |
| **Google Sheets** | Database: KB, prospek, percakapan, draf, histori | Sesuai jobdesk Google Workspace; penilai bisa melihat data langsung; tanpa server database | PostgreSQL/Airtable (perlu setup tambahan) |
| **Google Cloud Platform** | Memberi izin n8n membaca dan menulis Sheets atas nama akun Anda | Google mewajibkan setiap aplikasi yang memakai Sheets API terdaftar sebagai project dengan OAuth client; tanpa itu Google menolak akses | Service account (perlu membagikan sheet ke email robot; OAuth lebih sederhana untuk akun pribadi) |
| **Claude API (Haiku 5.5)** | Menjawab pertanyaan dan menyusun draf | Murah dan cepat untuk tugas sempit (4 butir KB); patuh instruksi; mendukung structured outputs (JSON dijamin valid) | Model lebih besar (lebih mahal, tidak perlu untuk tugas ini) |
| **Ollama** (opsional) | Model AI cadangan di laptop | Tetap jalan bila API tidak tersedia; data tidak keluar dari laptop | — |
| **Python** | Script perakit, deploy, reset, dan uji | Sudah terpasang di banyak laptop; cukup pustaka bawaan, tanpa `pip install` | — |
| **Node.js** | Uji unit kode JavaScript | Kode Code node n8n berupa JavaScript; Node menjalankannya di luar n8n untuk diuji | — |
| **Git** | Riwayat perubahan | Satu commit per langkah; mudah kembali bila ada kesalahan | — |
| **HTML + JavaScript biasa** | Halaman chat, panel, dashboard | Tanpa proses build; cukup dibuka lewat server lokal sederhana | React/Streamlit (lebih berat untuk lingkup ini) |


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
- Glosarium – Istilah teknis

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

> **Kenapa?**
> - **Akun Google pribadi** dipakai karena spreadsheet dan izin OAuth terikat ke akun; akun kantor sering dibatasi admin sehingga izin OAuth diblokir.
> - **Saldo Claude** diperlukan karena API dibayar per token; seluruh uji dan demo hanya memakan sekitar beberapa sen dolar.


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

> **Kenapa?**
> - **`.env` terpisah dari kode** agar rahasia (kunci, token, ID) tidak ikut tersimpan di git; `.gitignore` memastikan git mengabaikannya, sedangkan `.env.example` menjadi contoh tanpa isi rahasia.
> - **`N8N_ENCRYPTION_KEY`** adalah kunci yang dipakai n8n untuk mengenkripsi kredensial di database-nya. Bila kunci berganti, kredensial lama tidak bisa didekripsi.
> - **`RESET_TOKEN`** melindungi endpoint uji yang bisa menghapus data demo; tanpa token yang benar n8n menolak dengan 403.


---

## Langkah 2 – Data seed

Delapan file CSV, satu per sheet. Header harus persis seperti di bawah.

> **Kenapa?**
> - **Data awal disimpan sebagai CSV di repo** agar keadaan awal selalu bisa dipulihkan persis sama (reset seed) sebelum uji; hasil uji jadi bisa diulang dan dibandingkan.
> - **Header harus persis** karena kode membaca kolom berdasarkan namanya; satu huruf berbeda membuat kolom dianggap tidak ada.
> - **`kunci_normal`** (nama perusahaan tanpa \"PT\", \"Simulasi\", tanda baca) dipakai untuk mendeteksi prospek yang sama walau ejaannya berbeda.


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

> **Kenapa?**
> - **Port terikat ke `127.0.0.1`** (lihat docker-compose.yml) sehingga n8n hanya bisa dibuka dari laptop ini, tidak dari jaringan Wi-Fi atau internet.
> - **Volume `n8n_data`** menyimpan workflow dan kredensial di luar container; mematikan atau memperbarui container tidak menghapus data.
> - **Zona waktu Asia/Jakarta** agar waktu di Histori dan jadwal pengingat pukul 08.00 sesuai WIB.


---

## Langkah 4 – Google Cloud, spreadsheet, dan kredensial

**4.1 Google Cloud** (console.cloud.google.com)
1. Buat project baru, mis. `msi-demo`.
2. *APIs & Services → Library*: aktifkan **Google Sheets API** dan **Google Drive API**.
3. *Google Auth Platform*: isi nama aplikasi `MSI Demo` dan email Anda, Audience **External**, selesaikan.
4. *Audience → Test users → Add users*: masukkan **Gmail yang sama** dengan yang akan dipakai login. *Publishing status* tetap **Testing**.
5. *Clients → Create client* → **Web application** (rincian klik dan penjelasan di 4.1a dan 4.1b di bawah). Kolom **Authorized JavaScript origins** dibiarkan kosong. Di **Authorized redirect URIs** tambahkan persis:
   ```
   http://localhost:5678/rest/oauth2-credential/callback
   ```
6. Simpan **Client ID** dan **Client Secret** sementara (jangan ke repo).

> **Kenapa?**
> - **Kenapa perlu Google Cloud Platform:** Google tidak mengizinkan program mana pun membaca atau menulis Sheets tanpa identitas aplikasi yang terdaftar. Project GCP adalah \"KTP\" aplikasi itu; OAuth client adalah cara aplikasi meminta izin dari pemilik akun.
> - **Sheets API** dipakai untuk membaca dan menulis isi sheet; **Drive API** dipakai n8n untuk menampilkan daftar file spreadsheet saat memilih dokumen dan saat menguji kredensial.
> - **OAuth (bukan memberikan password):** Anda login di halaman Google sendiri, lalu Google memberi n8n token akses terbatas. Password Google tidak pernah diketahui n8n, dan izin bisa dicabut kapan saja di myaccount.google.com.
> - **Mode Testing + Test users:** aplikasi yang belum diverifikasi Google hanya boleh dipakai akun yang didaftarkan. Cukup untuk demo pribadi; peringatan \"Google hasn't verified this app\" wajar karena aplikasinya milik Anda sendiri. Token di mode Testing kedaluwarsa sekitar 7 hari; bila muncul error token, klik Sign in with Google lagi.
> - **Redirect URI** adalah alamat tujuan Google mengirim token setelah Anda login. Harus sama persis dengan alamat n8n; kolom JavaScript origins tidak dipakai karena n8n tidak login dari peramban.



### 4.1a Memahami OAuth dan *Authorized redirect URIs*

Bagian ini menjelaskan apa yang sebenarnya terjadi saat Anda menekan **Sign in with Google** di n8n, dan kenapa satu alamat di Google Cloud harus diisi persis.

**Analogi.** Bayangkan n8n adalah kurir yang ingin mengambil paket (data Sheets) dari gudang Google atas nama Anda.
- **Project GCP + OAuth client** = kartu identitas kurir yang terdaftar di gudang (Client ID = nomor kartu, Client Secret = PIN kurir).
- **Login dan layar persetujuan Google** = Anda sendiri datang ke meja gudang dan menandatangani surat kuasa ("kurir ini boleh mengambil paket Sheets saya").
- **Authorized redirect URI** = **alamat kantor kurir yang terdaftar**. Gudang hanya mau mengantar surat kuasa ke alamat yang tercatat di kartu, bukan ke alamat lain yang disebut siapa pun.

**Alur lengkap OAuth (yang terjadi di balik layar):**

```
 Anda                n8n (localhost:5678)                 Google
  │  klik "Sign in     │                                     │
  │  with Google" ───► │                                     │
  │                    │ 1. buka halaman login Google,       │
  │                    │    membawa Client ID + redirect_uri │
  │ ◄──────────────────┼──────────────────────────────────── │
  │ 2. login & setujui izin (layar persetujuan)              │
  │ ─────────────────────────────────────────────────────►   │
  │                    │                                     │ 3. Google memeriksa: apakah redirect_uri
  │                    │                                     │    terdaftar PERSIS di OAuth client?
  │                    │ ◄── 4. peramban diarahkan ke        │
  │                    │     http://localhost:5678/rest/oauth2-credential/callback?code=...
  │                    │ 5. n8n menukar code + Client Secret │
  │                    │    menjadi access token & refresh   │
  │                    │    token ─────────────────────────► │
  │                    │ ◄──────────────────────── token ─── │
  │                    │ 6. token disimpan terenkripsi di    │
  │                    │    credential store → "Account connected"
```

Langkah 4 adalah tempat redirect URI bekerja: setelah Anda menyetujui, Google mengirim **kode izin sekali pakai** dengan cara mengarahkan peramban ke alamat itu. n8n "mendengarkan" di alamat tersebut, menangkap kodenya, lalu menukarnya menjadi token.

**Bedah alamat callback:**

| Bagian | Nilai | Arti |
| --- | --- | --- |
| Skema | `http://` | Google mengizinkan `http` khusus untuk `localhost`; alamat lain wajib `https` |
| Host | `localhost` | Laptop Anda sendiri |
| Port | `:5678` | Port n8n (lihat `docker-compose.yml`) |
| Path | `/rest/oauth2-credential/callback` | "Pintu" khusus n8n untuk menerima kode OAuth |

**Kenapa harus sama persis?** Ini fitur keamanan. Kode izin bisa ditukar menjadi akses ke Sheets Anda. Kalau Google mau mengirim kode ke alamat mana saja, penyerang bisa memasang tautan login dengan `redirect_uri` miliknya lalu mencuri kode tersebut. Karena itu Google hanya mengirim ke alamat yang **didaftarkan pemilik aplikasi**, dan membandingkannya huruf demi huruf: `localhost` ≠ `127.0.0.1`, port berbeda ditolak, garis miring di akhir pun dihitung.

**Beda dengan *Authorized JavaScript origins*:**

| Kolom | Dipakai bila | Format | Untuk proyek ini |
| --- | --- | --- | --- |
| Authorized JavaScript origins | Login Google dilakukan oleh JavaScript di halaman web (mis. tombol "Login with Google" di situs) | Hanya `skema://host:port`, **tanpa path** | **Kosongkan** |
| Authorized redirect URIs | Server (di sini n8n) menerima kode OAuth di sebuah alamat | URL lengkap **dengan path** | `http://localhost:5678/rest/oauth2-credential/callback` |

Menempelkan URL callback ke kolom origins menghasilkan error *"Invalid Origin: URIs must not contain a path or end with /"*.

**Dari mana alamat itu didapat?** n8n menampilkannya sendiri: buka form kredensial **Google Sheets OAuth2 API** di n8n, cari kolom **OAuth Redirect URL** (ada tombol salin). Salin dari sana agar pasti sama. Bila suatu saat n8n dijalankan di port atau domain lain, alamat ini berubah dan harus didaftarkan ulang di Google Cloud.

### 4.1b Klik demi klik: membuat OAuth client

1. Buka **console.cloud.google.com** dan pastikan project `msi-demo` terpilih di pemilih project (kiri atas).
2. Menu ☰ → **Google Auth Platform** (atau *APIs & Services → OAuth consent screen*, nama menu bisa berbeda antarversi konsol).
3. **Branding**: isi *App name* `MSI Demo`, *User support email* dan *Developer contact* dengan email Anda → **Save**.
4. **Audience**: pilih **External**. Di *Test users* klik **+ Add users** → isi Gmail yang akan dipakai login → **Save**. *Publishing status* biarkan **Testing**.
5. **Clients** → **+ Create client**:
   - *Application type*: **Web application**
   - *Name*: `n8n lokal`
   - *Authorized JavaScript origins*: **biarkan kosong**
   - *Authorized redirect URIs*: klik **+ Add URI** → tempel `http://localhost:5678/rest/oauth2-credential/callback`
   - klik **Create**
6. Jendela berisi **Client ID** dan **Client Secret** muncul. Salin keduanya langsung ke form kredensial n8n (Langkah 4.3). Jangan simpan di repo, chat, atau screenshot. Bila jendela terlanjur ditutup, buka client tersebut; Client Secret bisa dibuat ulang.

**Izin (scope) yang diminta:** n8n meminta sendiri izin yang dibutuhkan saat Sign in; daftarnya tampil di layar persetujuan Google. Anda tidak perlu mengatur *Data Access* untuk mode Testing.

**Masalah umum di tahap ini:**

| Pesan | Penyebab | Perbaikan |
| --- | --- | --- |
| `Error 400: redirect_uri_mismatch` | Alamat di Authorized redirect URIs tidak sama persis dengan OAuth Redirect URL di n8n | Salin ulang dari kolom **OAuth Redirect URL** n8n; periksa `localhost` vs `127.0.0.1`, port, dan garis miring akhir; simpan; tunggu 1–5 menit lalu coba lagi |
| *Invalid Origin: URIs must not contain a path* | URL callback ditempel di kolom JavaScript origins | Kosongkan origins; isi di redirect URIs |
| *Akses diblokir: aplikasi belum menyelesaikan proses verifikasi* | Akun login belum ada di Test users | Tambahkan Gmail yang sama di Audience → Test users |
| *Google hasn't verified this app* | Wajar untuk aplikasi milik sendiri di mode Testing | Klik **Continue** |
| Kredensial n8n tiba-tiba error token setelah beberapa hari | Refresh token mode Testing kedaluwarsa sekitar 7 hari | Buka kredensial di n8n → **Sign in with Google** lagi |

**4.2 Spreadsheet**
1. Di Google Sheets buat spreadsheet baru bernama `MSI Demo (SIMULASI)`.
2. Buat **8 tab** dengan nama persis: `KB`, `Prospek`, `Percakapan`, `Antrean_Staf`, `Draf`, `Histori`, `Konfigurasi`, `Log_Error`. Tab boleh kosong; isinya ditulis otomatis di Langkah 10.
3. Hapus tab bawaan *Sheet1* bila masih ada.
4. Salin ID spreadsheet dari URL (bagian di antara `/d/` dan `/edit`) ke `.env`: `GOOGLE_SHEET_ID=...`
5. Tombol *Share* → *General access* tetap **Restricted**.

> **Kenapa?**
> - **Satu spreadsheet, delapan tab** agar semua data demo ada di satu tempat dan bisa dibaca dalam satu panggilan API (lebih cepat).
> - **Restricted** agar data hanya bisa dibuka akun Anda; ID spreadsheet saja tidak cukup untuk membukanya.


**4.3 Kredensial di n8n** (Overview → panah di tombol *Create* → *Credential*). Ganti nama kredensial di kiri atas **persis** seperti ini:

| Nama | Jenis | Isi |
| --- | --- | --- |
| `Claude API (demo)` | Anthropic | API Key dari console.anthropic.com |
| `Google Sheets (demo)` | Google Sheets OAuth2 API | Client ID + Client Secret dari 4.1 → **Sign in with Google** → pilih akun → "Google hasn't verified this app" → **Continue** → centang semua izin |
| `Ollama lokal (demo)` (opsional) | Ollama | Base URL `http://host.docker.internal:11434` |

**Titik cek:** setiap kredensial menampilkan pesan hijau (*Connection tested successfully* / *Account connected*).

> **Kenapa?**
> - **Credential store n8n** menyimpan API key dan token Google terenkripsi di database n8n. Workflow hanya merujuk nama kredensial, sehingga file workflow di repo tidak pernah berisi rahasia.
> - **Nama persis** dipakai agar mudah dikenali saat memasang di node; script deploy menyalin rujukan kredensial berdasarkan jenisnya.
> - **`host.docker.internal`** adalah alamat laptop dilihat dari dalam container Docker; `localhost` di dalam container berarti container itu sendiri, bukan laptop.


**4.4 API key n8n:** *Settings → n8n API → Create an API key* (label `msi-deploy-lokal`, centang semua scope *Workflow* bila ditanya). Tempel ke `.env`: `N8N_API_KEY=...`

> **Kenapa?**
> - **API key n8n** dipakai script deploy untuk memasang dan memperbarui workflow lewat n8n Public API, sehingga perubahan kode cukup satu perintah tanpa import manual setiap kali.


---

## Langkah 5 – Prompt dan skema AI

Instruksi untuk Claude dan skema JSON jawaban. Penanda `[[...]]` diisi workflow saat berjalan.

> **Kenapa?**
> - **Prompt disimpan sebagai file**, bukan diketik di n8n, agar perubahannya tercatat git dan satu prompt dipakai di semua tempat (satu sumber kebenaran).
> - **Penanda `[[DAFTAR_KB]]`** diisi isi sheet KB saat permintaan berjalan, sehingga admin cukup mengubah sheet tanpa mengubah prompt. Memakai `[[ ]]` karena `{{ }}` adalah sintaks ekspresi n8n.
> - **Skema JSON (structured outputs)** membuat API Claude menjamin keluaran berformat JSON sesuai skema, sehingga workflow selalu bisa membacanya.


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

> **Kenapa?**
> - **Pemeriksa jawaban tanpa AI:** aturan berbasis pola memberi hasil pasti dan bisa diuji; AI kedua untuk memeriksa AI pertama hasilnya tidak pasti.
> - **Modul bersama** mencegah kode yang sama ditulis berulang di banyak workflow; perbaikan cukup di satu file.
> - **Uji unit (`node --test`)** membuktikan logika benar sebelum masuk n8n, jauh lebih cepat daripada menguji lewat webhook.


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

> **Kenapa?**
> - **Kode node ditulis sebagai file `.js`**, bukan langsung di editor n8n, agar bisa dibaca, dibandingkan, diuji, dan dilacak git. Script perakit menempelkannya ke workflow.
> - **Satu baca dan satu tulis per permintaan:** semua sheet dibaca dalam satu panggilan dan semua perubahan ditulis dalam satu `batchUpdate`. Lebih cepat (sekitar 1 detik per panggilan Sheets) dan atomik: bila gagal, tidak ada data yang setengah tertulis.
> - **`id_permintaan` (idempotensi):** permintaan yang sama dikirim ulang tidak membuat data dobel; hasil lama dikembalikan.


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

> **Kenapa?**
> - **Workflow dirakit, bukan digambar manual,** karena workflow terdiri dari puluhan node; merakitnya dari file memastikan hasilnya selalu sama dan bisa diulang.


```powershell
python scripts/build_workflows.py
```

**Titik cek:** enam baris `Ditulis:` muncul, yaitu WF-01 (33 node), WF-02 (13), WF-03 (51), WF-04 (16), WF-05 (5), WF-90 (34). Bila muncul "Nilai berikut belum diisi di .env", lengkapi `.env` (Langkah 1.3 dan 4).

**9.2 Import WF-01 sekali secara manual** (agar script deploy punya contoh kredensial untuk diwariskan)

> **Kenapa?**
> - Kredensial hanya bisa dipilih dari n8n (isinya rahasia). Setelah satu node dipasangi kredensial, script deploy menyalin rujukan kredensial yang sama ke semua node dan workflow lain.

1. Di n8n: *Create → Workflow* → menu **⋯** kanan atas → *Import from File* → pilih `n8n/workflows/WF-01_agent_chat.json`.
2. Klik dua kali node **Baca Semua Sheet** → *Credential to connect with* → pilih `Google Sheets (demo)`.
3. Klik dua kali node **Panggil Claude** → *Credential for Anthropic* → pilih `Claude API (demo)`.
4. Klik **Save**. Jangan klik Publish dulu; node lain belum punya kredensial.

**9.3 Pasang semua workflow**

> **Kenapa?**
> - **Publish** mengaktifkan alamat webhook (`/webhook/chat`, dan seterusnya) sehingga bisa dipanggil halaman web. WF-05 dipasang lebih dulu karena workflow lain merujuknya sebagai error workflow.


```powershell
python scripts/deploy_workflows.py
```

**Titik cek:** keluaran menyebut keenam workflow dengan `Status: versi terbaru sudah di-publish.` dan kredensial `Reset seed token (demo)` dibuat. Di n8n, keenam workflow tampil dengan status Published.

> Setiap kali kode di `n8n/` berubah: jalankan `build_workflows.py` lalu `deploy_workflows.py` lagi. Tidak perlu import ulang.

---

## Langkah 10 – Isi data dan halaman web

**10.1 Isi spreadsheet dari seed** (ketik `RESET` saat diminta):

> **Kenapa?**
> - Reset menulis ulang kedelapan tab dari folder `seed/` dalam satu operasi atomik, termasuk header, sehingga tab kosong dari Langkah 4.2 langsung siap dipakai.


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

> **Kenapa?**
> - **Server lokal (`http.server`)** diperlukan karena peramban memblokir panggilan ke n8n dari file yang dibuka langsung (`file://`).
> - **CORS:** n8n hanya mengizinkan halaman dari origin `http://localhost:8000` (nilai `WEB_ORIGIN` di `.env`). Bagi peramban, `127.0.0.1:8000` adalah origin lain, sehingga jawabannya diblokir.


**Titik cek manual:**
1. **Chat:** tanya `Apakah harus menjadi sponsor?` → jawaban dengan chip **KB03**. Tanya `Bisakah dijamin mendapat bintang 5?` → chip **KB04** + label kuning **Diteruskan ke staf**.
2. **Panel staf:** tiket eskalasi dan draf menunggu tampil; coba **Setujui** lalu **Tandai Siap kirim (simulasi)**.
3. **Dashboard:** ringkasan **3/3/3/1** dan AE **5/5** (pada seed bersih); pilih peran **AE A** → hanya 5 prospek.

---

## Langkah 11 – Uji akhir (27/27)

Buka terminal kedua di folder proyek (server halaman tetap berjalan):

> **Kenapa?**
> - **Uji dimulai dengan reset** agar setiap kali dijalankan hasilnya bisa dibandingkan (data awal sama); urutan uji mengikuti Section 13, misalnya ringkasan 3/3/3/1 diuji sebelum prospek baru ditambahkan.
> - **Uji memeriksa isi sheet, bukan hanya respons**, sehingga kesalahan seperti data dobel atau baris yang tidak tertulis ikut tertangkap.


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
    tambah("""
---

## Glosarium – Istilah teknis

| Istilah | Arti singkat |
| --- | --- |
| **API** | Pintu bagi program untuk meminta layanan program lain (mis. Claude API, Google Sheets API). |
| **Webhook** | Alamat URL di n8n yang menjalankan workflow saat dipanggil, mis. `POST /webhook/chat`. |
| **Workflow / node** | Workflow adalah alur kerja n8n; node adalah satu langkah di dalamnya (baca sheet, panggil AI, kode). |
| **Code node** | Node n8n berisi JavaScript untuk logika yang presisi. |
| **Credential store** | Tempat n8n menyimpan kunci dan token secara terenkripsi. |
| **OAuth** | Cara aplikasi mendapat izin terbatas atas akun Anda tanpa mengetahui password. |
| **Container / volume Docker** | Container menjalankan aplikasi terisolasi; volume menyimpan datanya agar tidak hilang. |
| **System prompt** | Instruksi tetap untuk AI yang dikirim di setiap permintaan. |
| **Knowledge base (KB)** | Daftar fakta resmi yang menjadi satu-satunya sumber jawaban agent. |
| **Structured outputs** | Fitur API Claude yang menjamin keluaran mengikuti skema JSON. |
| **Eskalasi** | Pertanyaan diteruskan ke staf manusia karena di luar wewenang agent. |
| **Idempoten** | Permintaan yang sama diulang tidak mengubah hasil atau menambah data. |
| **Atomik** | Sekumpulan perubahan diterapkan semua, atau tidak sama sekali. |
| **CORS** | Aturan peramban yang membatasi halaman mana yang boleh membaca jawaban sebuah server. |
| **Seed** | Data awal standar untuk mengembalikan sistem ke keadaan bersih. |
| **Uji unit / uji ujung ke ujung** | Uji unit memeriksa satu fungsi; uji ujung ke ujung memeriksa seluruh alur lewat API sungguhan. |
""")

    keluaran = ROOT / "docs/PANDUAN_LENGKAP.md"
    keluaran.write_text("".join(bagian), encoding="utf-8")
    n_file = sum(1 for _ in re.finditer(r"^#### `", keluaran.read_text(encoding="utf-8"), re.M))
    print(f"Ditulis: docs/PANDUAN_LENGKAP.md ({n_file} file kode, {keluaran.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
