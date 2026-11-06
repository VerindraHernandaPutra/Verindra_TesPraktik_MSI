// WF-02 node "Validasi Panel" (GET /panel?peran=...). Mode: Run Once for All Items.
const q = $input.first().json.query || {};
const peran = String(q.peran ?? '').trim().toLowerCase();
const valid = ['staf', 'ae_a', 'ae_b', 'admin'].includes(peran);
return [{ json: { valid, pesan: valid ? '' : 'Peran tidak dikenal. Gunakan staf, ae_a, ae_b, atau admin.', peran } }];
