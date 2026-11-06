// WF-01 node "Validasi Masukan" (FR-01). Mode: Run Once for All Items.
// Membaca body POST /chat sesuai kontrak Section 10: id_permintaan, prospek, pertanyaan.
const body = $input.first().json.body || {};

const pertanyaan = String(body.pertanyaan ?? '').trim();
const prospek = String(body.prospek ?? '').trim();
const idPermintaan = String(body.id_permintaan ?? '').trim();

const pesan = [];
if (!pertanyaan) pesan.push('Pertanyaan tidak boleh kosong.');
if (!prospek) pesan.push('Identitas prospek (ID P01–P10 atau nama perusahaan) wajib diisi.');

return [
  {
    json: {
      valid: pesan.length === 0,
      pesan: pesan.join(' '),
      id_permintaan: idPermintaan,
      prospek,
      pertanyaan,
    },
  },
];
