// Uji unit penyusun batchUpdate (BL-13). Jalankan: node --test "n8n/code/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const { nomorBerikut, idBaru, sel, tambahBaris, ubahSel, STATUS_PIPELINE, STATUS_DRAF } = require('./sheet_tulis.js');

const D = {
  header: { Draf: ['id_draf', 'status', 'catatan'], Histori: ['id_histori', 'jenis'] },
  gid: { Draf: 11, Histori: 22 },
};

test('nilai status sama dengan Section 9', () => {
  assert.deepEqual(STATUS_PIPELINE, ['Baru', 'Kualifikasi', 'Follow-up', 'Penawaran draf']);
  assert.deepEqual(STATUS_DRAF, ['Menunggu persetujuan', 'Disetujui', 'Ditolak', 'Siap kirim (simulasi)']);
});

test('nomor berikutnya melompati nilai kosong dan tidak bergantung urutan', () => {
  assert.equal(nomorBerikut([{ id: 'D0003' }, { id: '' }, { id: 'D0001' }], 'id'), 4);
  assert.equal(nomorBerikut([], 'id'), 1);
  assert.equal(idBaru('H', 7), 'H0007');
});

test('sel: boolean tetap boolean, lainnya teks', () => {
  assert.deepEqual(sel(true), { userEnteredValue: { boolValue: true } });
  assert.deepEqual(sel(null), { userEnteredValue: { stringValue: '' } });
  assert.deepEqual(sel(12), { userEnteredValue: { stringValue: '12' } });
});

test('tambahBaris mengikuti urutan header dan menolak kolom asing', () => {
  const r = tambahBaris(D, 'Histori', [{ jenis: 'ubah_status', id_histori: 'H0001' }]);
  assert.equal(r.appendCells.sheetId, 22);
  assert.deepEqual(r.appendCells.rows[0].values.map((v) => v.userEnteredValue.stringValue), ['H0001', 'ubah_status']);
  assert.throws(() => tambahBaris(D, 'Histori', [{ kolom_lain: 1 }]), /kolom_lain tidak ada di header sheet Histori/);
});

test('ubahSel menunjuk baris dan kolom yang tepat (indeks 0)', () => {
  const [r] = ubahSel(D, 'Draf', { id_draf: 'D0001', _baris: 5 }, { status: 'Disetujui' });
  assert.deepEqual(r.updateCells.range, { sheetId: 11, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 2 });
  assert.equal(r.updateCells.rows[0].values[0].userEnteredValue.stringValue, 'Disetujui');
});

test('ubahSel menolak baris header, baris tanpa nomor, dan kolom asing', () => {
  assert.throws(() => ubahSel(D, 'Draf', { _baris: 1 }, { status: 'x' }), /tidak valid/);
  assert.throws(() => ubahSel(D, 'Draf', {}, { status: 'x' }), /tidak valid/);
  assert.throws(() => ubahSel(D, 'Draf', { _baris: 3 }, { warna: 'x' }), /warna tidak ada/);
});
