# Panduan Reproduksi dan Belajar: AI Agent Layanan & CRM Awards (SIMULASI MSI)

Panduan ini menjelaskan cara membangun ulang aplikasi dari folder kosong, alasan teknis di balik setiap keputusan, dan semua error yang pernah terjadi beserta solusinya. Gunakan bersama `docs/PERENCANAAN.md` (rencana dan kebutuhan) dan `git log` (urutan pembuatan, satu commit per item backlog).

Ada dua jalur:
- **Jalur cepat (Bagian 3):** menjalankan ulang dari repo ini dalam sekitar 45 menit.
- **Jalur belajar (Bagian 4):** membangun komponen satu per satu dengan memahami alasannya.

---

## 1. Gambaran sistem (untuk dijelaskan saat presentasi)

```
 Peramban (web/index.html, localhost:8000)
   │  fetch JSON (CORS: hanya origin localhost:8000)
   ▼
 n8n di Docker (localhost:5678, hanya 127.0.0.1)
   ├─ WF-01 Agent chat      POST /chat             tanya-jawab, prospek, percakapan, tiket, draf
   ├─ WF-02 Data panel      GET  /panel            data panel staf, dashboard, ekspor CSV
   ├─ WF-03 Keputusan       POST /approve, /prospek/status, /prospek/draf
   ├─ WF-04 Pengingat       jadwal 08.00, manual, POST /pengingat
   ├─ WF-05 Penanganan error  error workflow → Log_Error
   └─ WF-90 Utilitas uji    reset seed, ubah Konfigurasi, baca data (Header Auth)
        │                        │
        ▼                        ▼
 Claude API (Haiku 5.5)    Google Sheets API (1 spreadsheet, 8 sheet)
                          satu baca + satu batchUpdate atomik per permintaan
```

**Alur satu pertanyaan (WF-01), dalam satu kalimat per langkah:**
1. Webhook menerima `id_permintaan`, `prospek`, `pertanyaan`; pertanyaan kosong ditolak 400.
2. Semua sheet dibaca dalam **satu** panggilan `spreadsheets.get`.
3. Jika `id_permintaan` sudah ada di Percakapan → kirim jawaban lama (`berulang: true`), tanpa model dan tanpa menulis (idempoten).
4. Prospek dicari per ID atau `kunci_normal`; ID tak dikenal ditolak sebelum memanggil model (hemat biaya).
5. KB aktif disisipkan ke system prompt; Claude menjawab dengan **structured outputs** (format JSON dijamin skema).
6. **Pemeriksa tanpa AI** (PJ-01–PJ-04) menolak nominal uang, tanggal, janji, atau rujukan asing → diganti template eskalasi.
7. Claude kedua menyusun draf follow-up (kecuali sapaan), diperiksa aturan yang sama.
8. `MODE_GAGAL` dicek tepat sebelum menulis (untuk demo kegagalan).
9. Semua baris baru (Prospek bila baru, Histori, Percakapan, Antrean_Staf, Draf) ditulis dalam **satu** `spreadsheets.batchUpdate` yang **atomik**.
10. Halaman menerima kontrak: `status, jawaban, rujukan_kb, eskalasi, id_prospek, id_draf`.

**Lima keputusan teknis yang paling penting untuk dijelaskan:**

| Keputusan | Masalah yang diselesaikan | Bukti |
| --- | --- | --- |
| Pemeriksa jawaban tanpa AI (PJ-01–PJ-04) | AI bisa saja menjanjikan harga atau bintang 5; aturan pasti lebih bisa dipercaya daripada AI kedua | T-07, uji unit 23 kasus |
| Structured outputs + effort rendah | Haiku 5.5 menolak `temperature`; format JSON harus selalu valid | T-08: 3 kali identik |
| Satu baca + satu tulis atomik | Node Sheets satu-satu ±1 detik/panggilan; kegagalan di tengah bisa meninggalkan data setengah tertulis | Respons 6–8 detik (T-26), T-19 tidak menulis apa pun |
| Idempotensi `id_permintaan` | Coba ulang setelah gagal tidak boleh membuat data dobel | T-20, T-21 |
| Workflow dirakit dari repo (build + deploy) | Prompt dan kode punya satu sumber kebenaran; bisa diuji di luar n8n; perubahan terlacak git | Simulasi Code node, `git log` |

---

## 2. Prasyarat

| Kebutuhan | Versi yang dipakai | Catatan |
| --- | --- | --- |
| Docker Desktop | 29.x | menjalankan n8n |
| Python | 3.11+ (dipakai 3.13) | script `scripts/`, tanpa paket tambahan |
| Node.js | 20+ (dipakai 24) | uji unit `node --test` |
| Git | 2.x | |
| Akun Google | pribadi | Google Sheets + Google Cloud project |
| API key Claude | console.anthropic.com | dengan saldo; model `claude-haiku-5-5` |

---

## 3. Jalur cepat: menjalankan ulang dari repo

Ikuti urutannya; setiap langkah bergantung pada langkah sebelumnya.

**3.1 `.env`**
```
cp .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"        # isi N8N_ENCRYPTION_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"    # isi RESET_TOKEN
```
`GOOGLE_SHEET_ID`, `N8N_API_KEY` diisi di langkah 3.4 dan 3.6. Jangan pernah mengganti `N8N_ENCRYPTION_KEY` setelah kredensial dipasang.

**3.2 n8n**
```
docker compose up -d
```
Buka http://localhost:5678, buat akun owner lokal.

**3.3 Google Cloud OAuth** (bagian paling rawan error, lihat Bagian 5)
1. console.cloud.google.com → project baru → aktifkan **Google Sheets API** dan **Google Drive API**.
2. Google Auth Platform → Audience **External**, status **Testing** → **Test users**: tambahkan Gmail Anda sendiri.
3. Clients → Create client → **Web application** → isi **Authorized redirect URIs** (bukan JavaScript origins):
   `http://localhost:5678/rest/oauth2-credential/callback`

**3.4 Spreadsheet**
Buat spreadsheet `MSI Demo (SIMULASI)` berisi 8 tab dengan nama persis seperti file di `seed/` (KB, Prospek, Percakapan, Antrean_Staf, Draf, Histori, Konfigurasi, Log_Error). Isi minimal baris header; sisanya diisi reset seed nanti. Salin ID dari URL (di antara `/d/` dan `/edit`) ke `GOOGLE_SHEET_ID`. Jangan bagikan ke publik.

**3.5 Kredensial di n8n** (Create → Credential), nama persis:
- `Claude API (demo)`, jenis **Anthropic**
- `Google Sheets (demo)`, jenis **Google Sheets OAuth2 API** → Sign in with Google → "Google hasn't verified this app" → Continue

**3.6 API key n8n**
Settings → n8n API → Create an API key → tempel ke `N8N_API_KEY` di `.env` (jangan ke chat atau screenshot).

**3.7 Workflow pertama kali**
Script deploy menyalin kredensial dari workflow yang sudah ada, jadi satu workflow harus dipasangi kredensial manual sekali:
```
python scripts/build_workflows.py
```
Di n8n: Create → Workflow → ⋯ → Import from File → `n8n/workflows/WF-01_agent_chat.json` → pilih kredensial di node **Baca Semua Sheet** (Google Sheets) dan **Panggil Claude** (Anthropic) → Save. Lalu:
```
python scripts/deploy_workflows.py
```
Script membuat WF-02, WF-03, WF-04, WF-05, WF-90, kredensial `Reset seed token (demo)`, mewariskan kredensial ke semua node, dan mem-publish semuanya.

**3.8 Data, halaman, dan uji**
```
python scripts/reset_seed.py                  # ketik RESET
cd web && python -m http.server 8000 --bind 127.0.0.1
python scripts/run_tests.py                   # di terminal lain; target 27/27
```
Buka **http://localhost:8000** (bukan 127.0.0.1).

---

## 4. Jalur belajar: membangun per komponen

Urutan ini mengikuti commit di `git log --reverse`. Untuk melihat persis apa yang ditambahkan di satu langkah: `git show <hash> --stat` lalu `git show <hash>`.

### 4.1 Fondasi (BL-01, BL-02, BL-04, BL-05)
- **Seed CSV** (`seed/`): header persis Section 9. `kunci_normal` dihitung dari nama dengan aturan anti-dobel. Status 3/3/3/1 adalah titik cek pertama.
- **docker-compose**: port `127.0.0.1:5678` (tidak terbuka ke jaringan), zona waktu Asia/Jakarta, `extra_hosts host.docker.internal` agar container bisa menjangkau Ollama di laptop.
- **Gate G2**: workflow uji kecil yang membaca KB dan menulis ulang satu nilai Konfigurasi membuktikan kredensial Google bekerja sebelum membangun apa pun.

### 4.2 Prompt agent (BL-06) — `n8n/prompts/`
- Aturan AR-01–AR-08 ditulis eksplisit; KB disisipkan lewat penanda `[[DAFTAR_KB]]`. **Kenapa `[[ ]]`:** `{{ }}` adalah sintaks ekspresi n8n dan akan dieksekusi.
- Topik: `biaya_pendaftaran, sponsorship, jaminan_penghargaan, tarif, jadwal, sapaan, lainnya`.
- Uji dini dengan Ollama sebelum ada workflow: model 3B gagal di T-06 (tidak eskalasi) → aturan eskalasi untuk upaya membobol ditulis eksplisit. Pelajaran: menguji prompt dengan model lemah cepat menemukan aturan yang ambigu.

### 4.3 Pemeriksa jawaban (BL-07) — `n8n/code/pemeriksa_jawaban.js`
- Fungsi murni tanpa AI → hasil pasti, bisa diuji unit (`node --test`).
- PJ-03 memotong kalimat per koma/titik: "Saya **tidak** dapat menjamin bintang 5" lolos, tetapi "Tidak perlu khawatir, Anda **dijamin** bintang 5" tertangkap.
- Keluaran bukan JSON → dianggap eskalasi, bukan error (R-05).
- Pengecualian sapaan PJ-04 hanya berlaku bila **pertanyaan pengguna** sendiri cocok pola sapaan pendek; label "sapaan" dari AI saja tidak cukup (mencegah AI menghindari kewajiban rujukan).

### 4.4 Cara workflow dibuat (BL-08, KA-06) — `scripts/build_workflows.py`
- Isi Code node ditulis sebagai file `.js` biasa (`n8n/code/`), lalu dirakit ke JSON. Penanda `/*@NAMA*/ null` diganti nilai dari prompt, skema, atau `.env`.
- Modul bersama ditempel di depan kode node (mis. `sheet_tulis.js` + `wf03/proses_status.js`); baris `module.exports` di akhir modul hanya aktif saat uji unit.
- ID node dibuat deterministik (uuid5), sehingga build ulang tanpa perubahan menghasilkan file identik.
- `deploy_workflows.py`: cari workflow per nama → salin kredensial dari node bernama sama → node baru mewarisi kredensial sejenis → ganti `@WF:<nama>` dengan ID asli → PUT (otomatis re-publish) atau POST + publish.

### 4.5 Claude API dari n8n
- Node HTTP Request dengan kredensial bawaan `anthropicApi` (otomatis menambah `x-api-key`), header `anthropic-version: 2026-10-21`.
- Body: `model, max_tokens, system, messages, output_config: { effort: "low", format: { type: "json_schema", schema } }`. **Tanpa `temperature`** (Haiku 5.5 → 400).
- Respons bisa diawali blok `thinking`; jawaban diambil dari blok `type: "text"`.
- **Node gabungan:** beberapa file langkah yang berurutan dijalankan dalam satu Code node (WF-01 dari 33 menjadi 15 node). Rujukan `$('Nama Langkah')` di dalam file tetap berfungsi; kode gabungan menuliskan `$('Nama Node')` secara eksplisit karena task runner n8n hanya mengirim data node yang dirujuk tertulis.

### 4.6 Data dan anti-dobel (BL-10, BL-11, KA-05)
- **Baca:** `spreadsheets.get?includeGridData=true&ranges=...&fields=sheets(properties(sheetId,title),data(rowData(values(formattedValue))))` → node "Olah Data Sheet" mengubahnya menjadi objek per kolom + `_baris` (nomor baris sheet).
- **Tulis:** `spreadsheets.batchUpdate` berisi `appendCells` (baris baru, urut header sheet) dan `updateCells` (ubah sel, butuh `_baris` dan `sheetId`). Google menerapkannya atomik.
- **Nomor ID** (C0001, D0001, H0001, T0001, E0001): nomor terbesar + 1 dari hasil baca. Penulisan bersamaan tidak dikunci (KA-03, diterima untuk demo satu pengguna).
- **Histori anti-dobel saat coba ulang:** catatan Histori memuat `id_permintaan=...`; bila sudah ada, tidak ditulis lagi.

### 4.7 Kegagalan (BL-12)
- Setiap node HTTP dan Code memakai keluaran error (`onError: continueErrorOutput`) menuju jalur: Siapkan Log Error → Baca Log Error → Susun Baris Log → Catat Log Error → respons 502 `gagal`.
- `$prevNode.name` mencatat node asal error; `log_error.js` menyamarkan pola kredensial dan hanya menyimpan kolom masukan dari daftar putih.
- WF-05 (Error Trigger) dipasang sebagai `errorWorkflow` semua workflow untuk error yang tidak tertangkap. Error workflow wajib sudah di-publish.
- Tombol **Coba ulang** mengirim objek permintaan yang sama (id sama) → idempoten.

### 4.8 Panel, keputusan, dashboard (BL-13–BL-17, BL-22)
- WF-02 menyaring per peran: AE hanya prospek miliknya beserta tiket, draf, dan histori terkait.
- WF-03 menegakkan transisi draf: setuju/tolak hanya dari Menunggu persetujuan, siap_kirim hanya dari Disetujui (G4).
- Draf penawaran (FR-23): catatan AE + data prospek + KB → Claude → pemeriksa yang sama → Draf `id_percakapan` kosong; Prospek tidak diubah.
- Halaman: semua teks dari server dipasang dengan `textContent` (mencegah XSS); pemuatan Dashboard diberi nomor urut agar respons usang tidak menimpa data peran terbaru.

### 4.9 Pengujian (BL-18)
| Lapisan | Perintah | Isi |
| --- | --- | --- |
| Uji unit | `node --test "n8n/code/*.test.js"` | pemeriksa, normalisasi kunci, log error, penyusun batchUpdate |
| Simulasi Code node | (dipakai selama pembangunan) | kode node dijalankan dengan `$`, `$input`, `$now` tiruan dan data seed |
| Uji ujung ke ujung | `python scripts/run_tests.py` | reset seed lalu 27 uji lewat API + isi sheet (WF-90 `/uji/data`) |

---

## 5. Error yang pernah terjadi dan solusinya

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| Google: "Invalid Origin: URIs must not contain a path or end with /" | URL callback ditempel di **Authorized JavaScript origins** | Kosongkan origins; isi callback di **Authorized redirect URIs** |
| Google: `Error 400: redirect_uri_mismatch` | Alamat Authorized redirect URIs tidak sama persis dengan OAuth Redirect URL di n8n | Salin dari kolom OAuth Redirect URL n8n; cek localhost vs 127.0.0.1, port, garis miring akhir; tunggu 1–5 menit |
| Google: "Akses diblokir: aplikasi belum menyelesaikan proses verifikasi" | Akun login belum terdaftar sebagai Test user | Audience → Test users → tambahkan Gmail yang sama; status tetap Testing |
| Claude 400 karena `temperature` | Haiku 5.5 menolak parameter sampling | Hapus `temperature`; pakai `output_config.effort` + structured outputs |
| "halo" dijawab template eskalasi | PJ-04 mewajibkan rujukan untuk jawaban tanpa eskalasi | Topik `sapaan` + pengecualian berpenjaga pola pertanyaan pengguna |
| Deploy: "Missing required credential" | Node baru belum punya kredensial | Deploy mewariskan rujukan kredensial sejenis |
| Deploy: "The selected error workflow has no published version" | WF-05 belum di-publish | Deploy mem-publish workflow yang kredensialnya lengkap |
| Node Sheets berhenti tanpa error | Sheet hanya header → 0 item → node berikutnya tidak jalan | `alwaysOutputData` (sebelum KA-05); kini pembacaan lewat satu HTTP call |
| Waktu tersimpan dengan milidetik | `suppressMilliseconds` Luxon hanya bila milidetik = 0 | `.startOf('second')` sebelum `toISO` |
| Code node mengembalikan kosong saat simulasi | Nama node di kode ("Validasi Peran") beda dengan nama dari perakit ("Validasi Panel") | Samakan rujukan `$('Nama Node')`; simulasi menangkapnya sebelum deploy |
| Dashboard peran AE A menampilkan 10 prospek | Respons pemuatan lama (Admin) tiba terakhir | Nomor urut pemuatan; respons usang diabaikan |
| `node --test n8n/code/` tidak menjalankan apa pun (Windows) | Argumen folder tidak dikenali | `node --test "n8n/code/*.test.js"` |
| Parsing output `node --test` gagal, teks `�` | Python membaca stdout dengan cp1252 | `encoding="utf-8"` di subprocess; keluaran pakai ASCII |
| `docker exec` "Cwd must be an absolute path" | Git Bash mengubah path Unix | `MSYS_NO_PATHCONV=1 docker exec ...` |
| Perintah Python menggantung | `python -  <<EOF </dev/null` → stdin heredoc ditimpa | Jangan gabungkan heredoc dengan `</dev/null`; tulis skrip ke file |
| CORS terblokir di peramban | Halaman dibuka dari origin lain | Buka `http://localhost:8000`; `WEB_ORIGIN` di `.env` |

---

## 6. Pertanyaan teknis yang mungkin muncul saat presentasi

- **"Bagaimana menjamin AI tidak menjanjikan bintang 5?"** Tiga lapis: aturan di system prompt, structured outputs (format tetap), dan pemeriksa tanpa AI yang mengganti jawaban berbahaya dengan template eskalasi. Uji T-02, T-06, T-07.
- **"Kenapa tidak RAG / vector search?"** KB hanya 4 butir; seluruh KB muat di prompt dan dibaca ulang dari sheet setiap permintaan (FR-18). Vector search dicatat sebagai pengembangan lanjut (FR-22).
- **"Apa yang terjadi kalau Google Sheets mati di tengah proses?"** Penulisan dilakukan sekali di akhir dan atomik; halaman menerima status gagal, Log_Error mencatat penyebabnya, dan coba ulang dengan id yang sama tidak membuat data dobel (T-19, T-20).
- **"Bagaimana mencegah prospek dobel?"** `kunci_normal` (huruf kecil, tanpa tanda baca, tanpa "PT" dan "Simulasi") + pencarian per ID; Histori mencatat `duplikat_terdeteksi` (T-09, T-10).
- **"Di mana API key disimpan?"** Hanya di credential store n8n; `.env` tidak di-commit; log menyamarkan pola kunci; repo dipindai di T-28.
- **"Berapa biayanya?"** Sekitar 2.900 token masuk dan 150–200 token keluar per pertanyaan; dua panggilan per pertanyaan (jawaban + draf). Model lokal (Ollama) dicatat sebagai pengembangan lanjut untuk data yang tidak boleh keluar dari laptop.

## 7. Keterbatasan (jujur disampaikan)

- Penulisan bersamaan tidak dikunci (KA-03); cukup untuk demo satu pengguna, produksi butuh database transaksional.
- Pemilih peran adalah simulasi, bukan autentikasi.
- Jadwal WF-04 pukul 08.00 dan WF-05 belum teramati terpicu sungguhan; logikanya teruji lewat pemicu manual dan simulasi.
- Pola pemeriksa berbasis kata; ungkapan janji yang sangat tidak lazim bisa lolos, sehingga persetujuan staf tetap wajib sebelum draf dipakai.
