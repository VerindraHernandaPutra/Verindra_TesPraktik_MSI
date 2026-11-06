// Node "Siapkan Log Error" pada jalur gagal (WF-01, WF-02, WF-03). Mode: Run Once for All Items.
// Menerima keluaran error dari node mana pun; mencatat node asal ($prevNode) dan pesannya.
// WORKFLOW dan NODE_MASUKAN (node validasi masukan) diisi saat dirakit.
const WORKFLOW = /*@WORKFLOW*/ null;
const NODE_MASUKAN = /*@NODE_MASUKAN*/ null;

let masukan = {};
try {
  masukan = $(NODE_MASUKAN).first().json;
} catch (e) {
  masukan = {};
}

const item = $input.first().json || {};
return [
  {
    json: {
      workflow: WORKFLOW,
      node: $prevNode.name,
      error: item.error !== undefined ? item.error : item,
      masukan,
    },
  },
];
