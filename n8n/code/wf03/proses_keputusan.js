// WF-03 node "Proses Keputusan" (FR-14, NFR-05). Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/sheet_tulis.js ditempel di atas bagian ini.
// Transisi yang diizinkan (G4: tidak ada draf Siap kirim tanpa persetujuan staf):
//   setuju     : Menunggu persetujuan -> Disetujui
//   tolak      : Menunggu persetujuan -> Ditolak
//   siap_kirim : Disetujui            -> Siap kirim (simulasi)
// Tidak ada pengiriman nyata di mana pun (S-05).
const TRANSISI = {
  setuju: { dari: 'Menunggu persetujuan', ke: 'Disetujui' },
  tolak: { dari: 'Menunggu persetujuan', ke: 'Ditolak' },
  siap_kirim: { dari: 'Disetujui', ke: 'Siap kirim (simulasi)' },
};

const m = $('Validasi Keputusan').first().json;
const D = $('Olah Sheet Keputusan').first().json;
const draf = D.tabel.Draf.find((d) => String(d.id_draf).trim().toUpperCase() === m.id_draf);

const tolak = (pesan) => [{ json: { boleh: false, pesan } }];
if (!draf) return tolak(`Draf ${m.id_draf} tidak ditemukan.`);

const t = TRANSISI[m.keputusan];
const statusLama = String(draf.status).trim();
if (statusLama !== t.dari) {
  return tolak(
    m.keputusan === 'siap_kirim'
      ? `Draf ${m.id_draf} berstatus "${statusLama}"; hanya draf Disetujui yang boleh ditandai Siap kirim (simulasi).`
      : `Draf ${m.id_draf} berstatus "${statusLama}"; hanya draf Menunggu persetujuan yang bisa disetujui atau ditolak.`
  );
}

const waktu = $now.setZone('Asia/Jakarta').startOf('second').toISO({ suppressMilliseconds: true });
const aktor = AKTOR[m.oleh];

const perubahan = { status: t.ke, diputuskan_oleh: aktor, diputuskan: waktu };
// Catatan keputusan disimpan; catatan pemeriksa sebelumnya (bila ada) dipertahankan di depannya.
if (m.catatan) perubahan.catatan = [String(draf.catatan || '').trim(), `${aktor}: ${m.catatan}`].filter(Boolean).join(' | ');

const histori = {
  id_histori: idBaru('H', nomorBerikut(D.tabel.Histori, 'id_histori')),
  waktu,
  id_prospek: draf.id_prospek,
  aktor,
  jenis: 'draf_diputuskan',
  nilai_lama: statusLama,
  nilai_baru: t.ke,
  catatan: `${m.id_draf}${m.catatan ? '; ' + m.catatan : ''}`,
};

return [
  {
    json: {
      boleh: true,
      body_tulis: { requests: [...ubahSel(D, 'Draf', draf, perubahan), tambahBaris(D, 'Histori', [histori])] },
      respons: { status: 'ok', id_draf: m.id_draf, status_draf: t.ke },
    },
  },
];
