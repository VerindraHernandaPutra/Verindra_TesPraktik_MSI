// WF-03 node "Proses Status" (FR-09, NFR-05). Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/sheet_tulis.js ditempel di atas bagian ini.
const m = $('Validasi Status').first().json;
const D = $('Olah Sheet Status').first().json;
const p = D.tabel.Prospek.find((r) => String(r.id_prospek).trim().toUpperCase() === m.id_prospek);

const tolak = (pesan) => [{ json: { boleh: false, pesan } }];
if (!p) return tolak(`Prospek ${m.id_prospek} tidak ditemukan.`);

const aktor = AKTOR[m.oleh];
// T-13: AE B tidak boleh mengubah prospek milik AE A (dan sebaliknya).
if (m.oleh !== 'admin' && String(p.ae).trim() !== aktor) {
  return tolak(`Prospek ${m.id_prospek} milik ${p.ae}; ${aktor} tidak boleh mengubah statusnya.`);
}

const statusLama = String(p.status).trim();
if (statusLama === m.status_baru) return tolak(`Prospek ${m.id_prospek} sudah berstatus ${statusLama}.`);

const waktu = $now.setZone('Asia/Jakarta').startOf('second').toISO({ suppressMilliseconds: true });
const histori = {
  id_histori: idBaru('H', nomorBerikut(D.tabel.Histori, 'id_histori')),
  waktu,
  id_prospek: m.id_prospek,
  aktor,
  jenis: 'ubah_status',
  nilai_lama: statusLama,
  nilai_baru: m.status_baru,
  catatan: 'Perubahan status pipeline',
};

return [
  {
    json: {
      boleh: true,
      body_tulis: {
        requests: [
          ...ubahSel(D, 'Prospek', p, { status: m.status_baru, diubah: waktu }),
          tambahBaris(D, 'Histori', [histori]),
        ],
      },
      respons: { status: 'ok', histori },
    },
  },
];
