// SIMULASI MSI — Aturan tiket eskalasi (POST /tiket di WF-06): ambil, jawab lewat draf, selesai.
// Fungsi murni; diuji di aturan_tiket.test.js. Baris module.exports hanya untuk uji unit.
// Saat dirakit, sheet_tulis.js ditempel di atas file ini (AKTOR, nomorBerikut, idBaru, tambahBaris, ubahSel).
// Siklus: Baru -> Ditangani -> Selesai. Selesai tidak bisa dibuka lagi. Tidak ada kolom baru:
// catatan penyelesaian dan jejak perubahan disimpan di Histori (jenis ubah_tiket).
// "Jawab lewat draf" membuat Draf berstatus Menunggu persetujuan yang ditandai di kolom catatan
// ("Jawaban staf atas T0001"); /draf/kirim memakai penanda itu untuk menutup tiket saat draf terkirim.

const AKSI_TIKET = ['ambil', 'jawab', 'selesai'];
const PENANDA_JAWABAN = 'Jawaban staf atas ';

function teksTiket(v) {
  return String(v ?? '').trim();
}

// Id tiket yang dijawab oleh sebuah draf, dibaca dari penanda di awal kolom catatan; null bila bukan draf jawaban staf.
function tiketDariDraf(draf) {
  const m = String((draf && draf.catatan) || '').match(/^Jawaban staf atas (T\d{4,})/);
  return m ? m[1] : null;
}

function validasiTiket(body) {
  const b = body || {};
  const id_tiket = teksTiket(b.id_tiket).toUpperCase();
  const aksi = teksTiket(b.aksi).toLowerCase();
  const oleh = teksTiket(b.oleh).toLowerCase();
  const catatan = teksTiket(b.catatan);
  const jawaban = teksTiket(b.jawaban);
  const pesan = [];
  if (!/^T\d{4,}$/.test(id_tiket)) pesan.push('id_tiket tidak valid.');
  if (!AKSI_TIKET.includes(aksi)) pesan.push('Aksi harus ambil, jawab, atau selesai.');
  if (oleh !== 'staf') pesan.push('Hanya peran staf yang boleh menangani tiket.');
  if (aksi === 'selesai' && !catatan) pesan.push('Catatan penyelesaian wajib diisi.');
  if (aksi === 'jawab' && !jawaban) pesan.push('Isi jawaban untuk calon peserta wajib diisi.');
  if (jawaban.length > 1500) pesan.push('Jawaban maksimal 1500 karakter.');
  if (catatan.length > 300) pesan.push('Catatan maksimal 300 karakter.');
  return { valid: pesan.length === 0, pesan: pesan.join(' '), id_tiket, aksi, oleh, catatan, jawaban };
}

function tolakTiket(pesan) {
  return { boleh: false, pesan };
}

// Draf jawaban staf yang masih hidup (bukan Ditolak) untuk tiket ini.
function drafJawabanAktif(D, idTiket) {
  return D.tabel.Draf.find((d) => tiketDariDraf(d) === idTiket && String(d.status).trim() !== 'Ditolak');
}

// D = Olah Data Sheet (Antrean_Staf, Percakapan, Draf, Histori); m = validasiTiket.
function prosesTiket(D, m, waktu) {
  const tiket = D.tabel.Antrean_Staf.find((t) => String(t.id_tiket).trim().toUpperCase() === m.id_tiket);
  if (!tiket) return tolakTiket(`Tiket ${m.id_tiket} tidak ditemukan.`);
  const statusLama = String(tiket.status).trim() || 'Baru';
  if (statusLama === 'Selesai') return tolakTiket(`Tiket ${m.id_tiket} sudah Selesai dan tidak bisa diubah lagi.`);

  const aktor = AKTOR[m.oleh];
  const percakapan = D.tabel.Percakapan.find((c) => String(c.id_percakapan).trim() === String(tiket.id_percakapan).trim()) || {};
  const idProspek = String(percakapan.id_prospek || '').trim();
  let nomorH = nomorBerikut(D.tabel.Histori, 'id_histori');
  const histori = (jenis, nilai_lama, nilai_baru, catatan) => ({
    id_histori: idBaru('H', nomorH++), waktu, id_prospek: idProspek, aktor, jenis, nilai_lama, nilai_baru, catatan,
  });

  if (m.aksi === 'ambil') {
    if (statusLama !== 'Baru') return tolakTiket(`Tiket ${m.id_tiket} sudah ${statusLama} oleh ${tiket.ditangani_oleh || 'staf lain'}.`);
    const h = histori('ubah_tiket', statusLama, 'Ditangani', `${m.id_tiket}${m.catatan ? '; ' + m.catatan : ''}`);
    return {
      boleh: true,
      body_tulis: { requests: [...ubahSel(D, 'Antrean_Staf', tiket, { status: 'Ditangani', ditangani_oleh: aktor }), tambahBaris(D, 'Histori', [h])] },
      respons: { status: 'ok', id_tiket: m.id_tiket, status_tiket: 'Ditangani', pesan: `${m.id_tiket} sekarang ditangani ${aktor}.` },
    };
  }

  if (m.aksi === 'selesai') {
    const h = histori('ubah_tiket', statusLama, 'Selesai', `${m.id_tiket}; ${m.catatan}`);
    return {
      boleh: true,
      body_tulis: {
        requests: [...ubahSel(D, 'Antrean_Staf', tiket, { status: 'Selesai', ditangani_oleh: tiket.ditangani_oleh || aktor }), tambahBaris(D, 'Histori', [h])],
      },
      respons: { status: 'ok', id_tiket: m.id_tiket, status_tiket: 'Selesai', pesan: `${m.id_tiket} ditandai selesai.` },
    };
  }

  // jawab: jawaban manusia menjadi draf yang mengikuti alur persetujuan biasa.
  if (!idProspek) return tolakTiket(`Percakapan untuk tiket ${m.id_tiket} tidak ditemukan; draf tidak bisa dibuat.`);
  const ada = drafJawabanAktif(D, m.id_tiket);
  if (ada) return tolakTiket(`Tiket ${m.id_tiket} sudah punya draf jawaban ${ada.id_draf} (${ada.status}).`);
  const idDraf = idBaru('D', nomorBerikut(D.tabel.Draf, 'id_draf'));
  const draf = {
    id_draf: idDraf,
    id_prospek: idProspek,
    id_percakapan: tiket.id_percakapan,
    isi_draf: m.jawaban,
    status: 'Menunggu persetujuan',
    diputuskan_oleh: '',
    catatan: PENANDA_JAWABAN + m.id_tiket,
    dibuat: waktu,
    diputuskan: '',
  };
  const hs = [histori('draf_dibuat', '', idDraf, PENANDA_JAWABAN + m.id_tiket)];
  const requests = [tambahBaris(D, 'Draf', [draf])];
  if (statusLama === 'Baru') {
    requests.push(...ubahSel(D, 'Antrean_Staf', tiket, { status: 'Ditangani', ditangani_oleh: aktor }));
    hs.push(histori('ubah_tiket', 'Baru', 'Ditangani', `${m.id_tiket}; dijawab lewat ${idDraf}`));
  }
  requests.push(tambahBaris(D, 'Histori', hs));
  return {
    boleh: true,
    body_tulis: { requests },
    respons: {
      status: 'ok', id_tiket: m.id_tiket, status_tiket: 'Ditangani', id_draf: idDraf,
      pesan: `Draf jawaban ${idDraf} dibuat dan menunggu persetujuan. Tiket ${m.id_tiket} akan selesai otomatis setelah draf terkirim.`,
    },
  };
}

// Dipakai /draf/kirim: bila draf yang dikirim adalah jawaban staf, tutup tiketnya dalam batch yang sama.
// Mengembalikan { requests, histori } tambahan, atau null bila tidak ada tiket yang perlu ditutup.
function tutupTiketSaatTerkirim(D, draf, aktor, waktu, nomorHistori) {
  const idTiket = tiketDariDraf(draf);
  if (!idTiket || !D.tabel.Antrean_Staf) return null;
  const tiket = D.tabel.Antrean_Staf.find((t) => String(t.id_tiket).trim().toUpperCase() === idTiket);
  if (!tiket || String(tiket.status).trim() === 'Selesai') return null;
  return {
    requests: ubahSel(D, 'Antrean_Staf', tiket, { status: 'Selesai', ditangani_oleh: tiket.ditangani_oleh || aktor }),
    histori: {
      id_histori: idBaru('H', nomorHistori), waktu, id_prospek: draf.id_prospek, aktor, jenis: 'ubah_tiket',
      nilai_lama: String(tiket.status).trim() || 'Baru', nilai_baru: 'Selesai', catatan: `${idTiket}; selesai otomatis, jawaban ${draf.id_draf} terkirim`,
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tiketDariDraf, validasiTiket, prosesTiket, tutupTiketSaatTerkirim };
}
