// WF-90 node "Proses Konfigurasi Uji". Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/sheet_tulis.js ditempel di atas bagian ini (ubahSel).
const m = $('Validasi Konfigurasi Uji').first().json;
const D = $('Olah Sheet Konfigurasi Uji').first().json;
const baris = D.tabel.Konfigurasi.find((r) => String(r.kunci).trim() === m.kunci);
if (!baris) return [{ json: { boleh: false, pesan: `Kunci ${m.kunci} tidak ada di sheet Konfigurasi.` } }];

return [
  {
    json: {
      boleh: true,
      body_tulis: { requests: ubahSel(D, 'Konfigurasi', baris, { nilai: m.nilai }) },
      respons: { status: 'ok', kunci: m.kunci, nilai_lama: baris.nilai, nilai: m.nilai },
    },
  },
];
