// WF-01 node "Cek Permintaan Lama" (FR-16, NFR-04: idempoten). Mode: Run Once for All Items.
// Jika id_permintaan sudah ada di Percakapan, kembalikan hasil lama tanpa memanggil model atau menulis apa pun.
const m = $('Validasi Masukan').first().json;
const T = $('Olah Data Sheet').first().json.tabel;

const lama = T.Percakapan.find((r) => String(r.id_permintaan).trim() === m.id_permintaan);
if (!lama) return [{ json: { lama: false } }];

const draf = T.Draf.find((d) => String(d.id_percakapan).trim() === String(lama.id_percakapan).trim());
const daftar = (s) =>
  String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

return [
  {
    json: {
      lama: true,
      respons: {
        status: 'ok',
        jawaban: lama.jawaban,
        rujukan_kb: daftar(lama.rujukan_kb),
        eskalasi: String(lama.eskalasi).trim().toUpperCase() === 'TRUE',
        id_prospek: lama.id_prospek || null,
        id_draf: draf ? draf.id_draf : null,
        berulang: true, // Section 11: halaman menampilkan "jawaban yang sudah tersimpan"
      },
    },
  },
];
