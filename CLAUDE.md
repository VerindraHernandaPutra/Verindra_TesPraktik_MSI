# CLAUDE.md — Demo MSI-A1A6 (SIMULASI)

Sumber kebenaran: docs/PERENCANAAN.md. Jika ada yang tidak tertulis di sana, tanya dulu.

## Cara kerja
- Kerjakan satu item backlog (BL-xx) per perintah, sesuai urutan Section 12.
- Sebelum menulis kode, sebutkan section yang dipakai dan rencana singkat.
- Setelah selesai: jalankan uji terkait, commit dengan pesan "BL-xx: ...",
  laporkan file yang berubah, hasil uji, dan langkah manual untuk kandidat.
- Jangan menandai item selesai atau uji lulus tanpa benar-benar menjalankannya.

## Aturan tetap
- Nama sheet, kolom, dan nilai status persis seperti Section 9.
- Kontrak webhook persis seperti Section 10.
- Aturan agent AR-01–AR-08 dan pemeriksa PJ-01–PJ-04 persis seperti Section 7.
- Semua teks tampilan dan pesan dalam Bahasa Indonesia; label SIMULASI selalu tampil.
- Konfigurasi dibaca dari .env atau config.js, tidak ditulis langsung di kode.

## Larangan
- Jangan menulis API key, token, atau kata sandi di file mana pun.
- Jangan membuat node atau kode yang mengirim email, WhatsApp, atau pesan keluar.
- Jangan menambah fitur di luar backlog; usulkan dulu.
- Jangan mengubah isi KB atau jawaban acuan tanpa izin kandidat.
- Jangan menghapus atau mengubah baris Histori.
- Jangan membuka n8n ke internet (tanpa tunnel atau port publik).

## Ekstensi E1
- Ikuti docs/EKSTENSI_E1.md; aturan docs/PERENCANAAN.md tetap berlaku.
- Pakai template di web/templates/; jangan mengganti gaya atau struktur template, cukup isi dan sambungkan.
- Nomor HP hanya pola dummy 0812-0000-xxxx; jangan pernah membuat tautan wa.me, tel:, sms:, atau pemanggilan API pengirim.
- Arsip = aktif FALSE; jangan menghapus baris Prospek atau Histori.
- Label SIMULASI wajib tampil di formulir dan tabel peserta.
- Di awal setiap sesi, sebutkan model dan effort yang disarankan (tabel Section 8 EKSTENSI_E1).
