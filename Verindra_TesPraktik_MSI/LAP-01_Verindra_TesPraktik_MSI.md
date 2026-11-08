# Laporan Tes Praktik AI & Automation Specialist MSI Group

**Kandidat:** Verindra · **Kode bukti laporan:** LAP-01 · **Batas pengumpulan:** 9 November 2026

Seluruh materi adalah SIMULASI TES. Nama perusahaan, isi KB, nomor HP (pola 0812-0000-xxxx), dan tanggal bersifat fiktif, bukan informasi atau kebijakan resmi MSI. Tidak ada kontak nyata dan tidak ada pesan yang dikirim.

## Ringkasan (A0)

| Hal | Keterangan |
| --- | --- |
| Solusi utama | **A1**, tersambung ke **A6** sebagai database dan pipeline |
| Alasan | A1 dan A6 berbagi data yang sama (P03 dipakai di kedua kasus), dan keduanya bisa dibuktikan penuh dengan uji otomatis |
| Waktu aktual | 6 jam |
| Status bukti | A1 dan A6: **berjalan** secara lokal. A2, A3, A4, A5: **rancangan atau contoh terbatas**, belum terbukti sebagai sistem berjalan |
| Hasil uji | 39 dari 39 uji integrasi lulus (7 Nov 2026), 67 dari 67 uji unit lulus (8 Nov 2026) |
| Tools AI | Claude Haiku 5.5 sebagai model di dalam sistem; Claude dan Claude Code untuk perencanaan, penulisan kode, dan uji |
| Kontribusi pribadi | Menentukan lingkup, prioritas, dan keputusan desain; menyiapkan akun dan spreadsheet; meninjau hasil; menguji di peramban; merekam demo |
| Bantuan AI | Sebagian besar kode, dokumen, dan draf laporan ini ditulis Claude Code atas arahan dan tinjauan kandidat |

## Daftar bukti

| Kode | Isi | Lokasi |
| --- | --- | --- |
| A1-D01 | Rekaman demo | Tautan di isian A8 formulir |
| A1-U01 | Hasil uji agent, pemeriksa, keandalan | [A1/A1-U01_hasil_uji.txt](A1/A1-U01_hasil_uji.txt) |
| A1-S01 | Screenshot berurutan | [A1/](A1/) |
| A1-W01 | Workflow, system prompt, kode pemeriksa | [n8n/workflows](../n8n/workflows), [n8n/prompts](../n8n/prompts), [n8n/code](../n8n/code) |
| A6-S01 | Screenshot dashboard, Prospek, Histori | [A6/](A6/) |
| A6-U01 | Hasil uji CRM, draf, dashboard | [A6/A6-U01_hasil_uji.txt](A6/A6-U01_hasil_uji.txt) |
| A2-R01 | Rancangan klip video | [A2-A5/A2-R01_rancangan_klip.md](A2-A5/A2-R01_rancangan_klip.md) |
| A3-R01 | Rancangan aplikasi penilaian | [A2-A5/A3-R01_rancangan_penilaian.md](A2-A5/A3-R01_rancangan_penilaian.md) |
| A4-R01 | Contoh briefing satu halaman | [A2-A5/A4-R01_briefing.md](A2-A5/A4-R01_briefing.md) |
| A5-R01 | Contoh artikel dan rancangan layout | [A2-A5/A5-R01_artikel_layout.md](A2-A5/A5-R01_artikel_layout.md) |
| DOC-01 | Dokumen perencanaan | [docs/PERENCANAAN.md](../docs/PERENCANAAN.md) |

Cara menjalankan demo lokal ada di [README.md](../README.md). Tidak ada kata sandi, API key, atau akses produksi di repo ini.

## A1: AI agent layanan dan prospek awards (solusi utama)

| Aspek | Isi |
| --- | --- |
| Masalah dan pengguna | Asumsi kondisi manual: pertanyaan berulang dijawab tidak konsisten dan berisiko menjanjikan tarif atau penghargaan; prospek yang bertanya ulang tercatat dobel. Pengguna: calon peserta, staf layanan, AE, admin |
| Input | Pertanyaan calon peserta di bubble asisten pada situs publik |
| Proses | n8n membaca KB dan Prospek dari Google Sheets. Claude Haiku 5.5 menjawab hanya dari KB01 sampai KB04 dan menyebut kodenya. Pemeriksa berbasis kode (PJ-01 sampai PJ-04) menolak nominal uang, tanggal, kata janji, dan jawaban tanpa rujukan. Semua baris ditulis dalam satu `batchUpdate` atomik |
| Output | Jawaban dengan kode KB; tiket Antrean eskalasi untuk topik yang perlu staf; draf follow-up berstatus Menunggu persetujuan |
| Tools AI | Claude Haiku 5.5 lewat API. Claude Code untuk membangun |
| Fitur | Rujukan KB, eskalasi otomatis, pencatatan prospek tanpa dobel, siklus tiket staf, persetujuan draf, pesan gagal dengan Coba ulang |
| Keunggulan | Aturan pemeriksa berjalan pasti, tidak bergantung pada AI. KB dapat diubah di sheet tanpa mengubah workflow. Rata-rata respons 5,9 detik (T-26). Rujukan identik pada tiga kali uji (T-08) |
| Pembanding | Dibanding menjawab manual: konsisten dan tercatat, tetapi selisih waktu kerja belum diukur. Dibanding chatbot tanpa KB: setiap jawaban punya sumber yang bisa dicek |
| Peran pribadi | Lihat A0. Kandidat memutuskan alur persetujuan dan aturan eskalasi, lalu meninjau hasil |
| Pemeliharaan | Admin mengubah KB di sheet lalu menjalankan T-01 sampai T-06. `run_tests.py` dijalankan setiap prompt atau workflow berubah. Log_Error ditinjau mingguan |
| Perkiraan biaya | Uji dan demo sekitar 150 pertanyaan: sekitar US$0,07. Gambaran 1.000 pertanyaan per bulan: sekitar US$0,45 dengan Haiku 5.5. Asumsi rinci di DOC-01 Section 17; server produksi tidak diestimasi |
| Batasan | Berjalan lokal, belum produksi. Pemilih peran dan `/admin` tanpa login hanya contoh, bukan pengamanan. Satu pengguna; ID bersamaan bisa bentrok. AI bisa keliru, sehingga dijaga pemeriksa dan persetujuan staf |

**Hasil uji soal (A1-U01)**

| Uji | Kasus | Hasil |
| --- | --- | --- |
| Apakah harus sponsor | T-01 | Lulus: rujukan KB03, tanpa eskalasi |
| Apakah dijamin bintang 5 | T-02 | Lulus: rujukan KB04, eskalasi, tiket dibuat, tanpa janji |
| Berapa harga dan tanggal wawancara | T-03 | Lulus: rujukan KB02 dan KB04, eskalasi, tiket dibuat |
| Upaya membobol aturan | T-06 | Lulus: aturan tetap dipatuhi, eskalasi |
| Duplikasi P03 | T-09, T-10 | Lulus: Prospek tetap 10, Histori `duplikat_terdeteksi` |
| Kegagalan penyimpanan | T-19 | Lulus: HTTP 502, Percakapan tidak bertambah, Log_Error bertambah |
| Coba ulang | T-20, T-21 | Lulus: tepat satu baris, tanpa data ganda |
| Draf menunggu persetujuan | T-15, T-16 | Lulus: berstatus Menunggu persetujuan, tidak bisa ditandai siap kirim sebelum disetujui |

Tombol Kirim hanya mengubah status menjadi "Terkirim (simulasi)" dan mencatat Histori. T-39 memastikan tidak ada `wa.me`, `tel:`, `sms:`, atau node pengirim pesan.

## A6: CRM marketing berbantuan AI

| Aspek | Isi |
| --- | --- |
| Masalah dan pengguna | Asumsi: data prospek tersebar, follow-up bergantung ingatan. Pengguna: AE A, AE B, staf, admin |
| Input | 10 perusahaan fiktif dari soal, pertanyaan dari A1, formulir pendaftaran, catatan dan perubahan status oleh AE |
| Proses | Nama dinormalisasi untuk mencegah dobel. Pengingat harian memakai `TANGGAL_SIMULASI` 2026-11-06. Setiap perubahan dicatat di Histori. AI menyusun draf penawaran dari catatan AE |
| Output | Pipeline, dashboard per status dan per AE, daftar pengingat, ekspor CSV, draf penawaran yang menunggu persetujuan |
| Tools AI | Claude Haiku 5.5 hanya untuk draf penawaran. Pipeline dan pengingat berbasis aturan |
| Fitur | Tabel peserta (cari, filter, tambah, ubah, arsip), PIC, catatan kebutuhan, follow-up, Histori |
| Keunggulan | Data A1 dan A6 tunggal. Arsip memakai `aktif = FALSE`, tanpa menghapus baris. Histori tidak pernah diubah |
| Pembanding | Dibanding spreadsheet manual: dobel dicegah otomatis dan perubahan tercatat. Dibanding CRM berbayar: tanpa biaya lisensi, tetapi fiturnya jauh lebih terbatas |
| Peran pribadi | Lihat A0 |
| Pemeliharaan | Staf meninjau draf harian. Admin menjalankan uji setelah perubahan |
| Perkiraan biaya | Google Sheets dan n8n self-hosted gratis untuk demo. Biaya AI termasuk dalam perkiraan A1 |
| Batasan | Kebutuhan tetap "Belum terkonfirmasi" sampai AE memastikannya. Tanpa nilai penjualan. Tanpa login sungguhan |

**Hasil uji (A6-U01)**

| Uji | Kasus | Hasil |
| --- | --- | --- |
| Pipeline dan dashboard | T-22 | Lulus: Baru 3, Kualifikasi 3, Follow-up 3, Penawaran draf 1; AE A 5, AE B 5 |
| Memasukkan P03 kembali | T-09, T-10 | Lulus: tetap 10 prospek unik |
| Pengingat | T-23 | Lulus: P03 Terlewat, P07 Jatuh tempo hari ini |
| Ubah status dan hak akses | T-12, T-13, T-14, T-24 | Lulus: Histori tercatat, AE lain ditolak, status tidak valid ditolak |
| Draf dari catatan AE | T-30 | Lulus: Menunggu persetujuan, kebutuhan tetap Belum terkonfirmasi |

## A2 sampai A5: rancangan berlabel

Keempat tugas ini bukan solusi utama dan **belum terbukti sebagai sistem berjalan**.

| Aspek | A2 Video AI | A3 Web penilaian | A4 Briefing | A5 Artikel dan layout |
| --- | --- | --- | --- | --- |
| Masalah dan pengguna | Tim media perlu klip pendek dari podcast | Panitia dan juri perlu rekap nilai yang teliti | Tim layanan perlu ringkasan dokumen penjurian | Redaksi perlu artikel yang faktual |
| Input | Naskah sumber soal | Data 6 penilaian soal | Presentasi dan transkrip soal | Fakta fiktif soal |
| Proses | Pilih 00:25–00:55, susun subtitle dan storyboard 9:16 | Validasi skor 0–5, bobot 40/35/25, rata-rata dua juri | Pisahkan fakta, interpretasi, hipotesis | Tulis, periksa fakta, rancang layout |
| Output | Rancangan klip 30 detik, judul, deskripsi | Rancangan aplikasi dan nilai acuan | Briefing satu halaman | Artikel contoh dan rancangan layout |
| Tools AI | Claude untuk draf naskah; alat video belum dipilih | Claude Code bila dibangun | Claude untuk draf | Claude untuk draf |
| Fitur dan keunggulan | Kutipan tidak diubah, label simulasi di layar | Juri belum mengisi tidak dihitung nol | Setiap fakta punya sumber halaman atau timestamp | Tanpa klaim laba dan tanpa kutipan karangan |
| Pembanding | Pemotongan manual | Rekap spreadsheet | Ringkasan bebas tanpa sumber | Siaran pers tanpa pemeriksaan fakta |
| Peran pribadi | Meninjau pilihan bagian dan isi | Menentukan aturan dan memeriksa hitungan | Meninjau interpretasi | Berperan sebagai pemeriksa awal |
| Uji atau kegagalan | Belum diuji | Hitungan acuan diperiksa manual; aplikasi belum diuji | Uji anggaran: dijawab "data belum tersedia" | Jumlah kata dan fakta diperiksa |
| Batasan | Video belum dibuat | Aplikasi belum dibangun | Belum disetujui manajemen | Belum disetujui editor; gambar belum dibuat |
| Pemeliharaan | Daftar periksa per klip | Bobot dapat diatur admin | Templat diperbarui per kasus | Daftar periksa fakta per artikel |
| Perkiraan biaya | Bergantung alat; belum diestimasi | Gratis bila lokal | Sekitar nol | Sekitar nol |
| Bukti | A2-R01 | A3-R01 | A4-R01 | A5-R01 |

Rencana bila dilanjutkan: A3 dibangun lebih dulu karena aturannya paling jelas, lalu A2 setelah alat dan aset berizin dipilih.

## Bagian B dan C

Jawaban Bagian B (kesediaan kerja, gaji, waktu bergabung) dan Bagian C (proyek AI terdahulu) disampaikan langsung pada formulir, karena memuat informasi pribadi yang tidak perlu ditampilkan di tautan ini. Proyek tes ini tidak dihitung ulang sebagai proyek terdahulu.

## Yang belum diuji

| Kasus | Keterangan |
| --- | --- |
| T-25 | Ekspor CSV dibandingkan dengan isi sheet: belum diuji |
| T-29 | Mengubah KB03 di sheet lalu menguji jawaban: belum diuji |
| T-40, T-41, T-43, T-44 | Uji manual di peramban untuk formulir, tabel peserta, bubble asisten, dan Panel Staf: belum tercatat lulus |
| Beban dan penggunaan bersamaan | Tidak diuji; sistem dirancang untuk satu pengguna demo |

Kredit: tampilan situs publik dan panel admin memakai template pihak ketiga Eventify dan Duralux. Gaya dan strukturnya bukan karya kandidat; kandidat dan Claude Code mengisi konten dan menyambungkannya ke n8n.
