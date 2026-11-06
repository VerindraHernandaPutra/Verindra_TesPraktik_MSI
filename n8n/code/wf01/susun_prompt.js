// WF-01 node "Susun Prompt" (FR-02, FR-03, FR-18, KA-01). Mode: Run Once for All Items.
// Nilai bertanda /*@...*/ diisi oleh scripts/build_workflows.py dari n8n/prompts/ dan .env.
const SYSTEM_PROMPT = /*@PROMPT_AGENT*/ null;
const SKEMA_JAWABAN = /*@SKEMA_JAWABAN*/ null;
const CFG = /*@CFG*/ null; // { model_claude, model_ollama }

const masukan = $('Validasi Masukan').first().json;

// FR-18: KB dibaca ulang dari sheet setiap permintaan; hanya baris aktif = TRUE.
const kb = $('Baca KB')
  .all()
  .map((i) => i.json)
  .filter((r) => String(r.aktif).trim().toUpperCase() === 'TRUE' && String(r.kode || '').trim() !== '');
if (kb.length === 0) throw new Error('Sheet KB tidak berisi butir aktif.');

const konfig = {};
for (const i of $('Baca Konfigurasi').all()) {
  konfig[String(i.json.kunci || '').trim()] = String(i.json.nilai ?? '').trim();
}

const daftarKb = kb.map((r) => `- ${r.kode} | ${r.tindakan} | ${r.topik} | ${r.isi}`).join('\n');
const system = SYSTEM_PROMPT.replace('[[DAFTAR_KB]]', daftarKb);
const modelAi = String(konfig.MODEL_AI || 'claude').toLowerCase() === 'ollama' ? 'ollama' : 'claude';

// Claude Haiku 5.5 menolak parameter temperature; konsistensi dijaga lewat effort rendah
// dan structured outputs (format JSON dijamin skema).
const bodyClaude = {
  model: CFG.model_claude,
  max_tokens: 2000,
  system,
  messages: [{ role: 'user', content: masukan.pertanyaan }],
  output_config: { effort: 'low', format: { type: 'json_schema', schema: SKEMA_JAWABAN } },
};

const bodyOllama = {
  model: CFG.model_ollama,
  stream: false,
  format: SKEMA_JAWABAN,
  options: { temperature: 0.1 },
  messages: [
    { role: 'system', content: system },
    { role: 'user', content: masukan.pertanyaan },
  ],
};

return [
  {
    json: {
      ...masukan,
      model_ai: modelAi,
      kode_kb_valid: kb.map((r) => String(r.kode).trim()),
      body_model: modelAi === 'ollama' ? bodyOllama : bodyClaude,
    },
  },
];
