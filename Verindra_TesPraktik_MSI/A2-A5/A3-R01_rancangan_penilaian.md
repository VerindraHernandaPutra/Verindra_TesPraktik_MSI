# A3-R01: Rancangan Aplikasi Penilaian Awards (SIMULASI)

**Status: rancangan, belum terbukti. Aplikasi belum dibangun. Angka di bawah dihitung manual sebagai acuan uji.**

## Aturan

Bobot: strategi 40%, implementasi 35%, hasil 25%. Skor 0 sampai 5.

Nilai per juri = jumlah (skor / 5 × bobot). Nilai peserta = rata-rata dua juri, satu desimal.

## Nilai acuan

| Peserta | Juri | Strategi | Implementasi | Hasil | Nilai juri | Nilai peserta |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | J1 | 4 | 3 | 4 | 73,0 | **74,0** |
| S01 | J2 | 4 | 4 | 3 | 75,0 | |
| S02 | J1 | 3 | 4 | 4 | 72,0 | **72,5** |
| S02 | J2 | 4 | 3 | 4 | 73,0 | |
| S03 | J1 | 5 | 4 | 3 | 83,0 | **81,5** |
| S03 | J2 | 4 | 4 | 4 | 80,0 | |

## Fitur

| Fitur | Status |
| --- | --- |
| Akses admin dan juri; juri hanya mengisi nilainya sendiri | Rancangan |
| Input skor dan catatan | Rancangan |
| Validasi skor 0–5 | Rancangan |
| Rekap per peserta, status "belum lengkap" | Rancangan |
| Ekspor CSV | Rancangan |
| Riwayat perubahan (siapa, kapan, nilai lama, nilai baru) | Rancangan |

## Rencana uji

| Uji | Masukan | Hasil yang diharapkan |
| --- | --- | --- |
| Data soal | Enam baris di atas | S01 74,0; S02 72,5; S03 81,5 |
| Bobot berubah | Bobot 50/30/20 untuk S01 | J1 74,0; J2 76,0; peserta 75,0 |
| Skor tidak valid | 6, -1, atau kosong | Ditolak dengan pesan; data tidak berubah |
| Juri belum mengisi | S03 tanpa nilai J2 | S03 ditandai "belum lengkap", bukan dihitung nol |

## Rencana

Dibangun dengan pola yang sama seperti A1: sheet sebagai data, n8n sebagai logika, halaman web sebagai antarmuka. Bukti uji akan diberi kode A3-U01.
