// WF-90 node "Validasi Konfigurasi Uji" (POST /uji/konfigurasi, utilitas run_tests.py). Mode: Run Once for All Items.
// Hanya tiga kunci yang boleh diubah, dengan nilai yang divalidasi ketat.
const body = $input.first().json.body || {};
const kunci = String(body.kunci ?? '').trim();
const nilai = String(body.nilai ?? '').trim();
const ATURAN = {
  MODE_GAGAL: /^(TRUE|FALSE)$/,
  MODEL_AI: /^(claude|ollama)$/,
  TANGGAL_SIMULASI: /^\d{4}-\d{2}-\d{2}$/,
};
const valid = Object.prototype.hasOwnProperty.call(ATURAN, kunci) && ATURAN[kunci].test(nilai);
return [
  {
    json: {
      valid,
      pesan: valid ? '' : 'Kunci atau nilai tidak diizinkan (MODE_GAGAL TRUE/FALSE, MODEL_AI claude/ollama, TANGGAL_SIMULASI YYYY-MM-DD).',
      kunci,
      nilai,
    },
  },
];
