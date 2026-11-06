// WF-01 node "Siapkan Log Error" (FR-16, G5). Mode: Run Once for All Items.
// Menerima keluaran error dari node mana pun di WF-01; mencatat node asal dan pesannya.
let masukan = {};
try {
  masukan = $('Validasi Masukan').first().json;
} catch (e) {
  masukan = {};
}

const item = $input.first().json || {};
return [
  {
    json: {
      workflow: 'WF-01 Agent chat',
      node: $prevNode.name,
      error: item.error !== undefined ? item.error : item,
      masukan,
    },
  },
];
