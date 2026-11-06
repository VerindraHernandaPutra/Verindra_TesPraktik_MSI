// WF-03 node "Validasi Status" (FR-09, POST /prospek/status). Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/sheet_tulis.js ditempel di atas bagian ini (STATUS_PIPELINE).
const body = $input.first().json.body || {};
const id_prospek = String(body.id_prospek ?? '').trim().toUpperCase();
const status_baru = String(body.status_baru ?? '').trim();
const oleh = String(body.oleh ?? '').trim().toLowerCase();

const pesan = [];
if (!/^P\d{2,}$/.test(id_prospek)) pesan.push('id_prospek tidak valid.');
// T-14: status di luar daftar Section 9 ditolak.
if (!STATUS_PIPELINE.includes(status_baru)) {
  pesan.push(`Status tidak valid. Pilih salah satu: ${STATUS_PIPELINE.join(', ')}.`);
}
// US-07: AE mengubah status prospeknya sendiri; admin boleh semua.
if (!['ae_a', 'ae_b', 'admin'].includes(oleh)) pesan.push('Hanya AE atau admin yang boleh mengubah status prospek.');

return [{ json: { valid: pesan.length === 0, pesan: pesan.join(' '), id_prospek, status_baru, oleh } }];
