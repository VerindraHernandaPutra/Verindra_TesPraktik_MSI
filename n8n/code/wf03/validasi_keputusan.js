// WF-03 node "Validasi Keputusan" (FR-14, POST /approve). Mode: Run Once for All Items.
// Masukan: id_draf, keputusan (setuju | tolak | siap_kirim), catatan, oleh (kode peran simulasi).
const body = $input.first().json.body || {};
const id_draf = String(body.id_draf ?? '').trim().toUpperCase();
const keputusan = String(body.keputusan ?? '').trim().toLowerCase();
const catatan = String(body.catatan ?? '').trim();
const oleh = String(body.oleh ?? '').trim().toLowerCase();

const pesan = [];
if (!/^D\d{4,}$/.test(id_draf)) pesan.push('id_draf tidak valid.');
if (!['setuju', 'tolak', 'siap_kirim'].includes(keputusan)) pesan.push('Keputusan harus setuju, tolak, atau siap_kirim.');
// Hanya staf layanan yang boleh meloloskan draf (Section 4, G4).
if (oleh !== 'staf') pesan.push('Hanya peran staf yang boleh memutuskan draf.');
if (keputusan === 'tolak' && !catatan) pesan.push('Catatan wajib diisi saat menolak draf.');

return [{ json: { valid: pesan.length === 0, pesan: pesan.join(' '), id_draf, keputusan, catatan, oleh } }];
