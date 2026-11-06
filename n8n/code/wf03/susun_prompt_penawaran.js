// WF-03 node "Susun Prompt Penawaran" (FR-23, AR-08). Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/sheet_tulis.js ditempel di atas bagian ini (AKTOR).
// Nilai bertanda /*@...*/ diisi oleh scripts/build_workflows.py.
const PROMPT = /*@PROMPT_PENAWARAN*/ null;
const SKEMA_DRAF = /*@SKEMA_DRAF*/ null;
const CFG = /*@CFG*/ null;

const m = $('Validasi Draf').first().json;
const T = $('Olah Sheet Draf').first().json.tabel;

const tolak = (pesan) => [{ json: { boleh: false, pesan } }];
const p = T.Prospek.find((r) => String(r.id_prospek).trim().toUpperCase() === m.id_prospek);
if (!p) return tolak(`Prospek ${m.id_prospek} tidak ditemukan.`);
const aktor = AKTOR[m.oleh];
if (m.oleh !== 'admin' && String(p.ae).trim() !== aktor) {
  return tolak(`Prospek ${m.id_prospek} milik ${p.ae}; ${aktor} tidak boleh meminta draf untuk prospek ini.`);
}

const kb = T.KB.filter((r) => String(r.aktif).trim().toUpperCase() === 'TRUE' && String(r.kode || '').trim());
if (!kb.length) throw new Error('Sheet KB tidak berisi butir aktif.');
const daftarKb = kb.map((r) => `- ${r.kode} | ${r.tindakan} | ${r.topik} | ${r.isi}`).join('\n');
const konfig = Object.fromEntries(T.Konfigurasi.map((r) => [String(r.kunci).trim(), String(r.nilai ?? '').trim()]));
const modelAi = String(konfig.MODEL_AI || 'claude').toLowerCase() === 'ollama' ? 'ollama' : 'claude';

const dataProspek = [
  `Nama perusahaan: ${p.nama_perusahaan}`,
  `Sektor: ${p.sektor || '-'}`,
  `Status pipeline: ${p.status}`,
  `Kebutuhan: ${p.kebutuhan || '-'} (status: ${p.status_kebutuhan || 'Belum terkonfirmasi'})`,
].join('\n');

// Fungsi pengganti dipakai agar karakter "$" di data tidak ditafsirkan oleh String.replace.
const system = PROMPT.replace('[[DAFTAR_KB]]', () => daftarKb)
  .replace('[[DATA_PROSPEK]]', () => dataProspek)
  .replace('[[CATATAN_AE]]', () => m.catatan);
const perintah = 'Susun draf penawaran sesuai aturan di atas.';

const body =
  modelAi === 'ollama'
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

return [
  {
    json: {
      boleh: true,
      model_ai: modelAi,
      kode_kb_valid: kb.map((r) => String(r.kode).trim()),
      id_prospek: p.id_prospek,
      body_model: body,
    },
  },
];
