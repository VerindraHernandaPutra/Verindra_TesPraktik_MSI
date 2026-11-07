// WF-06 langkah "Proses Kirim" (E-03). Mode: Run Once for All Items.
// Saat dirakit, normalisasi_kunci.js, sheet_tulis.js, aturan_pendaftaran.js, dan aturan_peserta.js ditempel di atas bagian ini.
// Hanya Siap kirim (simulasi) -> Terkirim (simulasi) + Histori kirim_simulasi. Tidak ada node pengirim (S-05).
const m = $('Validasi Kirim').first().json;
const D = $('Olah Sheet Kirim').first().json;
const waktu = $now.setZone('Asia/Jakarta').startOf('second').toISO({ suppressMilliseconds: true });
return [{ json: prosesKirim(D, m, waktu) }];
