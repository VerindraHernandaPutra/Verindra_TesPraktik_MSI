// WF-03 node "Siapkan Draf Penawaran" (FR-23, NFR-05). Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/sheet_tulis.js ditempel di atas bagian ini.
// Menambah baris Draf (status Menunggu persetujuan, id_percakapan kosong) dan Histori draf_dibuat
// dalam satu batchUpdate atomik. Prospek tidak diubah: kebutuhan tetap Belum terkonfirmasi.
const m = $('Validasi Draf').first().json;
const D = $('Olah Sheet Draf').first().json;
const s = $('Susun Prompt Penawaran').first().json;
const cek = $('Periksa Draf').first().json;

const waktu = $now.setZone('Asia/Jakarta').startOf('second').toISO({ suppressMilliseconds: true });
const aktor = AKTOR[m.oleh];
const idDraf = idBaru('D', nomorBerikut(D.tabel.Draf, 'id_draf'));

const draf = {
  id_draf: idDraf,
  id_prospek: s.id_prospek,
  id_percakapan: '', // Section 9: kosong bila draf dibuat AE dari catatan CRM
  isi_draf: cek.isi_draf,
  status: 'Menunggu persetujuan',
  diputuskan_oleh: '',
  catatan: [`Catatan ${aktor}: ${m.catatan}`, cek.catatan].filter(Boolean).join(' | '),
  dibuat: waktu,
  diputuskan: '',
};
const histori = {
  id_histori: idBaru('H', nomorBerikut(D.tabel.Histori, 'id_histori')),
  waktu,
  id_prospek: s.id_prospek,
  aktor,
  jenis: 'draf_dibuat',
  nilai_lama: '',
  nilai_baru: idDraf,
  catatan: 'Draf penawaran AI dari catatan AE',
};

return [
  {
    json: {
      body_tulis: { requests: [tambahBaris(D, 'Draf', [draf]), tambahBaris(D, 'Histori', [histori])] },
      respons: {
        status: 'ok',
        id_draf: idDraf,
        id_prospek: s.id_prospek,
        isi_draf: cek.isi_draf,
        status_draf: 'Menunggu persetujuan',
      },
    },
  },
];
