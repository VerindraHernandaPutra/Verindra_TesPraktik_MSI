// WF-05 node "Siapkan Log Error" (FR-16). Mode: Run Once for All Items.
// Error Trigger menangkap kegagalan tak terduga di workflow yang memasang WF-05 sebagai error workflow.
const e = $input.first().json || {};
const eksekusi = e.execution || {};

return [
  {
    json: {
      workflow: (e.workflow && e.workflow.name) || 'tidak diketahui',
      node: eksekusi.lastNodeExecuted || '',
      error: eksekusi.error || { message: 'Kesalahan tanpa pesan.' },
      // Error Trigger tidak membawa body permintaan; cukup ID eksekusi untuk ditelusuri di n8n.
      masukan: { id_permintaan: eksekusi.id ? 'eksekusi ' + eksekusi.id : '' },
    },
  },
];
