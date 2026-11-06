// WF-02 node "Validasi Panel" (GET /panel?peran=...). Mode: Run Once for All Items.
const q = $input.first().json.query || {};
const peran = String(q.peran ?? '').trim().toLowerCase();
const valid = ['staf', 'ae_a', 'ae_b', 'admin'].includes(peran);
// ekspor=1: sertakan baris lengkap Prospek dan Histori untuk Ekspor CSV (FR-19).
const ekspor = String(q.ekspor ?? '') === '1';
return [{ json: { valid, pesan: valid ? '' : 'Peran tidak dikenal. Gunakan staf, ae_a, ae_b, atau admin.', peran, ekspor } }];
