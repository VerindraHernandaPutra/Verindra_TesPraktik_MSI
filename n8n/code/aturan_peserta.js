// SIMULASI MSI — Aturan tabel peserta dan Kirim (simulasi) Ekstensi E1 (E-02 POST /peserta, E-03 POST /draf/kirim).
// Fungsi murni; diuji di aturan_peserta.test.js. Baris module.exports hanya untuk uji unit.
// Saat dirakit, normalisasi_kunci.js, sheet_tulis.js, dan aturan_pendaftaran.js ditempel di atas file ini.
// Arsip = aktif FALSE; baris Prospek dan Histori tidak pernah dihapus. Tidak ada pengiriman nyata (S-05).

const AKSI_PESERTA = ['tambah', 'ubah', 'arsip'];
const KOLOM_UBAH_PESERTA = ['nama_perusahaan', 'sektor', 'nama_pic', 'no_hp_pic', 'kategori', 'ae'];
const DAFTAR_AE = ['AE A', 'AE B'];

// Memeriksa satu kolom isian peserta; mengembalikan [nilai rapi, pesan galat atau ''].
function periksaKolomPeserta(k, v, oleh) {
  if (k === 'no_hp_pic') {
    const hp = normalisasiHpDummy(v);
    return [hp, hp ? '' : 'Nomor HP PIC tidak valid. Gunakan format 0812-0000-xxxx.'];
  }
  const s = teksRapi(v);
  if (k === 'nama_perusahaan') {
    if (!s) return [s, 'Nama perusahaan wajib diisi.'];
    if (normalisasiIdProspek(s)) return [s, 'Isi nama perusahaan, bukan ID prospek.'];
    if (!normalisasiKunci(s)) return [s, 'Nama perusahaan tidak valid.'];
    return [s, s.length > 100 ? 'Nama perusahaan maksimal 100 karakter.' : ''];
  }
  if (k === 'sektor') return [s, !s ? 'Sektor wajib diisi.' : s.length > 60 ? 'Sektor maksimal 60 karakter.' : ''];
  if (k === 'nama_pic') return [s, !s ? 'Nama PIC wajib diisi.' : s.length > 80 ? 'Nama PIC maksimal 80 karakter.' : ''];
  if (k === 'kategori') return [s, KATEGORI_E1.includes(s) ? '' : `Kategori tidak valid. Pilih salah satu: ${KATEGORI_E1.join(', ')}.`];
  if (k === 'ae') {
    if (oleh !== 'admin') return [s, 'Hanya admin yang boleh menentukan AE.'];
    return [s, DAFTAR_AE.includes(s) ? '' : 'AE harus AE A atau AE B.'];
  }
  return [s, `Kolom ${k} tidak bisa diubah.`];
}

// body: aksi, oleh, id_prospek (ubah/arsip), id_permintaan (tambah), kolom isian, catatan (opsional).
function validasiPeserta(body) {
  const b = body || {};
  const aksi = teksRapi(b.aksi).toLowerCase();
  const oleh = teksRapi(b.oleh).toLowerCase();
  const id_prospek = teksRapi(b.id_prospek).toUpperCase();
  const id_permintaan = teksRapi(b.id_permintaan);
  const catatan = teksRapi(b.catatan);
  const data = {};
  const pesan = [];

  if (!AKSI_PESERTA.includes(aksi)) pesan.push('Aksi harus tambah, ubah, atau arsip.');
  // US-07/FR-15: admin mengelola semua peserta; AE hanya peserta miliknya (diperiksa di prosesPeserta).
  if (!['admin', 'ae_a', 'ae_b'].includes(oleh)) pesan.push('Hanya admin atau AE yang boleh mengelola peserta.');
  if (aksi !== 'tambah' && !/^P\d{2,}$/.test(id_prospek)) pesan.push('id_prospek tidak valid.');
  if (catatan.length > 200) pesan.push('Catatan maksimal 200 karakter.');

  if (aksi === 'tambah') {
    if (!id_permintaan) pesan.push('id_permintaan wajib diisi.');
    for (const k of ['nama_perusahaan', 'sektor', 'nama_pic', 'no_hp_pic', 'kategori']) {
      const [v, galat] = periksaKolomPeserta(k, b[k], oleh);
      data[k] = v;
      if (galat) pesan.push(galat);
    }
    if (b.ae !== undefined && teksRapi(b.ae) !== '') {
      const [v, galat] = periksaKolomPeserta('ae', b.ae, oleh);
      data.ae = v;
      if (galat) pesan.push(galat);
    }
  } else if (aksi === 'ubah') {
    const ada = KOLOM_UBAH_PESERTA.filter((k) => b[k] !== undefined);
    if (!ada.length) pesan.push('Tidak ada kolom yang diubah.');
    for (const k of ada) {
      const [v, galat] = periksaKolomPeserta(k, b[k], oleh);
      data[k] = v;
      if (galat) pesan.push(galat);
    }
  }

  return { valid: pesan.length === 0, pesan: pesan.join(' '), aksi, oleh, id_prospek, id_permintaan, catatan, data };
}

function tolakPeserta(pesan) {
  return { boleh: false, pesan };
}

function idKetemu(daftar, id) {
  return daftar.find((r) => String(r.id_prospek).trim().toUpperCase() === id);
}

// D = Olah Data Sheet (Prospek, Histori); m = validasiPeserta. Hasil: tolak (boleh false), lama, atau body_tulis.
function prosesPeserta(D, m, waktu) {
  const daftar = D.tabel.Prospek.filter((r) => String(r.id_prospek || '').trim() !== '');
  const aktor = AKTOR[m.oleh];
  let nomorH = nomorBerikut(D.tabel.Histori, 'id_histori');
  const histori = (id_prospek, jenis, nilai_lama, nilai_baru, catatan) => ({
    id_histori: idBaru('H', nomorH++), waktu, id_prospek, aktor, jenis, nilai_lama, nilai_baru, catatan,
  });

  if (m.aksi === 'tambah') {
    const tanda = '; ' + tandaPermintaan(m.id_permintaan);
    const lama = D.tabel.Histori.find(
      (r) => String(r.aktor).trim() === aktor && String(r.jenis).trim() === 'pendaftaran' && String(r.catatan || '').endsWith(tanda)
    );
    if (lama) {
      return { lama: true, respons: { status: 'ok', aksi: 'tambah', id_prospek: lama.id_prospek, pesan: `Peserta sudah ditambahkan sebagai ${lama.id_prospek}.`, berulang: true } };
    }
    const kunci = normalisasiKunci(m.data.nama_perusahaan);
    const ada = daftar.find((r) => String(r.kunci_normal || '').trim() === kunci);
    if (ada) return tolakPeserta(`${ada.nama_perusahaan} sudah terdaftar sebagai ${ada.id_prospek}; data tidak ditambah.`);

    const nomorMaks = Math.max(0, ...daftar.map((r) => parseInt(String(r.id_prospek).replace(/\D/g, ''), 10) || 0));
    const jumlah = { 'AE A': 0, 'AE B': 0 };
    for (const r of daftar) if (r.ae in jumlah) jumlah[r.ae] += 1;
    const ae = m.oleh !== 'admin' ? aktor : m.data.ae || (jumlah['AE B'] < jumlah['AE A'] ? 'AE B' : 'AE A');
    const p = {
      id_prospek: 'P' + String(nomorMaks + 1).padStart(2, '0'),
      nama_perusahaan: m.data.nama_perusahaan,
      kunci_normal: kunci,
      sektor: m.data.sektor,
      ae,
      status: 'Baru',
      kebutuhan: '',
      status_kebutuhan: 'Belum terkonfirmasi', // FR-10
      tgl_tindak_lanjut: '',
      pengingat: '',
      dibuat: waktu,
      diubah: waktu,
      nama_pic: m.data.nama_pic,
      no_hp_pic: m.data.no_hp_pic,
      kategori: m.data.kategori,
      sumber: 'admin',
      aktif: 'TRUE',
    };
    const h = histori(p.id_prospek, 'pendaftaran', '', p.nama_perusahaan,
      `Ditambah dari tabel peserta${m.catatan ? '; ' + m.catatan : ''}${tanda}`);
    return {
      boleh: true,
      body_tulis: { requests: [tambahBaris(D, 'Prospek', [p]), tambahBaris(D, 'Histori', [h])] },
      respons: { status: 'ok', aksi: 'tambah', id_prospek: p.id_prospek, pesan: `${p.nama_perusahaan} ditambahkan sebagai ${p.id_prospek}.`, berulang: false },
    };
  }

  const p = idKetemu(daftar, m.id_prospek);
  if (!p) return tolakPeserta(`Prospek ${m.id_prospek} tidak ditemukan.`);
  if (m.oleh !== 'admin' && String(p.ae).trim() !== aktor) {
    return tolakPeserta(`Prospek ${m.id_prospek} milik ${p.ae}; ${aktor} tidak boleh mengubahnya.`);
  }
  if (!pesertaAktif(p)) return tolakPeserta(`Prospek ${m.id_prospek} sudah diarsipkan; data tidak bisa diubah.`);

  if (m.aksi === 'arsip') {
    const h = histori(p.id_prospek, 'arsip_peserta', 'TRUE', 'FALSE', m.catatan || 'Diarsipkan dari tabel peserta; baris tidak dihapus');
    return {
      boleh: true,
      body_tulis: { requests: [...ubahSel(D, 'Prospek', p, { aktif: 'FALSE', diubah: waktu }), tambahBaris(D, 'Histori', [h])] },
      respons: { status: 'ok', aksi: 'arsip', id_prospek: p.id_prospek, pesan: `${p.nama_perusahaan} (${p.id_prospek}) diarsipkan.`, histori: h },
    };
  }

  // ubah: hanya kolom yang nilainya benar-benar berubah; satu baris Histori ubah_peserta per kolom.
  const berubah = Object.entries(m.data).filter(([k, v]) => String(p[k] ?? '').trim() !== v);
  if (!berubah.length) return tolakPeserta('Tidak ada perubahan.');
  const perubahan = Object.fromEntries(berubah);
  if (perubahan.nama_perusahaan !== undefined) {
    const kunci = normalisasiKunci(perubahan.nama_perusahaan);
    const lain = daftar.find((r) => r !== p && String(r.kunci_normal || '').trim() === kunci);
    if (lain) return tolakPeserta(`Nama itu sudah dipakai ${lain.id_prospek} (${lain.nama_perusahaan}); data tidak diubah.`);
    perubahan.kunci_normal = kunci; // FR-08: kunci anti-dobel mengikuti nama baru
  }
  const hs = berubah.map(([k, v]) =>
    histori(p.id_prospek, 'ubah_peserta', String(p[k] ?? '').trim(), v, `Kolom ${k}${m.catatan ? '; ' + m.catatan : ''}`)
  );
  return {
    boleh: true,
    body_tulis: { requests: [...ubahSel(D, 'Prospek', p, { ...perubahan, diubah: waktu }), tambahBaris(D, 'Histori', hs)] },
    respons: {
      status: 'ok', aksi: 'ubah', id_prospek: p.id_prospek, diubah: berubah.map(([k]) => k),
      pesan: `${p.id_prospek} diperbarui: ${berubah.map(([k]) => k).join(', ')}.`,
    },
  };
}

// ---------- E-03: POST /draf/kirim ----------

function validasiKirim(body) {
  const b = body || {};
  const id_draf = teksRapi(b.id_draf).toUpperCase();
  const oleh = teksRapi(b.oleh).toLowerCase();
  const pesan = [];
  if (!/^D\d{4,}$/.test(id_draf)) pesan.push('id_draf tidak valid.');
  if (oleh !== 'staf') pesan.push('Hanya peran staf yang boleh menandai draf Terkirim (simulasi).');
  return { valid: pesan.length === 0, pesan: pesan.join(' '), id_draf, oleh };
}

// D = Olah Data Sheet (Draf, Prospek, Histori). Hanya mengubah status; tidak ada pesan yang dikirim.
function prosesKirim(D, m, waktu) {
  const draf = D.tabel.Draf.find((d) => String(d.id_draf).trim().toUpperCase() === m.id_draf);
  if (!draf) return tolakPeserta(`Draf ${m.id_draf} tidak ditemukan.`);
  const statusLama = String(draf.status).trim();
  if (statusLama !== 'Siap kirim (simulasi)') {
    return tolakPeserta(`Draf ${m.id_draf} berstatus "${statusLama}"; hanya draf Siap kirim (simulasi) yang bisa ditandai Terkirim (simulasi).`);
  }
  const p = idKetemu(D.tabel.Prospek, String(draf.id_prospek).trim().toUpperCase());
  if (!p) return tolakPeserta(`Prospek ${draf.id_prospek} untuk draf ini tidak ditemukan.`);
  if (!pesertaAktif(p)) return tolakPeserta(`Prospek ${p.id_prospek} sudah diarsipkan; draf tidak dikirim.`);
  const hp = normalisasiHpDummy(p.no_hp_pic);
  if (!hp) return tolakPeserta(`Prospek ${p.id_prospek} belum punya nomor HP PIC dummy; isi lewat tabel peserta.`);

  const aktor = AKTOR[m.oleh];
  const ke = 'Terkirim (simulasi)';
  const h = {
    id_histori: idBaru('H', nomorBerikut(D.tabel.Histori, 'id_histori')),
    waktu,
    id_prospek: p.id_prospek,
    aktor,
    jenis: 'kirim_simulasi',
    nilai_lama: statusLama,
    nilai_baru: ke,
    catatan: `${m.id_draf}; tujuan ${hp}`,
  };
  // Opsi B: bila draf ini jawaban staf atas tiket eskalasi, tiket ditutup dalam batch yang sama (aturan_tiket.js).
  const tutup = typeof tutupTiketSaatTerkirim === 'function'
    ? tutupTiketSaatTerkirim(D, draf, aktor, waktu, nomorBerikut(D.tabel.Histori, 'id_histori') + 1)
    : null;
  const historiBaru = tutup ? [h, tutup.histori] : [h];
  return {
    boleh: true,
    body_tulis: {
      requests: [...ubahSel(D, 'Draf', draf, { status: ke }), ...(tutup ? tutup.requests : []), tambahBaris(D, 'Histori', historiBaru)],
    },
    respons: {
      status: 'ok', id_draf: m.id_draf, status_draf: ke, no_tujuan: hp,
      tiket_selesai: tutup ? tiketDariDraf(draf) : null,
      pesan: `Draf ${m.id_draf} ditandai terkirim ke ${hp}.` + (tutup ? ` Tiket ${tiketDariDraf(draf)} ditandai selesai.` : ''),
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validasiPeserta, prosesPeserta, validasiKirim, prosesKirim };
}
