// WF-06 langkah "Proses Peserta" (E-02, FR-08, NFR-05). Mode: Run Once for All Items.
// Saat dirakit, normalisasi_kunci.js, sheet_tulis.js, aturan_pendaftaran.js, dan aturan_peserta.js ditempel di atas bagian ini.
// Arsip = aktif FALSE; setiap perubahan menulis Histori dalam batchUpdate yang sama.
const m = $('Validasi Peserta').first().json;
const D = $('Olah Sheet Peserta').first().json;
const waktu = $now.setZone('Asia/Jakarta').startOf('second').toISO({ suppressMilliseconds: true });
return [{ json: prosesPeserta(D, m, waktu) }];
