// Uji unit aturan tiket eskalasi (Opsi B: ambil, jawab lewat draf, selesai, tutup otomatis saat terkirim).
// Jalankan: node --test "n8n/code/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');

Object.assign(globalThis, require('./normalisasi_kunci.js'), require('./sheet_tulis.js'), require('./aturan_pendaftaran.js'));
Object.assign(globalThis, require('./aturan_tiket.js'));
const { validasiTiket, prosesTiket, tiketDariDraf } = require('./aturan_tiket.js');
const { validasiKirim, prosesKirim } = require('./aturan_peserta.js');

const HEADER = {
  Antrean_Staf: ['id_tiket', 'id_percakapan', 'alasan', 'status', 'ditangani_oleh', 'waktu'],
  Percakapan: ['id_percakapan', 'id_permintaan', 'waktu', 'id_prospek', 'pertanyaan'],
  Draf: ['id_draf', 'id_prospek', 'id_percakapan', 'isi_draf', 'status', 'diputuskan_oleh', 'catatan', 'dibuat', 'diputuskan'],
  Histori: ['id_histori', 'waktu', 'id_prospek', 'aktor', 'jenis', 'nilai_lama', 'nilai_baru', 'catatan'],
  Prospek: ['id_prospek', 'nama_perusahaan', 'no_hp_pic', 'aktif'],
};
const WAKTU = '2026-11-07T10:00:00+07:00';
const baris = (d) => d.map((r, i) => ({ ...r, _baris: i + 2 }));

function dataSheet({ tiket = [], draf = [] } = {}) {
  return {
    tabel: {
      Antrean_Staf: baris(tiket.length ? tiket : [
        { id_tiket: 'T0001', id_percakapan: 'C0002', alasan: 'Jaminan', status: 'Baru', ditangani_oleh: '' },
        { id_tiket: 'T0002', id_percakapan: 'C0003', alasan: 'Harga', status: 'Ditangani', ditangani_oleh: 'Staf' },
        { id_tiket: 'T0003', id_percakapan: 'C0004', alasan: 'Lain', status: 'Selesai', ditangani_oleh: 'Staf' },
      ]),
      Percakapan: baris([
        { id_percakapan: 'C0002', id_prospek: 'P03' }, { id_percakapan: 'C0003', id_prospek: 'P01' }, { id_percakapan: 'C0004', id_prospek: 'P02' },
      ]),
      Draf: baris(draf),
      Histori: baris([]),
      Prospek: baris([{ id_prospek: 'P03', nama_perusahaan: 'PT Simulasi Tani Makmur', no_hp_pic: '0812-0000-0003', aktif: 'TRUE' }]),
    },
    header: HEADER,
    gid: { Antrean_Staf: 44, Percakapan: 33, Draf: 55, Histori: 66, Prospek: 11 },
  };
}

const sel = (reqs, sheet) => reqs.filter((r) => r.updateCells && r.updateCells.range.sheetId === dataSheet().gid[sheet])
  .map((r) => [HEADER[sheet][r.updateCells.range.startColumnIndex], r.updateCells.rows[0].values[0].userEnteredValue.stringValue]);
const baru = (req, sheet) => req.appendCells.rows.map((r) => Object.fromEntries(HEADER[sheet].map((k, i) => [k, r.values[i].userEnteredValue.stringValue])));
const proses = (D, body) => prosesTiket(D, validasiTiket(body), WAKTU);

test('validasi tiket: aksi, peran, catatan selesai, isi jawaban', () => {
  assert.equal(validasiTiket({ id_tiket: 't0001', aksi: 'ambil', oleh: 'staf' }).valid, true);
  assert.match(validasiTiket({ id_tiket: 'T0001', aksi: 'hapus', oleh: 'staf' }).pesan, /ambil, jawab, atau selesai/);
  assert.match(validasiTiket({ id_tiket: 'T0001', aksi: 'ambil', oleh: 'admin' }).pesan, /Hanya peran staf/);
  assert.match(validasiTiket({ id_tiket: 'T0001', aksi: 'selesai', oleh: 'staf' }).pesan, /Catatan penyelesaian wajib/);
  assert.match(validasiTiket({ id_tiket: 'T0001', aksi: 'jawab', oleh: 'staf' }).pesan, /Isi jawaban/);
});

test('ambil: Baru -> Ditangani dengan Histori ubah_tiket; ambil kedua ditolak', () => {
  const h = proses(dataSheet(), { id_tiket: 'T0001', aksi: 'ambil', oleh: 'staf' });
  assert.equal(h.boleh, true);
  assert.deepEqual(sel(h.body_tulis.requests, 'Antrean_Staf'), [['status', 'Ditangani'], ['ditangani_oleh', 'Staf']]);
  const [hi] = baru(h.body_tulis.requests.at(-1), 'Histori');
  assert.deepEqual([hi.jenis, hi.nilai_lama, hi.nilai_baru, hi.id_prospek], ['ubah_tiket', 'Baru', 'Ditangani', 'P03']);
  assert.match(proses(dataSheet(), { id_tiket: 'T0002', aksi: 'ambil', oleh: 'staf' }).pesan, /sudah Ditangani oleh Staf/);
});

test('selesai: dari Baru atau Ditangani dengan catatan; Selesai terkunci', () => {
  const h = proses(dataSheet(), { id_tiket: 'T0002', aksi: 'selesai', oleh: 'staf', catatan: 'Sudah ditelepon' });
  assert.deepEqual(sel(h.body_tulis.requests, 'Antrean_Staf'), [['status', 'Selesai'], ['ditangani_oleh', 'Staf']]);
  const [hi] = baru(h.body_tulis.requests.at(-1), 'Histori');
  assert.equal(hi.catatan, 'T0002; Sudah ditelepon');
  assert.match(proses(dataSheet(), { id_tiket: 'T0003', aksi: 'selesai', oleh: 'staf', catatan: 'x' }).pesan, /sudah Selesai/);
  assert.match(proses(dataSheet(), { id_tiket: 'T0099', aksi: 'ambil', oleh: 'staf' }).pesan, /tidak ditemukan/);
});

test('jawab: membuat draf Menunggu persetujuan bertanda tiket, tiket Ditangani, dua Histori', () => {
  const h = proses(dataSheet(), { id_tiket: 'T0001', aksi: 'jawab', oleh: 'staf', jawaban: 'Penghargaan tidak dapat dijamin; penilaian dilakukan juri.' });
  assert.equal(h.boleh, true);
  assert.equal(h.respons.id_draf, 'D0001');
  const [d] = baru(h.body_tulis.requests[0], 'Draf');
  assert.deepEqual([d.id_prospek, d.id_percakapan, d.status, d.catatan], ['P03', 'C0002', 'Menunggu persetujuan', 'Jawaban staf atas T0001']);
  assert.equal(tiketDariDraf(d), 'T0001');
  assert.deepEqual(sel(h.body_tulis.requests, 'Antrean_Staf'), [['status', 'Ditangani'], ['ditangani_oleh', 'Staf']]);
  const hs = baru(h.body_tulis.requests.at(-1), 'Histori');
  assert.deepEqual(hs.map((x) => x.jenis), ['draf_dibuat', 'ubah_tiket']);
  assert.deepEqual(hs.map((x) => x.id_histori), ['H0001', 'H0002']);
});

test('jawab kedua ditolak selama draf jawaban masih hidup; boleh lagi bila draf sebelumnya Ditolak', () => {
  const hidup = [{ id_draf: 'D0007', status: 'Disetujui', catatan: 'Jawaban staf atas T0002' }];
  assert.match(proses(dataSheet({ draf: hidup }), { id_tiket: 'T0002', aksi: 'jawab', oleh: 'staf', jawaban: 'x' }).pesan, /sudah punya draf jawaban D0007/);
  const ditolak = [{ id_draf: 'D0007', status: 'Ditolak', catatan: 'Jawaban staf atas T0002 | Staf: kurang jelas' }];
  const h = proses(dataSheet({ draf: ditolak }), { id_tiket: 'T0002', aksi: 'jawab', oleh: 'staf', jawaban: 'Jawaban baru' });
  assert.equal(h.boleh, true);
  assert.equal(h.respons.id_draf, 'D0008');
  assert.deepEqual(sel(h.body_tulis.requests, 'Antrean_Staf'), [], 'tiket yang sudah Ditangani tidak diubah lagi');
});

test('kirim draf jawaban staf menutup tiketnya dalam batch yang sama; draf biasa tidak menyentuh tiket', () => {
  const draf = [
    { id_draf: 'D0001', id_prospek: 'P03', status: 'Siap kirim (simulasi)', catatan: 'Jawaban staf atas T0001 | Staf: oke' },
    { id_draf: 'D0002', id_prospek: 'P03', status: 'Siap kirim (simulasi)', catatan: 'Lolos pemeriksa' },
  ];
  const D = dataSheet({ draf });
  const h = prosesKirim(D, validasiKirim({ id_draf: 'D0001', oleh: 'staf' }), WAKTU);
  assert.equal(h.boleh, true);
  assert.equal(h.respons.tiket_selesai, 'T0001');
  assert.deepEqual(sel(h.body_tulis.requests, 'Antrean_Staf'), [['status', 'Selesai'], ['ditangani_oleh', 'Staf']]);
  const hs = baru(h.body_tulis.requests.at(-1), 'Histori');
  assert.deepEqual(hs.map((x) => [x.id_histori, x.jenis, x.nilai_baru]), [['H0001', 'kirim_simulasi', 'Terkirim (simulasi)'], ['H0002', 'ubah_tiket', 'Selesai']]);

  const biasa = prosesKirim(D, validasiKirim({ id_draf: 'D0002', oleh: 'staf' }), WAKTU);
  assert.equal(biasa.respons.tiket_selesai, null);
  assert.deepEqual(sel(biasa.body_tulis.requests, 'Antrean_Staf'), []);
});
