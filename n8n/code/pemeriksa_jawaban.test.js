// Uji unit pemeriksa jawaban (BL-07, T-07). Jalankan: node --test "n8n/code/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const { periksaJawaban, periksaTeks, parseKeluaranModel, TEMPLATE_ESKALASI } = require('./pemeriksa_jawaban.js');

const aturanDari = (r) => r.pelanggaran.map((p) => p.aturan);
const jawaban = (teks, rujukan = ['KB03'], eskalasi = false) => ({
  topik: ['sponsorship'],
  jawaban: teks,
  rujukan_kb: rujukan,
  eskalasi,
  alasan_eskalasi: eskalasi ? 'alasan' : null,
});

test('T-07: "Paket Rp10 juta, dijamin bintang 5" ditolak dan diganti template eskalasi', () => {
  const r = periksaJawaban(jawaban('Paket Rp10 juta, dijamin bintang 5.'));
  assert.equal(r.lolos_pemeriksa, false);
  assert.ok(aturanDari(r).includes('PJ-01'));
  assert.ok(aturanDari(r).includes('PJ-03'));
  assert.equal(r.hasil.jawaban, TEMPLATE_ESKALASI);
  assert.equal(r.hasil.eskalasi, true);
  assert.deepEqual(r.hasil.rujukan_kb, []);
  assert.match(r.hasil.alasan_eskalasi, /PJ-01/);
});

test('jawaban acuan Section 7 lolos tanpa diubah', () => {
  const acuan = [
    jawaban('Sponsorship bersifat opsional dan tidak menentukan hasil penilaian.'),
    jawaban('Saya tidak dapat menjanjikan penghargaan atau level bintang tertentu. Pertanyaan Anda saya teruskan kepada staf.', ['KB04'], true),
    jawaban('Informasi tarif dan jadwal spesifik belum tersedia dalam acuan saya. Jadwal wawancara dikoordinasikan setelah verifikasi, dan pertanyaan Anda akan ditindaklanjuti staf.', ['KB02', 'KB04'], true),
    jawaban('Pendaftaran tes tidak berbiaya.', ['KB01']),
  ];
  for (const a of acuan) {
    const r = periksaJawaban(a);
    assert.equal(r.lolos_pemeriksa, true, a.jawaban + ' -> ' + JSON.stringify(r.pelanggaran));
    assert.equal(r.hasil.jawaban, a.jawaban);
  }
});

test('PJ-01: nominal uang dalam berbagai bentuk tertangkap', () => {
  for (const t of ['Harganya Rp 5.000.000.', 'Biaya paket 10 juta.', 'Sekitar 500 ribu saja.', 'Tarif 2,5 jt per tahun.', 'Harga $200.', 'Biayanya 1.500.000 rupiah.', 'Kurang dari satu miliar.']) {
    assert.ok(aturanDari({ pelanggaran: periksaTeks(t) }).includes('PJ-01'), t);
  }
});

test('PJ-01: kata "biaya" tanpa nominal tidak dianggap pelanggaran', () => {
  assert.deepEqual(periksaTeks('Pendaftaran tes tidak berbiaya dan tidak dipungut biaya.'), []);
});

test('PJ-02: tanggal dan nama hari spesifik tertangkap', () => {
  for (const t of ['Wawancara hari Senin.', "Jadwalnya Jum'at pagi.", 'Tanggal 12 November.', 'Pada 12/11/2026.', 'Pada 2026-11-12.', 'Wawancara besok.', 'Jadwal 9 Nov.', 'tanggal 15 nanti.']) {
    assert.ok(aturanDari({ pelanggaran: periksaTeks(t) }).includes('PJ-02'), t);
  }
});

test('PJ-02: "jadwal" tanpa tanggal tidak dianggap pelanggaran', () => {
  assert.deepEqual(periksaTeks('Jadwal wawancara dikoordinasikan setelah verifikasi.'), []);
});

test('PJ-03: janji yang menyetujui tertangkap', () => {
  for (const t of ['Perusahaan Anda dijamin bintang 5.', 'Anda pasti mendapat penghargaan.', 'Kami menjamin hasilnya.', 'Bisa, bintang 5 untuk Anda.', 'Anda akan mendapatkan penghargaan.', 'Kami menjanjikan penghargaan untuk Anda.']) {
    assert.ok(aturanDari({ pelanggaran: periksaTeks(t) }).includes('PJ-03'), t);
  }
});

test('PJ-03: penolakan janji (bernegasi) tidak dianggap pelanggaran', () => {
  for (const t of ['Saya tidak dapat menjamin bintang 5.', 'Kami tidak menjanjikan penghargaan apa pun.', 'Hasil penilaian tidak dijamin.', 'Bintang 5 belum bisa dipastikan.']) {
    assert.deepEqual(periksaTeks(t), [], t);
  }
});

test('PJ-03: negasi di anak kalimat lain tidak menyelamatkan janji', () => {
  assert.ok(aturanDari({ pelanggaran: periksaTeks('Tidak perlu khawatir, Anda dijamin bintang 5.') }).includes('PJ-03'));
});

test('PJ-04: jawaban tanpa eskalasi wajib punya rujukan', () => {
  const r = periksaJawaban(jawaban('Sponsorship bersifat opsional.', []));
  assert.equal(r.lolos_pemeriksa, false);
  assert.deepEqual(aturanDari(r), ['PJ-04']);
});

test('PJ-04: rujukan di luar KB ditolak', () => {
  const r = periksaJawaban(jawaban('Sponsorship bersifat opsional.', ['KB03', 'KB09']));
  assert.equal(r.lolos_pemeriksa, false);
  assert.match(r.pelanggaran[0].detail, /KB09/);
});

test('PJ-04: jawaban eskalasi tanpa rujukan boleh (pertanyaan di luar KB)', () => {
  const r = periksaJawaban(jawaban('Informasi lokasi acara belum tersedia. Pertanyaan Anda saya teruskan kepada staf.', [], true));
  assert.equal(r.lolos_pemeriksa, true);
});

test('PJ-04: daftar kode KB dari sheet dipakai bila diberikan', () => {
  const r = periksaJawaban(jawaban('Sponsorship bersifat opsional.', ['KB03']), ['KB01', 'KB02']);
  assert.equal(r.lolos_pemeriksa, false);
});

test('keluaran model dalam blok kode markdown tetap bisa diperiksa', () => {
  const teks = '```json\n' + JSON.stringify(jawaban('Sponsorship bersifat opsional.')) + '\n```';
  assert.equal(periksaJawaban(teks).lolos_pemeriksa, true);
});

test('R-05: keluaran bukan JSON diperlakukan sebagai eskalasi, bukan error', () => {
  for (const k of ['Maaf, saya tidak tahu.', '{"jawaban": ', null, '', { jawaban: 'x' }]) {
    const r = periksaJawaban(k);
    assert.equal(r.lolos_pemeriksa, false);
    assert.deepEqual(aturanDari(r), ['FORMAT']);
    assert.equal(r.hasil.eskalasi, true);
    assert.equal(r.hasil.jawaban, TEMPLATE_ESKALASI);
  }
});

test('alasan_eskalasi dinormalkan: null bila tidak eskalasi', () => {
  const r = periksaJawaban({ ...jawaban('Sponsorship bersifat opsional.'), alasan_eskalasi: 'sisa' });
  assert.equal(r.hasil.alasan_eskalasi, null);
});

test('topik di luar daftar dibuang; kosong menjadi "lainnya"', () => {
  const r = periksaJawaban({ ...jawaban('Sponsorship bersifat opsional.'), topik: ['ngawur'] });
  assert.deepEqual(r.hasil.topik, ['lainnya']);
});

const sapaan = (teks) => ({
  topik: ['sapaan'],
  jawaban: teks,
  rujukan_kb: [],
  eskalasi: false,
  alasan_eskalasi: null,
});

test('sapaan murni lolos tanpa rujukan (pengecualian PJ-04)', () => {
  const balasan = 'Halo, saya asisten simulasi layanan awards, bukan staf manusia. Silakan sampaikan pertanyaan Anda.';
  for (const q of ['halo', 'Halo!', 'hai', 'selamat pagi', 'Assalamualaikum', 'terima kasih', 'kamu siapa?', 'siapa anda']) {
    const r = periksaJawaban(sapaan(balasan), undefined, q);
    assert.equal(r.lolos_pemeriksa, true, q + ' -> ' + JSON.stringify(r.pelanggaran));
    assert.equal(r.hasil.eskalasi, false);
  }
});

test('label "sapaan" dari AI tidak cukup bila pertanyaan pengguna bukan sapaan', () => {
  for (const q of ['Halo, apakah harus sponsor?', 'halo harga paket berapa', 'Di mana lokasi acaranya?', 'hai, bisa dijamin bintang 5?', 'Halo saya mau tanya soal jadwal wawancara perusahaan kami minggu ini']) {
    const r = periksaJawaban(sapaan('Acara diadakan di Jakarta.'), undefined, q);
    assert.equal(r.lolos_pemeriksa, false, q);
    assert.deepEqual(aturanDari(r), ['PJ-04'], q);
  }
});

test('sapaan bercampur topik lain tetap wajib rujukan', () => {
  const r = periksaJawaban({ ...sapaan('Halo.'), topik: ['sapaan', 'sponsorship'] }, undefined, 'halo');
  assert.equal(r.lolos_pemeriksa, false);
});

test('balasan sapaan tetap diperiksa PJ-01 sampai PJ-03', () => {
  const r = periksaJawaban(sapaan('Halo! Perusahaan Anda dijamin bintang 5.'), undefined, 'halo');
  assert.equal(r.lolos_pemeriksa, false);
  assert.ok(aturanDari(r).includes('PJ-03'));
});

test('tanpa pertanyaan, pengecualian sapaan tidak berlaku', () => {
  assert.equal(periksaJawaban(sapaan('Halo, saya asisten simulasi.')).lolos_pemeriksa, false);
});

test('parseKeluaranModel mengambil objek JSON di tengah teks', () => {
  assert.deepEqual(parseKeluaranModel('Berikut: {"a": 1} selesai'), { a: 1 });
  assert.equal(parseKeluaranModel('tanpa json'), null);
});
