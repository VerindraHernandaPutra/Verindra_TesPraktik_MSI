// Langkah "Susun Prompt" (FR-02, FR-03, FR-18). Mode: Run Once for All Items.
// Nilai bertanda /*@...*/ diisi oleh scripts/build_workflows.py dari n8n/prompts/ dan .env.
const SYSTEM_PROMPT = /*@PROMPT_AGENT*/ null;
const SKEMA_JAWABAN = /*@SKEMA_JAWABAN*/ null;
const CFG = /*@CFG*/ null; // { model_claude }

const masukan = $('Validasi Masukan').first().json;

// FR-18: KB dibaca ulang dari sheet setiap permintaan; hanya baris aktif = TRUE.
const T = $('Olah Data Sheet').first().json.tabel;
const kb = T.KB.filter((r) => String(r.aktif).trim().toUpperCase() === 'TRUE' && String(r.kode || '').trim() !== '');
if (kb.length === 0) throw new Error('Sheet KB tidak berisi butir aktif.');

const daftarKb = kb.map((r) => `- ${r.kode} | ${r.tindakan} | ${r.topik} | ${r.isi}`).join('\n');
// Fungsi pengganti dipakai agar karakter "$" di isi KB tidak ditafsirkan oleh String.replace.
const system = SYSTEM_PROMPT.replace('[[DAFTAR_KB]]', () => daftarKb);

// Claude Haiku 5.5 menolak parameter temperature; konsistensi dijaga lewat effort rendah
// dan structured outputs (format JSON dijamin skema).
const bodyClaude = {
  model: CFG.model_claude,
  max_tokens: 2000,
  system,
  messages: [{ role: 'user', content: masukan.pertanyaan }],
  output_config: { effort: 'low', format: { type: 'json_schema', schema: SKEMA_JAWABAN } },
};

return [
  {
    json: {
      ...masukan,
      daftar_kb: daftarKb,
      kode_kb_valid: kb.map((r) => String(r.kode).trim()),
      body_model: bodyClaude,
    },
  },
];
