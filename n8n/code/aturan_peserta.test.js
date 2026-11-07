// Uji unit aturan tabel peserta dan Kirim (simulasi) E1 (EB-03, E-02, E-03). Jalankan: node --test "n8n/code/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');

// Di n8n file-file ini ditempel berurutan dalam satu Code node; di sini dipasang sebagai global.
Object.assign(globalThis, require('./normalisasi_kunci.js'), require('./sheet_tulis.js'), require('./aturan_pendaftaran.js'));
const { validasiPeserta, prosesPeserta, validasiKirim, prosesKirim } = require('./aturan_peserta.js');

const HEADER = {
  Prospek: ['id_prospek', 'nama_perusahaan', 'kunci_normal', 'sektor', 'ae', 'status', 'kebutuhan', 'status_kebutuhan',
    'tgl_tindak_lanjut', 'pengingat', 'dibuat', 'diubah', 'nama_pic', 'no_hp_pic', 'kategori', 'sumber', 'aktif'],
  Histori: ['id_histori', 'waktu', 'id_prospek', 'aktor', 'jenis', 'nilai_lama', 'nilai_baru', 'catatan'],
  Draf: ['id_draf', 'id_prospek', 'id_percakapan', 'isi_draf', 'status', 'diputuskan_oleh', 'catatan', 'dibuat', 'diputuskan'],
};
const WAKTU = '2026-11-07T10:00:00+07:00';

function dataSheet({ histori = [], draf = [] } = {}) {
  const baris = (daftar) => daftar.map((r, i) => ({ ...r, _baris: i + 2 }));
  return {
    tabel: {
      Prospek: baris([
        { id_prospek: 'P01', nama_perusahaan: 'PT Simulasi Surya Reka', kunci_normal: 'surya reka', sektor: 'Manufaktur', ae: 'AE A',
          nama_pic: 'Rina Pratiwi', no_hp_pic: '0812-0000-0001', kategori: 'CSR', aktif: 'TRUE' },
        { id_prospek: 'P02', nama_perusahaan: 'PT Simulasi Laut Biru', kunci_normal: 'laut biru', sektor: 'Logistik', ae: 'AE B',
          nama_pic: 'Doni Saputra', no_hp_pic: '0812-0000-0002', kategori: 'CSR', aktif: 'TRUE' },
        { id_prospek: 'P03', nama_perusahaan: 'PT Simulasi Tani Makmur', kunci_normal: 'tani makmur', ae: 'AE A',
          no_hp_pic: '0812-0000-0003', aktif: 'FALSE' },
        { id_prospek: 'P11', nama_perusahaan: 'PT Simulasi Dari Chat', kunci_normal: 'dari chat', ae: 'AE A', no_hp_pic: '', aktif: 'TRUE' },
      ]),
      Histori: baris(histori),
      Draf: baris(draf),
    },
    header: HEADER,
    gid: { Prospek: 11, Histori: 66, Draf: 55 },
  };
}

const TAMBAH = {
  aksi: 'tambah', oleh: 'admin', id_permintaan: 'tbh-1', nama_perusahaan: 'PT Simulasi Peserta Baru', sektor: 'Energi',
  nama_pic: 'Budi Santoso', no_hp_pic: '081200000020', kategori: 'Digital',
};

const nilai = (req) => req.appendCells.rows.map((r) => r.values.map((v) => v.userEnteredValue.stringValue));
const sebagaiObjek = (sheet, req) => nilai(req).map((r) => Object.fromEntries(HEADER[sheet].map((k, i) => [k, r[i]])));
const selDiubah = (reqs) =>
  reqs.filter((r) => r.updateCells).map((r) => [HEADER.Prospek[r.updateCells.range.startColumnIndex], r.updateCells.rows[0].values[0].userEnteredValue.stringValue]);

test('validasi peserta: aksi, peran, kolom, dan hak AE', () => {
  assert.equal(validasiPeserta(TAMBAH).valid, true);
  assert.match(validasiPeserta({ ...TAMBAH, aksi: 'hapus' }).pesan, /tambah, ubah, atau arsip/);
  assert.match(validasiPeserta({ ...TAMBAH, oleh: 'staf' }).pesan, /admin atau AE/);
  assert.match(validasiPeserta({ ...TAMBAH, no_hp_pic: '081234567890' }).pesan, /Nomor HP PIC tidak valid/);
  assert.match(validasiPeserta({ ...TAMBAH, oleh: 'ae_a', ae: 'AE B' }).pesan, /Hanya admin yang boleh menentukan AE/);
  assert.match(validasiPeserta({ aksi: 'ubah', oleh: 'admin', id_prospek: 'P01' }).pesan, /Tidak ada kolom/);
  assert.match(validasiPeserta({ aksi: 'arsip', oleh: 'admin', id_prospek: 'x' }).pesan, /id_prospek tidak valid/);
  assert.equal(validasiPeserta({ aksi: 'ubah', oleh: 'ae_a', id_prospek: 'p01', nama_pic: ' Rina  P ' }).data.nama_pic, 'Rina P');
});

test('tambah: ID berikutnya, sumber admin, Histori pendaftaran; AE memakai dirinya sendiri', () => {
  const h = prosesPeserta(dataSheet(), validasiPeserta(TAMBAH), WAKTU);
  assert.equal(h.boleh, true);
  const [p] = sebagaiObjek('Prospek', h.body_tulis.requests[0]);
  assert.equal(p.id_prospek, 'P12');
  assert.equal(p.sumber, 'admin');
  assert.equal(p.aktif, 'TRUE');
  assert.equal(p.no_hp_pic, '0812-0000-0020');
  assert.equal(p.ae, 'AE B'); // AE A 3, AE B 1
  const [hi] = sebagaiObjek('Histori', h.body_tulis.requests[1]);
  assert.equal(hi.jenis, 'pendaftaran');
  assert.equal(hi.aktor, 'Admin');
  assert.ok(hi.catatan.endsWith('; id_permintaan=tbh-1'));

  const ae = prosesPeserta(dataSheet(), validasiPeserta({ ...TAMBAH, oleh: 'ae_a' }), WAKTU);
  assert.equal(sebagaiObjek('Prospek', ae.body_tulis.requests[0])[0].ae, 'AE A');
});

test('tambah: perusahaan sudah ada ditolak; id_permintaan berulang mengembalikan hasil lama', () => {
  const dobel = prosesPeserta(dataSheet(), validasiPeserta({ ...TAMBAH, nama_perusahaan: 'Laut Biru' }), WAKTU);
  assert.deepEqual(dobel, { boleh: false, pesan: 'PT Simulasi Laut Biru sudah terdaftar sebagai P02; data tidak ditambah.' });

  const histori = [{ id_histori: 'H0001', id_prospek: 'P12', aktor: 'Admin', jenis: 'pendaftaran', catatan: 'Ditambah dari tabel peserta; id_permintaan=tbh-1' }];
  const lama = prosesPeserta(dataSheet({ histori }), validasiPeserta(TAMBAH), WAKTU);
  assert.equal(lama.lama, true);
  assert.equal(lama.body_tulis, undefined);
  assert.equal(lama.respons.id_prospek, 'P12');
  assert.equal(lama.respons.berulang, true);
});

test('ubah: hanya kolom yang berubah, satu Histori ubah_peserta per kolom, kunci_normal ikut nama', () => {
  const m = validasiPeserta({ aksi: 'ubah', oleh: 'ae_a', id_prospek: 'P01', nama_pic: 'Rina Pratiwi', no_hp_pic: '0812-0000-0099',
    nama_perusahaan: 'PT Simulasi Surya Reka Baru' });
  const h = prosesPeserta(dataSheet(), m, WAKTU);
  assert.equal(h.boleh, true);
  assert.deepEqual(h.respons.diubah, ['nama_perusahaan', 'no_hp_pic']);
  assert.deepEqual(selDiubah(h.body_tulis.requests), [
    ['nama_perusahaan', 'PT Simulasi Surya Reka Baru'], ['no_hp_pic', '0812-0000-0099'],
    ['kunci_normal', 'surya reka baru'], ['diubah', WAKTU],
  ]);
  const hs = sebagaiObjek('Histori', h.body_tulis.requests.at(-1));
  assert.deepEqual(hs.map((x) => [x.jenis, x.nilai_lama, x.nilai_baru]), [
    ['ubah_peserta', 'PT Simulasi Surya Reka', 'PT Simulasi Surya Reka Baru'],
    ['ubah_peserta', '0812-0000-0001', '0812-0000-0099'],
  ]);
  assert.deepEqual(hs.map((x) => x.id_histori), ['H0001', 'H0002']);
});

test('ubah/arsip ditolak: milik AE lain, tanpa perubahan, nama bentrok, sudah diarsipkan', () => {
  const tolak = (body) => prosesPeserta(dataSheet(), validasiPeserta(body), WAKTU);
  assert.match(tolak({ aksi: 'ubah', oleh: 'ae_b', id_prospek: 'P01', sektor: 'Energi' }).pesan, /milik AE A; AE B tidak boleh/);
  assert.match(tolak({ aksi: 'ubah', oleh: 'admin', id_prospek: 'P01', sektor: 'Manufaktur' }).pesan, /Tidak ada perubahan/);
  assert.match(tolak({ aksi: 'ubah', oleh: 'admin', id_prospek: 'P01', nama_perusahaan: 'PT Laut Biru' }).pesan, /sudah dipakai P02/);
  assert.match(tolak({ aksi: 'arsip', oleh: 'admin', id_prospek: 'P03' }).pesan, /sudah diarsipkan/);
  assert.match(tolak({ aksi: 'arsip', oleh: 'admin', id_prospek: 'P99' }).pesan, /tidak ditemukan/);
});

test('arsip: aktif menjadi FALSE (baris tidak dihapus) dan Histori arsip_peserta', () => {
  const h = prosesPeserta(dataSheet(), validasiPeserta({ aksi: 'arsip', oleh: 'admin', id_prospek: 'P02', catatan: 'Uji arsip' }), WAKTU);
  assert.equal(h.boleh, true);
  assert.deepEqual(selDiubah(h.body_tulis.requests), [['aktif', 'FALSE'], ['diubah', WAKTU]]);
  assert.ok(h.body_tulis.requests.every((r) => r.updateCells || r.appendCells), 'tidak ada permintaan hapus');
  const [hi] = sebagaiObjek('Histori', h.body_tulis.requests.at(-1));
  assert.deepEqual([hi.jenis, hi.nilai_lama, hi.nilai_baru, hi.catatan], ['arsip_peserta', 'TRUE', 'FALSE', 'Uji arsip']);
});

test('kirim (simulasi): hanya staf, hanya dari Siap kirim (simulasi), nomor dummy prospek dicatat', () => {
  assert.match(validasiKirim({ id_draf: 'D0001', oleh: 'admin' }).pesan, /Hanya peran staf/);
  const draf = [
    { id_draf: 'D0001', id_prospek: 'P01', status: 'Siap kirim (simulasi)' },
    { id_draf: 'D0002', id_prospek: 'P01', status: 'Disetujui' },
    { id_draf: 'D0003', id_prospek: 'P03', status: 'Siap kirim (simulasi)' },
    { id_draf: 'D0004', id_prospek: 'P11', status: 'Siap kirim (simulasi)' },
  ];
  const kirim = (id) => prosesKirim(dataSheet({ draf }), validasiKirim({ id_draf: id, oleh: 'staf' }), WAKTU);

  const ok = kirim('D0001');
  assert.equal(ok.boleh, true);
  assert.equal(ok.respons.status_draf, 'Terkirim (simulasi)');
  assert.equal(ok.respons.no_tujuan, '0812-0000-0001');
  const upd = ok.body_tulis.requests[0].updateCells;
  assert.equal(upd.range.sheetId, 55);
  assert.equal(HEADER.Draf[upd.range.startColumnIndex], 'status');
  const [hi] = sebagaiObjek('Histori', ok.body_tulis.requests[1]);
  assert.deepEqual([hi.jenis, hi.aktor, hi.nilai_lama, hi.nilai_baru], ['kirim_simulasi', 'Staf', 'Siap kirim (simulasi)', 'Terkirim (simulasi)']);
  assert.match(hi.catatan, /tujuan 0812-0000-0001/);

  assert.match(kirim('D0002').pesan, /berstatus "Disetujui"; hanya draf Siap kirim/);
  assert.match(kirim('D0003').pesan, /sudah diarsipkan/);
  assert.match(kirim('D0004').pesan, /belum punya nomor HP PIC/);
  assert.match(kirim('D0009').pesan, /tidak ditemukan/);
});
