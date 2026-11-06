// WF-01 node "Susun Prompt Draf" (FR-13, AR-08). Mode: Run Once for All Items.
// Nilai bertanda /*@...*/ diisi oleh scripts/build_workflows.py.
const PROMPT_DRAF = /*@PROMPT_DRAF*/ null;
const SKEMA_DRAF = /*@SKEMA_DRAF*/ null;
const CFG = /*@CFG*/ null;

const s = $('Susun Prompt').first().json;
const p = $('Cari Prospek').first().json.prospek;
const j = $('Periksa Jawaban').first().json;

const dataProspek = [
  `Nama perusahaan: ${p.nama_perusahaan}`,
  `Sektor: ${p.sektor || '-'}`,
  `Kebutuhan: ${p.kebutuhan || '-'} (status: ${p.status_kebutuhan || 'Belum terkonfirmasi'})`,
].join('\n');

const percakapan = [
  `Pertanyaan: ${s.pertanyaan}`,
  `Jawaban agent: ${j.jawaban}`,
  `Rujukan KB: ${j.rujukan_kb.join(', ') || '-'}`,
  `Eskalasi: ${j.eskalasi ? 'ya, ' + (j.alasan_eskalasi || '') : 'tidak'}`,
].join('\n');

// Fungsi pengganti dipakai agar karakter "$" di data tidak ditafsirkan oleh String.replace.
const system = PROMPT_DRAF.replace('[[DAFTAR_KB]]', () => s.daftar_kb)
  .replace('[[DATA_PROSPEK]]', () => dataProspek)
  .replace('[[PERCAKAPAN]]', () => percakapan);
const perintah = 'Susun draf follow-up sesuai aturan di atas.';

const body =
  s.model_ai === 'ollama'
    ? {
        model: CFG.model_ollama,
        stream: false,
        format: SKEMA_DRAF,
        options: { temperature: 0.1 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: perintah },
        ],
      }
    : {
        model: CFG.model_claude,
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: perintah }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SKEMA_DRAF } },
      };

return [{ json: { model_ai: s.model_ai, body_model: body } }];
