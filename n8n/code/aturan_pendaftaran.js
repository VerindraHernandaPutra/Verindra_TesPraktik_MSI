// SIMULASI MSI — Aturan formulir pendaftaran Ekstensi E1 (E-01, POST /pendaftaran di WF-06).
// Fungsi murni; diuji di aturan_pendaftaran.test.js. Baris module.exports hanya untuk uji unit.
// Saat dirakit, normalisasi_kunci.js dan sheet_tulis.js ditempel di atas file ini
// (normalisasiKunci, normalisasiIdProspek, nomorBerikut, idBaru, tambahBaris).

const KATEGORI_E1 = ['CSR', 'Tata Kelola (GRC)', 'Human Capital', 'Digital', 'BUMD'];
// Hanya pola dummy 0812-0000-xxxx (CLAUDE.md, Ekstensi E1): nomor sungguhan tidak pernah diterima.
const POLA_HP_DUMMY = /^08120000(\d{4})$/;
const AKTOR_FORMULIR = 'Formulir';

function teksRapi(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

// "0812-0000-0011", "0812 0000 0011", "081200000011" -> "0812-0000-0011"; selain pola dummy -> null.
function normalisasiHpDummy(v) {
  const m = String(v ?? '').replace(/[\s-]/g, '').match(POLA_HP_DUMMY);
  return m ? `0812-0000-${m[1]}` : null;
}

function validasiPendaftaran(body) {
  const b = body || {};
  const data = {
    id_permintaan: teksRapi(b.id_permintaan),
    nama_perusahaan: teksRapi(b.nama_perusahaan),
    sektor: teksRapi(b.sektor),
    nama_pic: teksRapi(b.nama_pic),
    no_hp_pic: normalisasiHpDummy(b.no_hp_pic),
    kategori: teksRapi(b.kategori),
    pertanyaan: String(b.pertanyaan ?? '').trim(),
    setuju_simulasi: b.setuju_simulasi === true || b.setuju_simulasi === 'true',
  };

  const pesan = [];
  if (!data.id_permintaan) pesan.push('id_permintaan wajib diisi.');
  if (!data.nama_perusahaan) pesan.push('Nama perusahaan wajib diisi.');
  else if (normalisasiIdProspek(data.nama_perusahaan)) pesan.push('Isi nama perusahaan, bukan ID prospek.');
  else if (!normalisasiKunci(data.nama_perusahaan)) pesan.push('Nama perusahaan tidak valid.');
  else if (data.nama_perusahaan.length > 100) pesan.push('Nama perusahaan maksimal 100 karakter.');
  if (!data.sektor) pesan.push('Sektor wajib diisi.');
  else if (data.sektor.length > 60) pesan.push('Sektor maksimal 60 karakter.');
  if (!data.nama_pic) pesan.push('Nama PIC wajib diisi.');
  else if (data.nama_pic.length > 80) pesan.push('Nama PIC maksimal 80 karakter.');
  if (!data.no_hp_pic) pesan.push('Nomor HP PIC harus memakai pola dummy 0812-0000-xxxx (simulasi, bukan nomor sungguhan).');
  if (!KATEGORI_E1.includes(data.kategori)) pesan.push(`Kategori tidak valid. Pilih salah satu: ${KATEGORI_E1.join(', ')}.`);
  if (data.pertanyaan.length > 500) pesan.push('Pertanyaan awal maksimal 500 karakter.');
  if (!data.setuju_simulasi) pesan.push('Centang "Saya memahami ini formulir simulasi" untuk melanjutkan.');

  return { valid: pesan.length === 0, pesan: pesan.join(' '), ...data };
}

function tandaPermintaan(idPermintaan) {
  return `id_permintaan=${idPermintaan}`;
}

// Histori milik pendaftaran ini (idempotensi): aktor Formulir dan catatan diakhiri tanda id_permintaan.
function cariHistoriPendaftaran(histori, idPermintaan) {
  const tanda = '; ' + tandaPermintaan(idPermintaan);
  return histori.find(
    (r) =>
      String(r.aktor).trim() === AKTOR_FORMULIR &&
      ['pendaftaran', 'duplikat_terdeteksi'].includes(String(r.jenis).trim()) &&
      String(r.catatan || '').endsWith(tanda)
  );
}

function susunRespons(baru, p, berulang) {
  const nama = p.nama_perusahaan;
  let pesan = baru
    ? `Pendaftaran ${nama} tercatat sebagai ${p.id_prospek}.`
    : `${nama} sudah terdaftar sebagai ${p.id_prospek}; data tidak ditambah.`;
  if (!baru && String(p.aktif).trim().toUpperCase() === 'FALSE') pesan += ' Data ini sedang diarsipkan; hubungi admin.';
  return { status: 'ok', baru, id_prospek: p.id_prospek, nama_perusahaan: nama, pesan, berulang };
}

function susunTeruskan(m, idProspek) {
  // Pertanyaan awal diteruskan ke WF-01 (POST /chat) dengan id_permintaan turunan, sehingga coba ulang
  // pendaftaran tidak menggandakan Percakapan (WF-01 idempoten per id_permintaan).
  return m.pertanyaan
    ? { perlu_chat: true, body_chat: { id_permintaan: `${m.id_permintaan}-awal`, prospek: idProspek, pertanyaan: m.pertanyaan } }
    : { perlu_chat: false, body_chat: null };
}

// D = keluaran Olah Data Sheet ({tabel, header, gid}) untuk Prospek dan Histori; m = hasil validasiPendaftaran.
// Hasil: aksi 'lama' (permintaan berulang, tidak menulis) atau 'tulis' (satu batchUpdate atomik).
function prosesPendaftaran(D, m, waktu) {
  const daftar = D.tabel.Prospek.filter((r) => String(r.id_prospek || '').trim() !== '');
  const tanda = tandaPermintaan(m.id_permintaan);

  const lama = cariHistoriPendaftaran(D.tabel.Histori, m.id_permintaan);
  if (lama) {
    const p = daftar.find((r) => String(r.id_prospek).trim() === String(lama.id_prospek).trim()) || {
      id_prospek: lama.id_prospek,
      nama_perusahaan: m.nama_perusahaan,
    };
    return { aksi: 'lama', respons: susunRespons(lama.jenis === 'pendaftaran', p, true), teruskan: susunTeruskan(m, p.id_prospek) };
  }

  const kunci = normalisasiKunci(m.nama_perusahaan);
  const idHistori = idBaru('H', nomorBerikut(D.tabel.Histori, 'id_histori'));
  const ada = daftar.find((r) => String(r.kunci_normal || '').trim() === kunci);

  // FR-08 langkah 3: perusahaan sudah ada -> tidak menambah baris, hanya Histori duplikat_terdeteksi.
  if (ada) {
    const histori = {
      id_histori: idHistori,
      waktu,
      id_prospek: ada.id_prospek,
      aktor: AKTOR_FORMULIR,
      jenis: 'duplikat_terdeteksi',
      nilai_lama: '',
      nilai_baru: '',
      catatan: `Pendaftaran untuk perusahaan yang sudah terdaftar; nama masuk: "${m.nama_perusahaan}"; ${tanda}`,
    };
    return {
      aksi: 'tulis',
      body_tulis: { requests: [tambahBaris(D, 'Histori', [histori])] },
      respons: susunRespons(false, ada, false),
      teruskan: susunTeruskan(m, ada.id_prospek),
    };
  }

  // FR-08 langkah 4: ID berikutnya (P11, P12, ...); AE dengan prospek paling sedikit (seri: AE A), sama dengan WF-01.
  const nomorMaks = Math.max(0, ...daftar.map((r) => parseInt(String(r.id_prospek).replace(/\D/g, ''), 10) || 0));
  const jumlah = { 'AE A': 0, 'AE B': 0 };
  for (const r of daftar) if (r.ae in jumlah) jumlah[r.ae] += 1;

  const p = {
    id_prospek: 'P' + String(nomorMaks + 1).padStart(2, '0'),
    nama_perusahaan: m.nama_perusahaan,
    kunci_normal: kunci,
    sektor: m.sektor,
    ae: jumlah['AE B'] < jumlah['AE A'] ? 'AE B' : 'AE A',
    status: 'Baru',
    kebutuhan: '',
    status_kebutuhan: 'Belum terkonfirmasi', // FR-10
    tgl_tindak_lanjut: '',
    pengingat: '',
    dibuat: waktu,
    diubah: waktu,
    nama_pic: m.nama_pic,
    no_hp_pic: m.no_hp_pic,
    kategori: m.kategori,
    sumber: 'formulir',
    aktif: 'TRUE',
  };
  const histori = {
    id_histori: idHistori,
    waktu,
    id_prospek: p.id_prospek,
    aktor: AKTOR_FORMULIR,
    jenis: 'pendaftaran',
    nilai_lama: '',
    nilai_baru: p.nama_perusahaan,
    catatan: `Pendaftaran baru dari formulir; kategori ${m.kategori}; ${tanda}`,
  };
  return {
    aksi: 'tulis',
    body_tulis: { requests: [tambahBaris(D, 'Prospek', [p]), tambahBaris(D, 'Histori', [histori])] },
    respons: susunRespons(true, p, false),
    teruskan: susunTeruskan(m, p.id_prospek),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KATEGORI_E1, normalisasiHpDummy, validasiPendaftaran, cariHistoriPendaftaran, prosesPendaftaran };
}
