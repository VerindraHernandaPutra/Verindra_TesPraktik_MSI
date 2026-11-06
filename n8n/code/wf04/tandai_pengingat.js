// WF-04 node "Tandai Pengingat" (FR-11). Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/sheet_tulis.js ditempel di atas bagian ini (ubahSel).
// Mengisi kolom pengingat di Prospek berdasarkan TANGGAL_SIMULASI (Konfigurasi):
//   tgl_tindak_lanjut <  TANGGAL_SIMULASI -> "Terlewat"
//   tgl_tindak_lanjut == TANGGAL_SIMULASI -> "Jatuh tempo hari ini"
//   lainnya (termasuk tanpa tanggal)      -> kosong
// Hanya sel yang berubah yang ditulis, sehingga menjalankan ulang tanpa perubahan data tidak menulis apa pun.
const D = $('Olah Sheet Pengingat').first().json;
const T = D.tabel;

const konfig = Object.fromEntries(T.Konfigurasi.map((r) => [String(r.kunci).trim(), String(r.nilai ?? '').trim()]));
const tanggal = konfig.TANGGAL_SIMULASI;
if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal || '')) {
  throw new Error('TANGGAL_SIMULASI di sheet Konfigurasi harus berformat YYYY-MM-DD.');
}

const requests = [];
const ditandai = [];
for (const p of T.Prospek.filter((r) => String(r.id_prospek || '').trim())) {
  const tgl = String(p.tgl_tindak_lanjut || '').trim();
  let label = '';
  if (tgl && tgl < tanggal) label = 'Terlewat';
  else if (tgl && tgl === tanggal) label = 'Jatuh tempo hari ini';

  if (label) ditandai.push({ id_prospek: p.id_prospek, nama_perusahaan: p.nama_perusahaan, ae: p.ae, tgl_tindak_lanjut: tgl, pengingat: label });
  if (String(p.pengingat || '').trim() !== label) requests.push(...ubahSel(D, 'Prospek', p, { pengingat: label }));
}

return [
  {
    json: {
      tanggal_simulasi: tanggal,
      ditandai,
      sel_berubah: requests.length,
      body_tulis: { requests },
    },
  },
];
