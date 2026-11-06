// Node "Susun Baris Log" (WF-01 jalur gagal dan WF-05). Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/log_error.js ditempel di atas bagian ini.
// Masukan: respons values.get Log_Error (atau item error bila pembacaan gagal).
// NODE_SUMBER diisi saat dirakit: node yang menyiapkan {workflow, node, error, masukan}.
const sumber = $(/*@NODE_SUMBER*/ null).first().json;
const res = $input.first().json || {};
const nilai = Array.isArray(res.values) ? res.values : [];

const header = (nilai[0] || []).map((k) => String(k).trim());
const kolom = KOLOM_LOG.every((k) => header.includes(k)) ? header : KOLOM_LOG;

const baris = susunBarisLog({
  barisLama: nilai.slice(1),
  waktu: $now.setZone('Asia/Jakarta').startOf('second').toISO({ suppressMilliseconds: true }),
  workflow: sumber.workflow,
  node: sumber.node,
  error: sumber.error,
  masukan: sumber.masukan,
});

return [{ json: { baris_log: baris, body_append: { values: [kolom.map((k) => (k in baris ? baris[k] : ''))] } } }];
