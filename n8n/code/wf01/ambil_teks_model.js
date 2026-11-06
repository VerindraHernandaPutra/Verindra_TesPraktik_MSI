// Langkah "Ambil Teks Model" dan "Ambil Teks Draf" / "Ambil Teks Penawaran". Mode: Run Once for All Items.
// Mengambil teks jawaban dari respons Claude Messages API.
const r = $input.first().json;

// Respons bisa diawali blok thinking; jawaban ada di blok bertipe text.
const teks = (r.content || [])
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('');
const catatan = r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens' ? r.stop_reason : null;

return [{ json: { keluaran_model: teks, catatan_model: catatan, model_ai: 'claude' } }];
