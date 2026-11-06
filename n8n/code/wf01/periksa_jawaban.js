// WF-01 node "Periksa Jawaban" (FR-05). Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/pemeriksa_jawaban.js ditempel di atas bagian ini.
const ctx = $('Susun Prompt').first().json;
const keluaran = $input.first().json;

const cek = periksaJawaban(keluaran.keluaran_model, ctx.kode_kb_valid, ctx.pertanyaan);

// Pencarian prospek berdasarkan nama baru dibuat di BL-10; untuk sekarang hanya ID P01, P02, dst.
const idProspek = /^P\d{2,}$/i.test(ctx.prospek) ? ctx.prospek.toUpperCase() : null;

return [
  {
    json: {
      // Kontrak POST /chat (Section 10)
      status: 'ok',
      jawaban: cek.hasil.jawaban,
      rujukan_kb: cek.hasil.rujukan_kb,
      eskalasi: cek.hasil.eskalasi,
      id_prospek: idProspek,
      id_draf: null,
      // Data untuk langkah 5–8 (BL-10, BL-11); tidak dikirim ke halaman
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
