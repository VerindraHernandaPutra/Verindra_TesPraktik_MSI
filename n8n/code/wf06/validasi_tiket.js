// WF-06 langkah "Validasi Tiket" (POST /tiket: ambil, jawab, selesai). Mode: Run Once for All Items.
// Saat dirakit, sheet_tulis.js dan aturan_tiket.js ditempel di atas bagian ini.
return [{ json: validasiTiket($input.first().json.body || {}) }];
