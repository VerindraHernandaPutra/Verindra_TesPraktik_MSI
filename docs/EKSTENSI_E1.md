# Perencanaan Ekstensi E1 — Formulir Pendaftaran & CRUD Peserta (Tes Praktik MSI)

Nov 6, 2026 · @ren

## 0. Ringkasan

Ekstensi ini menambah tiga hal ke program A1 + A6 yang sudah jadi: formulir pendaftaran peserta, tabel peserta dengan CRUD, dan tombol Kirim (simulasi) ke nomor HP PIC. Tujuannya agar presentasi bisa bercerita dari perusahaan mendaftar sampai di-follow-up. Perkiraan kerja 1,5–2 jam dengan Claude Code, memakai template one-page dan template admin milik kandidat.

| Atribut | Isi |
| --- | --- |
| Dokumen induk | Dokumen Perencanaan Proyek MSI-A1A6 v1.1; semua aturan di sana tetap berlaku |
| Versi | 1.0 |
| Prinsip | Alur ini simulasi berdasarkan gambaran umum ajang awards, bukan proses resmi MSI |
| Template | One-page template untuk formulir; admin template untuk tabel peserta (milik kandidat) |

## 1. Lingkup

| Masuk lingkup | Tidak masuk lingkup |
| --- | --- |
| Formulir pendaftaran yang membuat prospek baru tanpa dobel | Verifikasi dokumen, jadwal wawancara, penilaian juri, hasil (cukup diagram) |
| Tabel peserta: lihat, cari, tambah, ubah, arsip | Hapus permanen (Histori tidak boleh hilang) |
| Kolom PIC dan nomor HP dummy | Nomor HP sungguhan |
| Tombol Kirim (simulasi) setelah draf disetujui | Tautan wa.me, SMS, email, atau pengiriman nyata apa pun |

## 2. Alur end-to-end untuk presentasi

&#91;embedded content: alur simulasi awards · 5 tahap dibangun, 4 rancangan\]

Baris atas adalah yang bisa didemokan; baris bawah adalah gambaran tahap berikutnya dalam ajang awards dan diberi label rancangan saat presentasi.

## 3. Perubahan data

Kolom baru ditambahkan di sheet Prospek; aturan anti-dobel (kunci\_normal) tetap sama.

| Kolom baru | Isi | Aturan |
| --- | --- | --- |
| nama\_pic | Nama penanggung jawab di perusahaan peserta | Wajib dari formulir; nama fiktif |
| no\_hp\_pic | Nomor HP PIC | Format 08 diikuti 8–11 digit; seed memakai pola dummy 0812-0000-0001 sampai 0812-0000-0010 |
| kategori | Kategori ajang yang diminati | Pilihan simulasi: CSR, Tata Kelola (GRC), Human Capital, Digital, BUMD |
| sumber | Asal data | seed, formulir, chat, atau admin |
| aktif | Status arsip | TRUE atau FALSE; dashboard dan tabel hanya menghitung yang aktif |

Status draf bertambah satu: **Terkirim (simulasi)**, hanya bisa dicapai dari Siap kirim (simulasi). Urutan penuh: Menunggu persetujuan → Disetujui → Siap kirim (simulasi) → Terkirim (simulasi). Jenis Histori bertambah: pendaftaran, ubah\_peserta, arsip\_peserta, kirim\_simulasi.

## 4. Fitur dan endpoint

| ID | Fitur | Endpoint n8n | Perilaku kunci |
| --- | --- | --- | --- |
| E-01 | Formulir pendaftaran di one-page template: nama perusahaan, sektor, nama PIC, no HP PIC, kategori, pertanyaan awal (opsional), centang “Saya memahami ini formulir simulasi” | POST /pendaftaran | Perusahaan baru → P11 dst., status Baru, kebutuhan Belum terkonfirmasi. Perusahaan yang sudah ada → tidak dobel, pesan “sudah terdaftar sebagai P03” |
| E-02 | Tabel peserta di admin template: cari, filter status dan AE, tambah, ubah, arsip dengan konfirmasi | GET /panel (yang sudah ada) dan POST /peserta dengan aksi tambah, ubah, atau arsip | Setiap perubahan menulis Histori; arsip mengubah aktif menjadi FALSE, bukan menghapus baris |
| E-03 | Tombol “Kirim ke 0812-0000-0003 (simulasi)” pada draf berstatus Siap kirim (simulasi) | POST /draf/kirim | Ditolak bila draf belum Siap kirim (simulasi); berhasil → status Terkirim (simulasi) + Histori kirim\_simulasi berisi nomor tujuan; tidak ada node pengirim |

Pertanyaan awal dari formulir (bila diisi) diteruskan ke WF-01 yang sudah ada, sehingga peserta baru langsung mendapat jawaban dari KB dan draf follow-up.

## 5. Backlog dan waktu

| ID | Item | Pelaksana | Perkiraan |
| --- | --- | --- | --- |
| EB-01 | Letakkan kedua template di web/templates/onepage dan web/templates/admin | Kandidat | 5 mnt |
| EB-02 | Tambah kolom baru ke seed dan sheet Prospek, isi no HP dummy P01–P10 | Claude Code + kandidat | 10 mnt |
| EB-03 | WF-06: POST /pendaftaran, POST /peserta, POST /draf/kirim, memakai ulang kode normalisasi kunci | Claude Code | 30 mnt |
| EB-04 | Sambungkan formulir di one-page template ke /pendaftaran | Claude Code | 15 mnt |
| EB-05 | Halaman tabel peserta di admin template + tombol Kirim (simulasi) di panel staf | Claude Code | 30 mnt |
| EB-06 | Rekam tambahan 1 menit dan ambil screenshot formulir, tabel peserta, dan status Terkirim (simulasi) | Kandidat | 10 mnt |

Total sekitar 1 jam 40 menit. Jika waktu mepet, potong filter di tabel peserta lebih dulu.

## 6. Instruksi untuk Claude Code

Tambahkan baris ini ke CLAUDE.md, lalu simpan dokumen ini sebagai docs/EKSTENSI\_E1.md.

```markdown
## Ekstensi E1
- Ikuti docs/EKSTENSI_E1.md; aturan docs/PERENCANAAN.md tetap berlaku.
- Pakai template di web/templates/; jangan mengganti gaya atau struktur template, cukup isi dan sambungkan.
- Nomor HP hanya pola dummy 0812-0000-xxxx; jangan pernah membuat tautan wa.me, tel:, sms:, atau pemanggilan API pengirim.
- Arsip = aktif FALSE; jangan menghapus baris Prospek atau Histori.
- Label SIMULASI wajib tampil di formulir dan tabel peserta.
```

Contoh perintah pertama:

```
Baca docs/EKSTENSI_E1.md. Lihat isi web/templates/onepage dan web/templates/admin,
lalu jelaskan bagian template mana yang akan dipakai untuk formulir dan tabel peserta
sebelum menulis kode. Setelah itu kerjakan EB-02 dan EB-03.
```

## 7. Keputusan kandidat (7 Nov 2026)

- Urutan status draf: Disetujui → Siap kirim (simulasi) → Terkirim (simulasi). Bagian ini menggantikan frasa "hanya dari Disetujui" di versi awal dokumen.
- Halaman web lama (web/index.html) dimigrasi ke template admin; formulir pendaftaran memakai one-page template. Struktur, kelas, dan gaya template dipertahankan; tidak ada gaya buatan sendiri di luar yang sudah ada di template.
- Salinan template ada di web/templates/admin (Duralux) dan web/templates/onepage (Eventify), hanya halaman dan aset yang dipakai.

- Perubahan arah (7 Nov 2026, setelah melihat hasil sesi 5): situs dibuat seperti bisnis nyata. Situs publik (one-page, iklan Company Award Website 2026 + tanya asisten + formulir pendaftaran) di http://localhost:8000/; panel admin tanpa login di http://localhost:8000/admin/. Kata "simulasi" tidak ditampilkan di situs; centang formulir menjadi "Saya menyetujui ketentuan pendaftaran" (nama kolom kontrak setuju\_simulasi tidak berubah); AR-04 agent menjadi "asisten AI program awards". Halaman Chat pindah dari admin ke situs publik. Nilai status di sheet tetap "Siap kirim (simulasi)" dan "Terkirim (simulasi)" (Section 9); tampilan menyembunyikan "(simulasi)".

- R1 (7 Nov 2026): bila perusahaan sudah tercatat (misalnya dari chat) lalu mendaftar, /pendaftaran tidak menambah baris tetapi melengkapi kolom yang masih kosong (sektor, nama\_pic, no\_hp\_pic, kategori) dengan Histori ubah\_peserta per kolom; isi lama tidak pernah ditimpa dan prospek arsip tidak diubah.

- R2 (7 Nov 2026): tema situs publik memakai varian index4 template (terang, aksen biru). Nama merek di kedua situs: "Company Award Website" (judul, logo SVG buatan sendiri, footer, meta). Bagian "Tanya Asisten" dihapus dari halaman; asisten akan menjadi bubble chat mengambang di pojok kanan bawah (R3), sedangkan pendaftaran tetap berupa formulir (#daftar).

- R3 (7 Nov 2026): asisten berupa bubble chat mengambang di situs publik (web/assets/js/asisten.js). Bot meminta nama perusahaan sekali lalu mengingatnya selama halaman terbuka, menawarkan tiga pertanyaan saran, dan memanggil POST /chat; kegagalan memakai Coba ulang dengan id\_permintaan yang sama. Pendaftaran tetap formulir.

- R4 (7 Nov 2026): sidebar admin selaras di semua lebar. Penyebab: tema menyiutkan sidebar lewat CSS di bawah 1600 px, tetapi kelas minimenu (penggeser isi dan header) baru dipasang saat jendela diubah ukurannya; msi-umum.js kini memicu resize sekali saat halaman dimuat. Seed nama “PT Simulasi …” sengaja dibiarkan (keputusan kandidat).

- Penyempurnaan tampilan (7 Nov 2026): Kategori memakai kartu choose-widget template dengan ikon FontAwesome berbeda per kategori; Tahapan memakai garis waktu (komponen kecil di web/assets/css/msi.css, warna dan font template); jarak CTA diperbaiki; logo admin diperkecil dan header admin dirata-tengahkan (web/admin/assets/css/msi-admin.css).

- Tema hitam-kuning (7 Nov 2026): situs publik memakai gradien hitam dan emas dengan menimpa variabel warna template di web/assets/css/msi.css (hero, formulir, dan footer hitam; strip angka dan CTA emas; tombol emas bergradien); admin hanya diberi aksen emas (tombol utama, penomoran halaman, garis header) di web/admin/assets/css/msi-admin.css agar tabel tetap terbaca. Bubble asisten menolak sapaan dan pertanyaan sebagai nama perusahaan.

- S3 (7 Nov 2026): Panel Staf dibangun ulang dari kartu bertumpuk menjadi kartu ringkasan, lima tab (Antrean eskalasi, Menunggu persetujuan, Disetujui, Siap kirim, Terkirim) berisi tabel DataTables, dan modal detail berisi tindakan sesuai status. Draf Siap kirim tanpa No. HP menampilkan peringatan, tombol Kirim nonaktif, dan tautan “Lengkapi di Tabel Peserta” (index.html?lengkapi=Pxx membuka modal ubah prospek itu). Kontrak API tidak berubah.

- Opsi B (7 Nov 2026): tiket eskalasi kini punya siklus Baru → Ditangani → Selesai lewat POST /tiket. Staf bisa mengambil tiket, menjawab lewat draf (draf baru Menunggu persetujuan bertanda “Jawaban staf atas Txxxx” yang mengikuti alur persetujuan biasa), atau menandai selesai dengan catatan. Saat draf jawaban terkirim, tiket ditutup otomatis dalam batch yang sama. Tidak ada kolom sheet baru; jejak di Histori jenis ubah\_tiket.

- Penyesuaian label (7 Nov 2026, setelah membaca panduan A1–A6): tombol dan status pengiriman di panel admin kembali berlabel “Kirim (simulasi)”, “Siap kirim (simulasi)”, dan “Terkirim (simulasi)” agar tidak terbaca sebagai pengiriman nyata (soal: jangan mengirim pesan nyata). Footer kedua situs memuat “Situs demo untuk tes praktik; seluruh data fiktif”. Lokasi karangan (Jakarta) dihapus dari situs publik; kategori dan tahapan penilaian dicatat sebagai konten contoh.

## 8. Rencana sesi dan model

| Sesi | Isi | Model |
| --- | --- | --- |
| 0 | Dokumen, CLAUDE.md, EB-01 | Sonnet Medium |
| 1 | EB-02 kolom baru, seed, WF-90, run\_tests | Sonnet High |
| 2 | EB-03a WF-06 /pendaftaran | Opus High |
| 3 | EB-03b /peserta, /draf/kirim, filter aktif WF-02 | Opus Medium |
| 4 | EB-04 formulir one-page | Sonnet Medium |
| 5 | EB-05 migrasi UI ke template admin, tabel peserta, tombol Kirim | Sonnet High |
| 6 | Uji end-to-end dan review diff | Opus Medium |
| 7 | EB-06 rekaman dan screenshot | Kandidat |
