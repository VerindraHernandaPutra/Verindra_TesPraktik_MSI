// WF-01 node "Ambil Teks Model" (KA-01). Mode: Run Once for All Items.
// Menyamakan bentuk respons Claude dan Ollama menjadi satu teks keluaran.
const ctx = $('Susun Prompt').first().json;
const r = $input.first().json;

let teks = '';
let catatan = null;

if (ctx.model_ai === 'claude') {
  // Respons bisa diawali blok thinking; jawaban ada di blok bertipe text.
  teks = (r.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') catatan = r.stop_reason;
} else {
  teks = (r.message && r.message.content) || '';
}

return [{ json: { keluaran_model: teks, catatan_model: catatan, model_ai: ctx.model_ai } }];
