// WF-01 node "Siapkan Penulisan" (langkah 5–8: FR-04, FR-06, FR-08, FR-10, FR-13, NFR-05).
// Mode: Run Once for All Items. Saat dirakit, isi n8n/code/sheet_tulis.js ditempel di atas bagian ini.
// Menyusun SEMUA baris baru, lalu satu permintaan spreadsheets.batchUpdate (appendCells) yang diterapkan
// Google secara atomik: semua baris tertulis, atau tidak satu pun. Kegagalan di langkah sebelumnya
// tidak pernah meninggalkan data setengah tertulis, jadi coba ulang selalu bersih (FR-16).
const D = $('Olah Data Sheet').first().json;
const T = D.tabel;
const cari = $('Cari Prospek').first().json;
const j = $('Periksa Jawaban').first().json;

let draf = null;
try {
  if ($('Periksa Draf').isExecuted) draf = $('Periksa Draf').first().json;
} catch (e) {
  draf = null; // cabang draf tidak dijalankan (topik sapaan)
}

const waktu = $now.setZone('Asia/Jakarta').startOf('second').toISO({ suppressMilliseconds: true });
const id = idBaru;

const p = cari.prospek;
const tanda = `id_permintaan=${j.id_permintaan}`;
const baru = { Prospek: [], Histori: [], Percakapan: [], Antrean_Staf: [], Draf: [] };

// Langkah 5: Prospek (hanya bila baru; dicari per kunci_normal di "Cari Prospek")
if (cari.baru) baru.Prospek.push({ ...p, dibuat: waktu, diubah: waktu });

let nomorHistori = nomorBerikut(T.Histori, 'id_histori');
const sudahTercatat = T.Histori.some(
  (r) => ['prospek_baru', 'duplikat_terdeteksi'].includes(r.jenis) && String(r.catatan || '').includes(tanda)
);
if (!sudahTercatat) {
  baru.Histori.push({
    id_histori: id('H', nomorHistori++),
    waktu,
    id_prospek: p.id_prospek,
    aktor: 'Agent WF-01',
    jenis: cari.baru ? 'prospek_baru' : 'duplikat_terdeteksi',
    nilai_lama: '',
    nilai_baru: cari.baru ? p.nama_perusahaan : '',
    catatan:
      (cari.baru
        ? 'Prospek baru tercatat dari halaman chat'
        : `Prospek sudah ada, tidak ditambah; identitas masuk: "${cari.identitas}"`) + `; ${tanda}`,
  });
}

// Langkah 6: Percakapan (FR-06)
const idPercakapan = id('C', nomorBerikut(T.Percakapan, 'id_percakapan'));
baru.Percakapan.push({
  id_percakapan: idPercakapan,
  id_permintaan: j.id_permintaan,
  waktu,
  id_prospek: p.id_prospek,
  pertanyaan: j.pertanyaan,
  topik: j.topik.join(', '),
  jawaban: j.jawaban,
  rujukan_kb: j.rujukan_kb.join(', '),
  eskalasi: j.eskalasi,
  lolos_pemeriksa: j.lolos_pemeriksa,
  model_ai: j.model_ai,
});

// Langkah 7: Antrean_Staf untuk pertanyaan yang dieskalasi (FR-04)
if (j.eskalasi) {
  baru.Antrean_Staf.push({
    id_tiket: id('T', nomorBerikut(T.Antrean_Staf, 'id_tiket')),
    id_percakapan: idPercakapan,
    alasan: j.alasan_eskalasi || 'Dieskalasi agent.',
    status: 'Baru',
    ditangani_oleh: '',
    waktu,
  });
}

// Langkah 8: Draf follow-up, status awal selalu Menunggu persetujuan (FR-13, G4)
let idDraf = null;
if (draf) {
  idDraf = id('D', nomorBerikut(T.Draf, 'id_draf'));
  baru.Draf.push({
    id_draf: idDraf,
    id_prospek: p.id_prospek,
    id_percakapan: idPercakapan,
    isi_draf: draf.isi_draf,
    status: 'Menunggu persetujuan',
    diputuskan_oleh: '',
    catatan: draf.catatan,
    dibuat: waktu,
    diputuskan: '',
  });
  baru.Histori.push({
    id_histori: id('H', nomorHistori++),
    waktu,
    id_prospek: p.id_prospek,
    aktor: 'Agent WF-01',
    jenis: 'draf_dibuat',
    nilai_lama: '',
    nilai_baru: idDraf,
    catatan: `Draf follow-up dari ${idPercakapan}; ${tanda}`,
  });
}

// appendCells per sheet mengikuti urutan header sheet itu sendiri (sheet_tulis.js).
const requests = Object.entries(baru)
  .filter(([, baris]) => baris.length)
  .map(([sheet, baris]) => tambahBaris(D, sheet, baris));

return [
  {
    json: {
      body_tulis: { requests },
      ringkasan: Object.fromEntries(Object.entries(baru).map(([s, b]) => [s, b.length])),
      respons: {
        status: 'ok',
        jawaban: j.jawaban,
        rujukan_kb: j.rujukan_kb,
        eskalasi: j.eskalasi,
        id_prospek: p.id_prospek,
        id_draf: idDraf,
      },
    },
  },
];
