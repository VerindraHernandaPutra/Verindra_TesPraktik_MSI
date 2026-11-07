// WF-06 langkah "Validasi Pendaftaran" (E-01, POST /pendaftaran). Mode: Run Once for All Items.
// Saat dirakit, normalisasi_kunci.js, sheet_tulis.js, dan aturan_pendaftaran.js ditempel di atas bagian ini.
const body = { ...($input.first().json.body || {}) };
// id_permintaan dipakai untuk idempotensi; bila klien tidak mengirimnya, buat satu (tanpa idempotensi), sama dengan WF-01.
if (!String(body.id_permintaan ?? '').trim()) {
  body.id_permintaan = 'srv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
return [{ json: validasiPendaftaran(body) }];
