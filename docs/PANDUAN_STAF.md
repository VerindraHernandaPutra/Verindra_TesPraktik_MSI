# Panduan Staf dan AE: Layanan Awards (Company Award Website)

> **SIMULASI.** Semua perusahaan dan data bersifat fiktif. Tidak ada pesan yang dikirim ke pihak mana pun.

Halaman: **http://localhost:8000** (situs publik). Panel admin: **http://localhost:8000/admin/** (menu di sisi kiri: Tabel Peserta, Panel Staf, Dashboard). Pilihan peran adalah simulasi, bukan login.

## Panel Staf (untuk staf layanan)

Halaman ini punya lima kartu ringkasan dan lima tab. Klik sebuah baris untuk membuka detail, atau pakai **ikon aksi** di kolom Aksi untuk langkah cepat.

**Antrean eskalasi** berisi pertanyaan yang tidak boleh dijawab penuh oleh asisten AI: tarif, jaminan penghargaan, jadwal spesifik, atau topik di luar acuan. Setiap tiket menampilkan pertanyaan, perusahaan, status (Baru, Ditangani), dan usia tiket.
1. **Ambil tiket** agar rekan lain tahu tiket ini sedang ditangani.
2. **Jawab lewat draf**: tulis jawaban untuk calon peserta. Jawaban menjadi draf baru di tab *Menunggu persetujuan* (badge "Jawaban staf") dan mengikuti alur persetujuan di bawah. Saat draf itu terkirim, tiketnya selesai otomatis.
3. **Tandai selesai** bila tiket sudah ditangani di luar sistem. Catatan penyelesaian wajib diisi. Tiket yang Selesai tidak bisa dibuka lagi.

**Menunggu persetujuan** berisi draf pesan yang disusun AI (dari chat atau catatan AE) atau jawaban staf.
1. Baca isi draf dan pertanyaan asalnya.
2. **Setujui** bila isinya benar dan sopan.
3. **Tolak** bila perlu diperbaiki. Catatan wajib diisi, misalnya "Mohon sebutkan bahwa staf akan menghubungi".

**Disetujui**: klik **Tandai Siap kirim (simulasi)** bila siap. Draf tidak pernah bisa ditandai Siap kirim sebelum disetujui staf.

**Siap kirim (simulasi)**: klik **Kirim (simulasi) ke nomor** untuk memindahkan draf ke Terkirim. Tombol ini hanya mengubah status dan mencatat Histori; **tidak ada pesan yang benar-benar dikirim**. Bila prospek belum punya No. HP PIC, tombol Kirim nonaktif dan muncul tautan **Lengkapi di Tabel Peserta**.

**Terkirim (simulasi)**: riwayat draf yang sudah ditandai terkirim, beserta nomor tujuan.

## Tab Dashboard (untuk AE dan admin)

1. Pilih peran: **AE A** dan **AE B** hanya melihat prospek miliknya, **Admin** melihat semua.
2. **Ringkasan** menampilkan jumlah prospek per status dan per AE, tanpa nilai penjualan.
3. **Pengingat**: tanda "!" berarti tindak lanjut terlewat, tanda "•" berarti jatuh tempo hari ini. Klik **Jalankan pengingat** untuk memperbarui tanda di sheet.
4. **Ubah status**: pilih status baru pada baris prospek, lalu klik **Simpan**. Perubahan tercatat di Histori beserta nama peran.
5. **Draf AI**: klik **Catatan & draf AI**, tulis catatan (misalnya "Perlu mengonfirmasi minat program awards"), lalu klik **Buat draf AI**. Draf masuk Panel staf untuk disetujui.
6. **Ekspor CSV** mengunduh daftar prospek dan histori sesuai peran yang dipilih.

## Arti status

| Daftar | Nilai | Arti |
| --- | --- | --- |
| Pipeline prospek | Baru, Kualifikasi, Follow-up, Penawaran draf | Tahap prospek; hanya AE pemilik atau admin yang boleh mengubah |
| Kebutuhan | Belum terkonfirmasi, Terkonfirmasi | Kebutuhan baru selalu Belum terkonfirmasi sampai dipastikan bersama calon peserta |
| Draf | Menunggu persetujuan, Disetujui, Ditolak, Siap kirim (simulasi) | Hanya staf yang memutuskan; Siap kirim hanya setelah Disetujui |
| Tiket | Baru, Ditangani, Selesai | Status tiket eskalasi di sheet Antrean\_Staf |

## Bila ada masalah

| Yang terlihat | Arti | Yang dilakukan |
| --- | --- | --- |
| Pesan merah "Gagal menyimpan, data tidak tercatat" + **Coba ulang** | Layanan sedang bermasalah; tidak ada data yang tersimpan | Klik **Coba ulang**. Permintaan yang sama tidak akan tercatat dua kali. Bila tetap gagal, laporkan ke admin |
| Keterangan "jawaban yang sudah tersimpan" | Pertanyaan yang sama sudah pernah tercatat | Tidak perlu tindakan; tidak ada data ganda |
| Label kuning "Diteruskan ke staf" | Pertanyaan masuk antrean eskalasi | Staf menindaklanjuti dari Panel staf |
| Pesan "tidak boleh mengubah" atau "milik AE lain" | Peran yang dipilih tidak berwenang | Pilih peran yang sesuai |
| "Tidak dapat terhubung ke layanan" | n8n tidak berjalan | Hubungi admin untuk menjalankan n8n (`docker compose up -d`) |

Admin memeriksa sheet **Log\_Error** untuk melihat detail setiap kegagalan.

## Aturan yang selalu berlaku

- Asisten AI hanya menjawab dari knowledge base dan tidak pernah menjanjikan penghargaan, level bintang, harga, atau tanggal.
- Isi knowledge base diubah lewat sheet **KB** oleh admin; perubahan langsung dipakai tanpa mengubah workflow.
- Jangan menulis data pribadi nyata, kata sandi, atau API key di catatan mana pun.
