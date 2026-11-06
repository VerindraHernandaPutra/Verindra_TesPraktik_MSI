// WF-90 node "Susun Reset" (Section 13: uji dijalankan pada data seed bersih). Mode: Run Once for All Items.
// Menulis ulang SEMUA sheet dari isi folder seed/ dalam satu batchUpdate atomik:
// updateCells dengan range seluruh sheet membersihkan sel yang tidak tertutup data seed.
// SEED diisi saat dirakit: { namaSheet: [[header...], [baris...], ...] }. Hanya untuk data uji SIMULASI.
const SEED = /*@SEED*/ null;

const res = $input.first().json;
const gid = Object.fromEntries((res.sheets || []).map((s) => [s.properties.title, s.properties.sheetId]));
const hilang = Object.keys(SEED).filter((s) => !(s in gid));
if (hilang.length) throw new Error('Sheet tidak ditemukan: ' + hilang.join(', '));

const requests = Object.entries(SEED).map(([sheet, baris]) => ({
  updateCells: {
    range: { sheetId: gid[sheet] },
    rows: baris.map((r) => ({ values: r.map((v) => ({ userEnteredValue: { stringValue: String(v) } })) })),
    fields: 'userEnteredValue',
  },
}));

return [
  {
    json: {
      body_tulis: { requests },
      ringkasan: Object.fromEntries(Object.entries(SEED).map(([s, b]) => [s, b.length - 1])),
    },
  },
];
