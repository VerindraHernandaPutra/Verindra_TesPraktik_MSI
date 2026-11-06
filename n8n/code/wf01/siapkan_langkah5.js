// WF-01 node "Siapkan Langkah 5" (FR-08, FR-10, NFR-05). Mode: Run Once for All Items.
// Menyiapkan baris Prospek (bila baru) dan baris Histori, plus respons untuk halaman.
const cari = $('Cari Prospek').first().json;
const jawab = $('Periksa Jawaban').first().json;
const waktu = $now.setZone('Asia/Jakarta').startOf('second').toISO({ suppressMilliseconds: true });

const histori = $('Baca Histori')
  .all()
  .map((i) => i.json)
  .filter((r) => String(r.id_histori || '').trim() !== '');

// Coba ulang dengan id_permintaan yang sama tidak boleh menambah Histori dua kali (FR-16).
const tanda = jawab.id_permintaan ? `id_permintaan=${jawab.id_permintaan}` : '';
const sudahTercatat =
  tanda !== '' &&
  histori.some(
    (r) => ['prospek_baru', 'duplikat_terdeteksi'].includes(r.jenis) && String(r.catatan || '').includes(tanda)
  );

const nomorMaks = Math.max(0, ...histori.map((r) => parseInt(String(r.id_histori).replace(/\D/g, ''), 10) || 0));
const p = cari.prospek;

const barisProspek = cari.baru ? { ...p, dibuat: waktu, diubah: waktu } : null;

const barisHistori = sudahTercatat
  ? null
  : {
      id_histori: 'H' + String(nomorMaks + 1).padStart(4, '0'),
      waktu,
      id_prospek: p.id_prospek,
      aktor: 'Agent WF-01',
      jenis: cari.baru ? 'prospek_baru' : 'duplikat_terdeteksi',
      nilai_lama: '',
      nilai_baru: cari.baru ? p.nama_perusahaan : '',
      catatan:
        (cari.baru
          ? 'Prospek baru tercatat dari halaman chat'
          : `Prospek sudah ada, tidak ditambah; identitas masuk: "${cari.identitas}"`) + (tanda ? `; ${tanda}` : ''),
    };

return [
  {
    json: {
      // Kontrak POST /chat (Section 10)
      respons: {
        status: 'ok',
        jawaban: jawab.jawaban,
        rujukan_kb: jawab.rujukan_kb,
        eskalasi: jawab.eskalasi,
        id_prospek: p.id_prospek,
        id_draf: null,
      },
      prospek_baru: barisProspek !== null,
      prospek: barisProspek,
      tulis_histori: barisHistori !== null,
      histori: barisHistori,
    },
  },
];
