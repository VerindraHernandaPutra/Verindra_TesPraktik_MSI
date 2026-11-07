// WF-06 langkah "Cocokkan Prospek" (E-01, FR-08 anti-dobel, NFR-05). Mode: Run Once for All Items.
// Saat dirakit, normalisasi_kunci.js, sheet_tulis.js, dan aturan_pendaftaran.js ditempel di atas bagian ini.
// Hasil: aksi 'lama' (id_permintaan sudah tercatat, tidak menulis) atau 'tulis' (satu batchUpdate atomik).
const m = $('Validasi Pendaftaran').first().json;
const D = $('Olah Sheet Pendaftaran').first().json;
const waktu = $now.setZone('Asia/Jakarta').startOf('second').toISO({ suppressMilliseconds: true });
return [{ json: prosesPendaftaran(D, m, waktu) }];
