// Uji unit penyusun Log_Error (BL-12). Jalankan: node --test "n8n/code/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const { KOLOM_LOG, bersihkan, pesanError, dataMasukanAman, susunBarisLog } = require('./log_error.js');

test('kolom Log_Error sama dengan Section 9', () => {
  assert.deepEqual(KOLOM_LOG, ['id_error', 'waktu', 'workflow', 'node', 'pesan', 'data_masukan']);
});

test('pola kredensial disamarkan', () => {
  const kotor = [
    'gagal dengan key sk-ant-api03-AbC_123-xyz',
    'Authorization: Bearer ya29.a0AfH6SMBx-long.token',
    '{"x-api-key":"rahasia123","model":"x"}',
    'api_key=abcdef123 lalu lanjut',
    'access_token: "tok-999"',
    'client_secret=GOCSPX-abc',
  ];
  for (const k of kotor) {
    const b = bersihkan(k);
    assert.ok(!/sk-ant-api03|ya29\.a0|rahasia123|abcdef123|tok-999|GOCSPX-abc/.test(b), b);
    assert.ok(b.includes('[DISAMARKAN]'), b);
  }
});

test('teks biasa tidak berubah', () => {
  const t = 'MODE_GAGAL aktif: kegagalan simulasi sebelum penyimpanan.';
  assert.equal(bersihkan(t), t);
});

test('pesan diambil dari berbagai bentuk error n8n', () => {
  assert.equal(pesanError('teks'), 'teks');
  assert.equal(pesanError({ message: '401 - Unauthorized', description: 'Kunci salah' }), '401 - Unauthorized — Kunci salah');
  assert.equal(pesanError(null), 'Kesalahan tidak diketahui.');
  assert.match(pesanError({ kode: 5 }), /kode/);
});

test('data_masukan hanya kolom aman, pertanyaan dipotong, kredensial disamarkan', () => {
  const d = JSON.parse(dataMasukanAman({ id_permintaan: 'r1', prospek: 'P03', pertanyaan: 'x'.repeat(500), headers: { 'x-api-key': 'sk-ant-zzz' } }));
  assert.deepEqual(Object.keys(d), ['id_permintaan', 'prospek', 'pertanyaan']);
  const d3 = JSON.parse(dataMasukanAman({ id_draf: 'D0001', keputusan: 'setuju', oleh: 'staf', token: 'rahasia' }));
  assert.deepEqual(d3, { id_draf: 'D0001', keputusan: 'setuju', oleh: 'staf' });
  assert.ok(d.pertanyaan.length <= 200);
  const d2 = dataMasukanAman({ pertanyaan: 'kunci saya sk-ant-api03-RAHASIA' });
  assert.ok(!d2.includes('RAHASIA'));
});

test('id_error berurutan dari baris lama; header tidak ikut dihitung', () => {
  const b = susunBarisLog({ barisLama: [['E0001'], ['E0007'], ['']], waktu: 'w', workflow: 'WF-01 Agent chat', node: 'Cek Mode Gagal', error: { message: 'MODE_GAGAL aktif' }, masukan: {} });
  assert.equal(b.id_error, 'E0008');
  assert.equal(b.node, 'Cek Mode Gagal');
  assert.equal(susunBarisLog({ barisLama: [], waktu: 'w' }).id_error, 'E0001');
});

test('pesan panjang dipotong', () => {
  const b = susunBarisLog({ barisLama: [], waktu: 'w', error: 'e'.repeat(2000) });
  assert.ok(b.pesan.length <= 500);
});
