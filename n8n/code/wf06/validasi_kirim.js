// WF-06 langkah "Validasi Kirim" (E-03, POST /draf/kirim). Mode: Run Once for All Items.
// Saat dirakit, normalisasi_kunci.js, sheet_tulis.js, aturan_pendaftaran.js, dan aturan_peserta.js ditempel di atas bagian ini.
return [{ json: validasiKirim($input.first().json.body || {}) }];
