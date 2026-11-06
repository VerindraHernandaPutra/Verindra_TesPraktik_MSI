// WF-01 node "Cari Prospek" (FR-08, aturan anti-dobel Section 9). Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/normalisasi_kunci.js ditempel di atas bagian ini.
// Hanya MENCARI; penulisan ke sheet terjadi di langkah 5 setelah jawaban lolos pemeriksa.
const masukan = $('Validasi Masukan').first().json;
const identitas = masukan.prospek;

const daftar = $('Olah Data Sheet')
  .first()
  .json.tabel.Prospek.filter((r) => String(r.id_prospek || '').trim() !== '');

function tolak(pesan) {
  return [{ json: { valid: false, pesan, identitas } }];
}

const id = normalisasiIdProspek(identitas);
if (id) {
  const ada = daftar.find((r) => String(r.id_prospek).trim().toUpperCase() === id);
  if (!ada) return tolak(`Prospek ${id} tidak ditemukan.`);
  return [{ json: { valid: true, baru: false, identitas, prospek: ada } }];
}

const kunci = normalisasiKunci(identitas);
if (!kunci) return tolak('Nama perusahaan tidak valid.');

const ada = daftar.find((r) => String(r.kunci_normal || '').trim() === kunci);
if (ada) return [{ json: { valid: true, baru: false, identitas, prospek: ada } }];

// Prospek baru: ID berikutnya (P11, P12, ...) dan AE dengan prospek paling sedikit (seri: AE A).
const nomorMaks = Math.max(0, ...daftar.map((r) => parseInt(String(r.id_prospek).replace(/\D/g, ''), 10) || 0));
const jumlah = { 'AE A': 0, 'AE B': 0 };
for (const r of daftar) if (r.ae in jumlah) jumlah[r.ae] += 1;

return [
  {
    json: {
      valid: true,
      baru: true,
      identitas,
      prospek: {
        id_prospek: 'P' + String(nomorMaks + 1).padStart(2, '0'),
        nama_perusahaan: identitas.replace(/\s+/g, ' ').trim(),
        kunci_normal: kunci,
        sektor: '',
        ae: jumlah['AE B'] < jumlah['AE A'] ? 'AE B' : 'AE A',
        status: 'Baru',
        kebutuhan: '',
        status_kebutuhan: 'Belum terkonfirmasi', // FR-10: kebutuhan baru selalu belum terkonfirmasi
        tgl_tindak_lanjut: '',
        pengingat: '',
      },
    },
  },
];
