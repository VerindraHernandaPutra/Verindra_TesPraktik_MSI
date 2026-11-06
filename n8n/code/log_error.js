// SIMULASI MSI — Penyusun baris Log_Error (FR-16, Section 9). Dipakai WF-01 (jalur gagal) dan WF-05.
// Aturan Section 9: data_masukan tidak boleh berisi kredensial. Baris module.exports hanya untuk uji unit.

const KOLOM_LOG = ['id_error', 'waktu', 'workflow', 'node', 'pesan', 'data_masukan'];
const BATAS_PESAN = 500;
const BATAS_DATA = 500;

// Menyamarkan pola yang menyerupai kredensial.
function bersihkan(teks) {
  return String(teks == null ? '' : teks)
    .replace(/sk-ant-[A-Za-z0-9_\-]+/g, '[DISAMARKAN]')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/=\-]+/gi, '$1 [DISAMARKAN]')
    .replace(/("?(x-api-key|api[_-]?key|authorization|access_token|refresh_token|client_secret|password|token)"?\s*[:=]\s*)("[^"]*"|[^\s,}]+)/gi, '$1"[DISAMARKAN]"')
    .replace(/ya29\.[A-Za-z0-9._\-]+/g, '[DISAMARKAN]');
}

function potong(teks, batas) {
  const t = String(teks);
  return t.length > batas ? t.slice(0, batas - 1) + '…' : t;
}

// Mengambil pesan yang bisa dibaca dari berbagai bentuk error n8n.
function pesanError(e) {
  if (e == null) return 'Kesalahan tidak diketahui.';
  if (typeof e === 'string') return e;
  const bagian = [e.message, e.description].filter((x) => x && typeof x === 'string');
  return bagian.length ? bagian.join(' — ') : JSON.stringify(e);
}

// Hanya kolom masukan yang aman dan berguna; teks pertanyaan dipotong.
function dataMasukanAman(masukan) {
  const m = masukan || {};
  const aman = {
    id_permintaan: m.id_permintaan || '',
    prospek: m.prospek || '',
    pertanyaan: potong(m.pertanyaan || '', 200),
  };
  return potong(bersihkan(JSON.stringify(aman)), BATAS_DATA);
}

// baris: daftar baris Log_Error yang sudah ada (tanpa header), untuk nomor berikutnya.
function susunBarisLog({ barisLama, waktu, workflow, node, error, masukan }) {
  const nomor =
    Math.max(0, ...(barisLama || []).map((r) => parseInt(String((r && r[0]) || '').replace(/\D/g, ''), 10) || 0)) + 1;
  return {
    id_error: 'E' + String(nomor).padStart(4, '0'),
    waktu,
    workflow: workflow || '',
    node: node || '',
    pesan: potong(bersihkan(pesanError(error)), BATAS_PESAN),
    data_masukan: dataMasukanAman(masukan),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KOLOM_LOG, bersihkan, pesanError, dataMasukanAman, susunBarisLog };
}
