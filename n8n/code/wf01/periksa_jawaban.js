// WF-01 node "Periksa Jawaban" (FR-05). Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/pemeriksa_jawaban.js ditempel di atas bagian ini.
const ctx = $('Susun Prompt').first().json;
const keluaran = $input.first().json;

const cek = periksaJawaban(keluaran.keluaran_model, ctx.kode_kb_valid, ctx.pertanyaan);

return [
  {
    json: {
      jawaban: cek.hasil.jawaban,
      rujukan_kb: cek.hasil.rujukan_kb,
      eskalasi: cek.hasil.eskalasi,
      id_prospek: $('Cari Prospek').first().json.prospek.id_prospek,
      // Data untuk langkah 5–8; respons halaman disusun di "Siapkan Langkah 5"
      id_permintaan: ctx.id_permintaan,
      pertanyaan: ctx.pertanyaan,
      topik: cek.hasil.topik,
      alasan_eskalasi: cek.hasil.alasan_eskalasi,
      lolos_pemeriksa: cek.lolos_pemeriksa,
      pelanggaran: cek.pelanggaran,
      model_ai: keluaran.model_ai,
      catatan_model: keluaran.catatan_model,
    },
  },
];
