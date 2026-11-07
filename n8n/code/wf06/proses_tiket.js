// WF-06 langkah "Proses Tiket" (Baru -> Ditangani -> Selesai; jawab lewat draf). Mode: Run Once for All Items.
// Saat dirakit, sheet_tulis.js dan aturan_tiket.js ditempel di atas bagian ini. Satu batchUpdate atomik per permintaan.
const m = $('Validasi Tiket').first().json;
const D = $('Olah Sheet Tiket').first().json;
const waktu = $now.setZone('Asia/Jakarta').startOf('second').toISO({ suppressMilliseconds: true });
return [{ json: prosesTiket(D, m, waktu) }];
