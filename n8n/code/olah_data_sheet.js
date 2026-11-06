// Node "Olah Data Sheet" (dipakai WF-01, WF-02, WF-03). Mode: Run Once for All Items.
// Mengubah respons spreadsheets.get (beberapa sheet dalam satu panggilan) menjadi:
//   tabel[sheet]  = daftar baris sebagai objek {kolom: nilai, _baris: nomor baris di sheet (1 = header)}
//   header[sheet] = urutan kolom (dipakai saat menulis)
//   gid[sheet]    = sheetId numerik (dipakai appendCells dan updateCells)
// SHEET_WAJIB diisi saat dirakit.
const SHEET_WAJIB = /*@SHEET_WAJIB*/ null;

const res = $input.first().json;
const tabel = {};
const header = {};
const gid = {};

for (const sh of res.sheets || []) {
  const judul = sh.properties.title;
  gid[judul] = sh.properties.sheetId;
  const baris = ((sh.data && sh.data[0] && sh.data[0].rowData) || []).map((r) =>
    (r.values || []).map((c) => (c && c.formattedValue != null ? String(c.formattedValue) : ''))
  );
  const kolom = (baris[0] || []).map((k) => k.trim());
  header[judul] = kolom;
  tabel[judul] = baris
    .map((r, i) => ({ r, nomor: i + 1 }))
    .slice(1)
    .filter(({ r }) => r.some((v) => v.trim() !== ''))
    .map(({ r, nomor }) => ({ ...Object.fromEntries(kolom.map((k, i) => [k, r[i] ?? ''])), _baris: nomor }));
}

const hilang = SHEET_WAJIB.filter((s) => !(s in tabel) || header[s].length === 0);
if (hilang.length) throw new Error('Sheet tidak ditemukan atau tanpa header: ' + hilang.join(', '));

return [{ json: { tabel, header, gid } }];
