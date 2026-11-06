// WF-01 node "Olah Data Sheet". Mode: Run Once for All Items.
// Mengubah respons spreadsheets.get (semua sheet dalam satu panggilan) menjadi:
//   tabel[sheet]  = daftar baris sebagai objek {kolom: nilai}
//   header[sheet] = urutan kolom (dipakai saat menulis)
//   gid[sheet]    = sheetId numerik (dipakai appendCells)
const SHEET_WAJIB = ['Konfigurasi', 'KB', 'Prospek', 'Histori', 'Percakapan', 'Antrean_Staf', 'Draf'];

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
    .slice(1)
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => Object.fromEntries(kolom.map((k, i) => [k, r[i] ?? ''])));
}

const hilang = SHEET_WAJIB.filter((s) => !(s in tabel) || header[s].length === 0);
if (hilang.length) throw new Error('Sheet tidak ditemukan atau tanpa header: ' + hilang.join(', '));

return [{ json: { tabel, header, gid } }];
