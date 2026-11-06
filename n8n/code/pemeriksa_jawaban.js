// SIMULASI MSI — Pemeriksa jawaban agent (FR-05, aturan PJ-01–PJ-04 di Section 7).
// Berjalan tanpa AI sehingga hasilnya pasti dan bisa diuji unit (node --test).
//
// Dipakai di n8n Code node WF-01: tempel seluruh isi file ini, lalu tambahkan pemanggil
// di bawahnya (lihat BL-08). Baris module.exports di akhir hanya untuk uji unit.

const KODE_KB_BAWAAN = ['KB01', 'KB02', 'KB03', 'KB04'];

const TEMPLATE_ESKALASI =
  'Mohon maaf, saya belum dapat menjawab pertanyaan ini dari acuan yang tersedia. ' +
  'Pertanyaan Anda saya teruskan kepada staf.';

const TOPIK_VALID = ['biaya_pendaftaran', 'sponsorship', 'jaminan_penghargaan', 'tarif', 'jadwal', 'lainnya'];

// PJ-01: nominal uang
const POLA_UANG = [
  /\brp\.?\s*\d/i,
  /\brp\b/i,
  /\brupiah\b/i,
  /\d[\d.,]*\s*(juta|ribu|miliar|milyar|triliun|jt|rb|k)\b/i,
  /\b(juta|miliar|milyar|triliun)\b/i,
  /\$\s*\d/,
  /\b(usd|idr)\b/i,
  /\b(dolar|dollar)\b/i,
  /\b\d{1,3}(?:[.,]\d{3})+\b/, // 10.000 atau 1,500,000
];

// PJ-02: tanggal atau nama hari spesifik
const POLA_TANGGAL = [
  /\b(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu)\b/i,
  /\b(januari|februari|pebruari|maret|april|mei|juni|juli|agustus|september|oktober|november|nopember|desember)\b/i,
  /\b(jan|feb|mar|apr|jun|jul|agu|agt|ags|sep|okt|nov|des)\.?\s+\d{2,4}\b/i,
  /\b\d{1,2}\s+(jan|feb|mar|apr|mei|jun|jul|agu|agt|ags|sep|okt|nov|des)\b/i,
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/, // 12/11/2026
  /\b\d{4}-\d{2}-\d{2}\b/, // 2026-11-12
  /\btanggal\s+\d{1,2}\b/i,
  /\b(besok|lusa)\b/i,
];

// PJ-03: kata janji (hanya melanggar bila anak kalimatnya tidak dinegasikan)
const POLA_JANJI = [
  /\b(di)?jamin(kan)?\b/i,
  /\bmenjamin\b/i,
  /\b(menjanjikan|berjanji|janjikan)\b/i,
  /\bpasti\s+(mendapat|memperoleh|menang|lolos|terpilih|meraih|dapat)/i,
  /\bbintang\s*(5|lima)\b/i,
  /\bakan\s+(mendapat|memperoleh|meraih)(kan)?\s+(penghargaan|bintang)/i,
];
const POLA_NEGASI = /\b(tidak|tak|bukan|belum|tanpa)\b/i;

function cariPola(teks, daftarPola) {
  for (const pola of daftarPola) {
    const m = teks.match(pola);
    if (m) return m[0];
  }
  return null;
}

// Memeriksa satu teks terhadap PJ-01–PJ-03. Bisa dipakai juga untuk isi draf.
function periksaTeks(teks) {
  const pelanggaran = [];
  const t = String(teks || '');

  const uang = cariPola(t, POLA_UANG);
  if (uang) pelanggaran.push({ aturan: 'PJ-01', detail: `memuat nominal uang: "${uang}"` });

  const tanggal = cariPola(t, POLA_TANGGAL);
  if (tanggal) pelanggaran.push({ aturan: 'PJ-02', detail: `memuat tanggal atau hari: "${tanggal}"` });

  for (const anakKalimat of t.split(/[.!?;,\n]+/)) {
    const janji = cariPola(anakKalimat, POLA_JANJI);
    if (janji && !POLA_NEGASI.test(anakKalimat)) {
      pelanggaran.push({ aturan: 'PJ-03', detail: `memuat janji: "${anakKalimat.trim()}"` });
      break;
    }
  }
  return pelanggaran;
}

// Mengubah teks keluaran model menjadi objek. Mengembalikan null bila tidak bisa di-parse.
function parseKeluaranModel(keluaran) {
  if (keluaran && typeof keluaran === 'object') return keluaran;
  if (typeof keluaran !== 'string') return null;
  let s = keluaran.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const awal = s.indexOf('{');
  const akhir = s.lastIndexOf('}');
  if (awal === -1 || akhir <= awal) return null;
  try {
    return JSON.parse(s.slice(awal, akhir + 1));
  } catch (e) {
    return null;
  }
}

// Fungsi utama. keluaranModel: teks atau objek JSON dari agent.
// kodeKbValid: kode KB aktif dari sheet KB (default KB01–KB04).
// Mengembalikan { lolos_pemeriksa, pelanggaran, hasil } dengan hasil siap dipakai workflow.
function periksaJawaban(keluaranModel, kodeKbValid) {
  const kodeValid = Array.isArray(kodeKbValid) && kodeKbValid.length ? kodeKbValid : KODE_KB_BAWAAN;
  const data = parseKeluaranModel(keluaranModel);
  const pelanggaran = [];

  const strukturBenar =
    data &&
    typeof data.jawaban === 'string' &&
    data.jawaban.trim() !== '' &&
    typeof data.eskalasi === 'boolean' &&
    Array.isArray(data.rujukan_kb);

  if (!strukturBenar) {
    pelanggaran.push({ aturan: 'FORMAT', detail: 'keluaran model bukan JSON sesuai format Section 7' });
  } else {
    pelanggaran.push(...periksaTeks(data.jawaban));

    // PJ-04: rujukan
    const rujukanAsing = data.rujukan_kb.filter((k) => !kodeValid.includes(k));
    if (rujukanAsing.length) {
      pelanggaran.push({ aturan: 'PJ-04', detail: `rujukan tidak ada di KB: ${rujukanAsing.join(', ')}` });
    }
    if (!data.eskalasi && data.rujukan_kb.length === 0) {
      pelanggaran.push({ aturan: 'PJ-04', detail: 'jawaban tanpa eskalasi tidak punya rujukan KB' });
    }
  }

  const topik =
    strukturBenar && Array.isArray(data.topik)
      ? data.topik.filter((x) => TOPIK_VALID.includes(x))
      : [];

  if (pelanggaran.length === 0) {
    return {
      lolos_pemeriksa: true,
      pelanggaran: [],
      hasil: {
        topik: topik.length ? topik : ['lainnya'],
        jawaban: data.jawaban.trim(),
        rujukan_kb: data.rujukan_kb,
        eskalasi: data.eskalasi,
        alasan_eskalasi: data.eskalasi ? data.alasan_eskalasi || 'Dieskalasi agent.' : null,
      },
    };
  }

  return {
    lolos_pemeriksa: false,
    pelanggaran,
    hasil: {
      topik: topik.length ? topik : ['lainnya'],
      jawaban: TEMPLATE_ESKALASI,
      rujukan_kb: [],
      eskalasi: true,
      alasan_eskalasi:
        'Pemeriksa jawaban menolak keluaran agent (' + pelanggaran.map((p) => p.aturan).join(', ') + ').',
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { periksaJawaban, periksaTeks, parseKeluaranModel, TEMPLATE_ESKALASI, KODE_KB_BAWAAN };
}
