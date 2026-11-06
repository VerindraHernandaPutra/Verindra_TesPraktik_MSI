// SIMULASI MSI — Normalisasi nama perusahaan menjadi kunci_normal (FR-08, aturan anti-dobel Section 9).
// Dipakai di WF-01 node "Cari Prospek". Baris module.exports di akhir hanya untuk uji unit.
//
// Aturan: huruf kecil, hapus tanda baca, hapus kata "pt" dan "simulasi", rapikan spasi.
// Contoh: "PT. Simulasi Tani Makmur " -> "tani makmur".

const KATA_DIBUANG = ['pt', 'simulasi'];

function normalisasiKunci(nama) {
  return String(nama || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((kata) => kata && !KATA_DIBUANG.includes(kata))
    .join(' ');
}

// "p3", "P03", "p003" -> "P03"; selain pola ID mengembalikan null.
function normalisasiIdProspek(teks) {
  const m = String(teks || '').trim().match(/^p0*(\d{1,4})$/i);
  return m ? 'P' + m[1].padStart(2, '0') : null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalisasiKunci, normalisasiIdProspek };
}
