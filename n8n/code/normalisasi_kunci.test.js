// Uji unit normalisasi kunci (BL-10, T-10). Jalankan: node --test "n8n/code/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalisasiKunci, normalisasiIdProspek } = require('./normalisasi_kunci.js');

test('contoh Section 9: "PT Simulasi Tani Makmur" -> "tani makmur"', () => {
  assert.equal(normalisasiKunci('PT Simulasi Tani Makmur'), 'tani makmur');
});

test('T-10: variasi ejaan "PT. Simulasi Tani Makmur " tetap "tani makmur"', () => {
  for (const v of ['PT. Simulasi Tani Makmur ', 'pt simulasi tani  makmur', 'TANI MAKMUR', 'PT Tani-Makmur', 'PT Simulasi, Tani Makmur.']) {
    assert.equal(normalisasiKunci(v), 'tani makmur', v);
  }
});

test('batasan diketahui: "P.T" ditulis bertitik di tengah menjadi "p t" dan tidak dibuang', () => {
  assert.equal(normalisasiKunci('P.T Simulasi Tani Makmur'), 'p t tani makmur');
});

test('kata "pt" atau "simulasi" di tengah kata tidak ikut terhapus', () => {
  assert.equal(normalisasiKunci('PT Simulasi Optika Simulasindo'), 'optika simulasindo');
});

test('nama kosong atau hanya "PT Simulasi" menghasilkan kunci kosong', () => {
  assert.equal(normalisasiKunci('PT Simulasi'), '');
  assert.equal(normalisasiKunci(''), '');
  assert.equal(normalisasiKunci(null), '');
});

test('kunci_normal di seed Prospek sama dengan hasil normalisasi nama', () => {
  const baris = fs.readFileSync(path.join(__dirname, '../../seed/Prospek.csv'), 'utf8').trim().split(/\r?\n/).slice(1);
  for (const b of baris) {
    const [, nama, kunci] = b.split(',');
    assert.equal(normalisasiKunci(nama), kunci, nama);
  }
});

test('ID prospek dinormalkan; teks lain bukan ID', () => {
  assert.equal(normalisasiIdProspek('P03'), 'P03');
  assert.equal(normalisasiIdProspek(' p3 '), 'P03');
  assert.equal(normalisasiIdProspek('P011'), 'P11');
  assert.equal(normalisasiIdProspek('PT Simulasi Tani Makmur'), null);
  assert.equal(normalisasiIdProspek('P'), null);
  assert.equal(normalisasiIdProspek('Pabrik'), null);
});
