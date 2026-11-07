// WF-06 langkah "Validasi Peserta" (E-02, POST /peserta: tambah, ubah, arsip). Mode: Run Once for All Items.
// Saat dirakit, normalisasi_kunci.js, sheet_tulis.js, aturan_pendaftaran.js, dan aturan_peserta.js ditempel di atas bagian ini.
return [{ json: validasiPeserta($input.first().json.body || {}) }];
