// Uji unit aturan formulir pendaftaran E1 (EB-03, E-01). Jalankan: node --test "n8n/code/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');

// Di n8n file-file ini ditempel berurutan dalam satu Code node; di sini dipasang sebagai global.
Object.assign(globalThis, require('./normalisasi_kunci.js'), require('./sheet_tulis.js'));
const { normalisasiHpDummy, validasiPendaftaran, prosesPendaftaran } = require('./aturan_pendaftaran.js');

const HEADER_PROSPEK = ['id_prospek', 'nama_perusahaan', 'kunci_normal', 'sektor', 'ae', 'status', 'kebutuhan',
  'status_kebutuhan', 'tgl_tindak_lanjut', 'pengingat', 'dibuat', 'diubah', 'nama_pic', 'no_hp_pic', 'kategori',
  'sumber', 'aktif'];
const HEADER_HISTORI = ['id_histori', 'waktu', 'id_prospek', 'aktor', 'jenis', 'nilai_lama', 'nilai_baru', 'catatan'];
const WAKTU = '2026-11-07T10:00:00+07:00';

function dataSheet(histori = []) {
  const prospek = [
    { id_prospek: 'P01', nama_perusahaan: 'PT Simulasi Surya Reka', kunci_normal: 'surya reka', ae: 'AE A', aktif: 'TRUE' },
    { id_prospek: 'P02', nama_perusahaan: 'PT Simulasi Laut Biru', kunci_normal: 'laut biru', ae: 'AE B', aktif: 'TRUE' },
    { id_prospek: 'P03', nama_perusahaan: 'PT Simulasi Tani Makmur', kunci_normal: 'tani makmur', ae: 'AE A', aktif: 'FALSE' },
  ].map((r, i) => ({ ...r, _baris: i + 2 }));
  return {
    tabel: { Prospek: prospek, Histori: histori.map((r, i) => ({ ...r, _baris: i + 2 })) },
    header: { Prospek: HEADER_PROSPEK, Histori: HEADER_HISTORI },
    gid: { Prospek: 11, Histori: 66 },
  };
}

const BODY_SAH = {
  id_permintaan: 'daftar-1',
  nama_perusahaan: '  PT Simulasi  Contoh Baru ',
  sektor: 'Energi',
  nama_pic: 'Budi Santoso',
  no_hp_pic: '0812 0000 0011',
  kategori: 'CSR',
  pertanyaan: '',
  setuju_simulasi: true,
};

function nilaiBaris(req) {
  return req.appendCells.rows[0].values.map((v) => v.userEnteredValue.stringValue);
}

test('nomor HP: hanya pola dummy 0812-0000-xxxx, dinormalkan dengan tanda hubung', () => {
  for (const v of ['0812-0000-0011', '0812 0000 0011', '081200000011']) assert.equal(normalisasiHpDummy(v), '0812-0000-0011', v);
  for (const v of ['081234567890', '0812-0000-001', '0812-0000-00111', '+62812-0000-0011', '', null]) {
    assert.equal(normalisasiHpDummy(v), null, String(v));
  }
});

test('validasi: body sah lolos dan dirapikan', () => {
  const m = validasiPendaftaran(BODY_SAH);
  assert.equal(m.valid, true, m.pesan);
  assert.equal(m.nama_perusahaan, 'PT Simulasi Contoh Baru');
  assert.equal(m.no_hp_pic, '0812-0000-0011');
});

test('validasi: kolom wajib, kategori, nomor sungguhan, dan centang simulasi ditolak', () => {
  const kasus = [
    [{ nama_perusahaan: '' }, 'Nama perusahaan wajib'],
    [{ nama_perusahaan: 'PT Simulasi' }, 'Nama perusahaan tidak valid'],
    [{ nama_perusahaan: 'P03' }, 'bukan ID prospek'],
    [{ sektor: ' ' }, 'Sektor wajib'],
    [{ nama_pic: '' }, 'Nama PIC wajib'],
    [{ no_hp_pic: '081298765432' }, 'pola dummy'],
    [{ kategori: 'Lainnya' }, 'Kategori tidak valid'],
    [{ setuju_simulasi: false }, 'formulir simulasi'],
    [{ pertanyaan: 'x'.repeat(501) }, 'maksimal 500'],
  ];
  for (const [ubah, potongan] of kasus) {
    const m = validasiPendaftaran({ ...BODY_SAH, ...ubah });
    assert.equal(m.valid, false, JSON.stringify(ubah));
    assert.match(m.pesan, new RegExp(potongan), JSON.stringify(ubah));
  }
  assert.equal(validasiPendaftaran({ ...BODY_SAH, setuju_simulasi: 'true' }).valid, true);
});

test('perusahaan baru: P04 berikutnya, sumber formulir, aktif TRUE, Histori pendaftaran dalam satu batch', () => {
  const D = dataSheet();
  const h = prosesPendaftaran(D, validasiPendaftaran(BODY_SAH), WAKTU);
  assert.equal(h.aksi, 'tulis');
  assert.deepEqual(h.respons, {
    status: 'ok', baru: true, id_prospek: 'P04', nama_perusahaan: 'PT Simulasi Contoh Baru',
    pesan: 'Pendaftaran PT Simulasi Contoh Baru tercatat sebagai P04.', berulang: false,
  });
  const [rp, rh] = h.body_tulis.requests;
  assert.equal(rp.appendCells.sheetId, 11);
  const p = Object.fromEntries(HEADER_PROSPEK.map((k, i) => [k, nilaiBaris(rp)[i]]));
  assert.equal(p.kunci_normal, 'contoh baru');
  assert.equal(p.ae, 'AE B'); // AE A 2 prospek, AE B 1
  assert.equal(p.status, 'Baru');
  assert.equal(p.status_kebutuhan, 'Belum terkonfirmasi');
  assert.equal(p.no_hp_pic, '0812-0000-0011');
  assert.equal(p.sumber, 'formulir');
  assert.equal(p.aktif, 'TRUE');
  const hi = Object.fromEntries(HEADER_HISTORI.map((k, i) => [k, nilaiBaris(rh)[i]]));
  assert.equal(hi.id_histori, 'H0001');
  assert.equal(hi.jenis, 'pendaftaran');
  assert.equal(hi.aktor, 'Formulir');
  assert.ok(hi.catatan.endsWith('; id_permintaan=daftar-1'));
  assert.deepEqual(h.teruskan, { perlu_chat: false, body_chat: null });
});

test('perusahaan sudah ada (ejaan lain): tidak menambah Prospek, hanya Histori duplikat_terdeteksi', () => {
  const h = prosesPendaftaran(dataSheet(), validasiPendaftaran({ ...BODY_SAH, nama_perusahaan: 'PT. Laut Biru' }), WAKTU);
  assert.equal(h.aksi, 'tulis');
  assert.equal(h.body_tulis.requests.length, 1);
  assert.equal(h.body_tulis.requests[0].appendCells.sheetId, 66);
  assert.equal(h.respons.baru, false);
  assert.equal(h.respons.id_prospek, 'P02');
  assert.equal(h.respons.pesan, 'PT Simulasi Laut Biru sudah terdaftar sebagai P02; data tidak ditambah.');
});

test('perusahaan diarsipkan tetap dianggap terdaftar, dengan keterangan arsip', () => {
  const h = prosesPendaftaran(dataSheet(), validasiPendaftaran({ ...BODY_SAH, nama_perusahaan: 'Tani Makmur' }), WAKTU);
  assert.equal(h.respons.id_prospek, 'P03');
  assert.match(h.respons.pesan, /sudah terdaftar sebagai P03.*diarsipkan/);
});

test('permintaan berulang: tidak menulis, mengembalikan hasil lama', () => {
  const histori = [{ id_histori: 'H0001', id_prospek: 'P04', aktor: 'Formulir', jenis: 'pendaftaran',
    nilai_baru: 'PT Simulasi Contoh Baru', catatan: 'Pendaftaran baru dari formulir; kategori CSR; id_permintaan=daftar-1' }];
  const D = dataSheet(histori);
  D.tabel.Prospek.push({ id_prospek: 'P04', nama_perusahaan: 'PT Simulasi Contoh Baru', kunci_normal: 'contoh baru', _baris: 5 });
  const h = prosesPendaftaran(D, validasiPendaftaran(BODY_SAH), WAKTU);
  assert.equal(h.aksi, 'lama');
  assert.equal(h.body_tulis, undefined);
  assert.equal(h.respons.berulang, true);
  assert.equal(h.respons.baru, true);
  assert.equal(h.respons.id_prospek, 'P04');
});

test('id_permintaan lain yang hanya berawalan sama tidak dianggap berulang', () => {
  const histori = [{ id_histori: 'H0001', id_prospek: 'P04', aktor: 'Formulir', jenis: 'pendaftaran',
    catatan: 'Pendaftaran baru dari formulir; kategori CSR; id_permintaan=daftar-10' }];
  const h = prosesPendaftaran(dataSheet(histori), validasiPendaftaran(BODY_SAH), WAKTU);
  assert.equal(h.aksi, 'tulis');
  assert.equal(h.respons.id_prospek, 'P04');
});

test('pertanyaan awal diteruskan ke /chat dengan id_permintaan turunan dan ID prospek', () => {
  const h = prosesPendaftaran(dataSheet(), validasiPendaftaran({ ...BODY_SAH, pertanyaan: 'Apakah ada biaya?' }), WAKTU);
  assert.deepEqual(h.teruskan, {
    perlu_chat: true,
    body_chat: { id_permintaan: 'daftar-1-awal', prospek: 'P04', pertanyaan: 'Apakah ada biaya?' },
  });
});
