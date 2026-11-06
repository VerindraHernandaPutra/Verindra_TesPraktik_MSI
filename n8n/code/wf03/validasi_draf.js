// WF-03 node "Validasi Draf" (FR-23, POST /prospek/draf). Mode: Run Once for All Items.
// Masukan: id_prospek, catatan (catatan AE), oleh (ae_a | ae_b | admin).
const body = $input.first().json.body || {};
const id_prospek = String(body.id_prospek ?? '').trim().toUpperCase();
const catatan = String(body.catatan ?? '').trim();
const oleh = String(body.oleh ?? '').trim().toLowerCase();

const pesan = [];
if (!/^P\d{2,}$/.test(id_prospek)) pesan.push('id_prospek tidak valid.');
if (!catatan) pesan.push('Catatan tidak boleh kosong.');
if (catatan.length > 1000) pesan.push('Catatan maksimal 1000 karakter.');
if (!['ae_a', 'ae_b', 'admin'].includes(oleh)) pesan.push('Hanya AE atau admin yang boleh meminta draf penawaran.');

return [{ json: { valid: pesan.length === 0, pesan: pesan.join(' '), id_prospek, catatan, oleh } }];
