// WF-01 node "Periksa Draf" (FR-13, AR-08). Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/pemeriksa_jawaban.js ditempel di atas bagian ini.
// Draf AI yang melanggar PJ-01–PJ-03 atau merujuk KB asing diganti template aman; status tetap
// Menunggu persetujuan, dan alasannya dicatat di kolom catatan untuk staf.
const TEMPLATE_DRAF =
  'Terima kasih atas pertanyaannya. Staf akan menindaklanjuti pertanyaan Anda setelah verifikasi.';

const kodeValid = $('Susun Prompt').first().json.kode_kb_valid;
const data = parseKeluaranModel($input.first().json.keluaran_model);

const masalah = [];
if (!data || typeof data.isi_draf !== 'string' || data.isi_draf.trim() === '') {
  masalah.push('FORMAT');
} else {
  masalah.push(...periksaTeks(data.isi_draf).map((p) => p.aturan));
  const rujukan = Array.isArray(data.rujukan_kb) ? data.rujukan_kb : [];
  if (rujukan.some((k) => !kodeValid.includes(k))) masalah.push('PJ-04');
}

const lolos = masalah.length === 0;
return [
  {
    json: {
      isi_draf: lolos ? data.isi_draf.trim() : TEMPLATE_DRAF,
      lolos_pemeriksa: lolos,
      catatan: lolos ? '' : `Draf AI ditolak pemeriksa (${masalah.join(', ')}); diganti template.`,
    },
  },
];
