// SIMULASI MSI — Penyusun permintaan spreadsheets.batchUpdate (WF-01, WF-03).
// Semua perubahan satu permintaan dikirim dalam satu batchUpdate, yang diterapkan Google secara atomik.
// D = keluaran node "Olah Data Sheet" ({tabel, header, gid}). Baris module.exports hanya untuk uji unit.

const AKTOR = { staf: 'Staf', ae_a: 'AE A', ae_b: 'AE B', admin: 'Admin' };
const STATUS_PIPELINE = ['Baru', 'Kualifikasi', 'Follow-up', 'Penawaran draf'];
const STATUS_DRAF = ['Menunggu persetujuan', 'Disetujui', 'Ditolak', 'Siap kirim (simulasi)', 'Terkirim (simulasi)'];

function nomorBerikut(baris, kolom) {
  return Math.max(0, ...baris.map((r) => parseInt(String(r[kolom] || '').replace(/\D/g, ''), 10) || 0)) + 1;
}

function idBaru(awalan, nomor) {
  return awalan + String(nomor).padStart(4, '0');
}

function sel(v) {
  return typeof v === 'boolean'
    ? { userEnteredValue: { boolValue: v } }
    : { userEnteredValue: { stringValue: v == null ? '' : String(v) } };
}

// Menambah baris di akhir sheet; kolom mengikuti urutan header sheet itu sendiri.
function tambahBaris(D, sheet, daftar) {
  const kolom = D.header[sheet];
  if (!kolom) throw new Error(`Sheet ${sheet} tidak dibaca.`);
  for (const b of daftar) {
    const asing = Object.keys(b).filter((k) => !kolom.includes(k));
    if (asing.length) throw new Error(`Kolom ${asing.join(', ')} tidak ada di header sheet ${sheet}.`);
  }
  return {
    appendCells: {
      sheetId: D.gid[sheet],
      rows: daftar.map((b) => ({ values: kolom.map((k) => sel(b[k])) })),
      fields: 'userEnteredValue',
    },
  };
}

// Mengubah sel tertentu pada baris yang sudah ada (objek dari tabel, membawa _baris).
function ubahSel(D, sheet, objek, perubahan) {
  if (!objek || !objek._baris || objek._baris < 2) throw new Error(`Baris ${sheet} tidak valid untuk diubah.`);
  return Object.entries(perubahan).map(([k, v]) => {
    const c = D.header[sheet].indexOf(k);
    if (c < 0) throw new Error(`Kolom ${k} tidak ada di header sheet ${sheet}.`);
    return {
      updateCells: {
        range: {
          sheetId: D.gid[sheet],
          startRowIndex: objek._baris - 1,
          endRowIndex: objek._baris,
          startColumnIndex: c,
          endColumnIndex: c + 1,
        },
        rows: [{ values: [sel(v)] }],
        fields: 'userEnteredValue',
      },
    };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AKTOR, STATUS_PIPELINE, STATUS_DRAF, nomorBerikut, idBaru, sel, tambahBaris, ubahSel };
}
