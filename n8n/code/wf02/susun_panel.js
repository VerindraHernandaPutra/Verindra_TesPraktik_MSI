// WF-02 node "Susun Panel" (FR-12, FR-15; kontrak GET /panel Section 10). Mode: Run Once for All Items.
// Saat dirakit, isi n8n/code/sheet_tulis.js ditempel di atas bagian ini (AKTOR, STATUS_PIPELINE).
// Tanpa nilai penjualan (Section 2). AE hanya melihat prospek miliknya beserta tiket dan drafnya.
const { peran, ekspor } = $('Validasi Panel').first().json;
const { tabel: T, header } = $('Olah Sheet Panel').first().json;

const konfig = Object.fromEntries(T.Konfigurasi.map((r) => [String(r.kunci).trim(), String(r.nilai ?? '').trim()]));
const tanggal = konfig.TANGGAL_SIMULASI || '';

const semua = T.Prospek.filter((p) => String(p.id_prospek || '').trim());
const milikPeran = peran === 'ae_a' || peran === 'ae_b' ? semua.filter((p) => p.ae === AKTOR[peran]) : semua;
// E1: dashboard, tabel peserta, antrean, dan draf hanya memakai peserta aktif; arsip tetap ada di sheet dan ekspor.
const terlihat = milikPeran.filter(pesertaAktif);
const idTerlihat = new Set(terlihat.map((p) => p.id_prospek));
const namaProspek = Object.fromEntries(semua.map((p) => [p.id_prospek, p.nama_perusahaan]));
const hpProspek = Object.fromEntries(semua.map((p) => [p.id_prospek, p.no_hp_pic || '']));
const percakapan = Object.fromEntries(T.Percakapan.map((c) => [c.id_percakapan, c]));

const KOLOM_PROSPEK = [
  'id_prospek', 'nama_perusahaan', 'sektor', 'ae', 'status', 'kebutuhan', 'status_kebutuhan', 'tgl_tindak_lanjut', 'pengingat',
  'nama_pic', 'no_hp_pic', 'kategori', 'sumber', 'dibuat', 'diubah',
];
const prospek = terlihat.map((p) => Object.fromEntries(KOLOM_PROSPEK.map((k) => [k, p[k] ?? ''])));

const per_status = Object.fromEntries(STATUS_PIPELINE.map((s) => [s, terlihat.filter((p) => p.status === s).length]));
const per_ae = { 'AE A': 0, 'AE B': 0 };
for (const p of terlihat) if (p.ae in per_ae) per_ae[p.ae] += 1;

const antrean = T.Antrean_Staf.filter((t) => String(t.status).trim() !== 'Selesai')
  .map((t) => {
    const c = percakapan[t.id_percakapan] || {};
    return {
      id_tiket: t.id_tiket,
      id_percakapan: t.id_percakapan,
      id_prospek: c.id_prospek || '',
      nama_perusahaan: namaProspek[c.id_prospek] || '',
      pertanyaan: c.pertanyaan || '',
      jawaban: c.jawaban || '',
      alasan: t.alasan,
      status: t.status,
      waktu: t.waktu,
    };
  })
  .filter((t) => idTerlihat.has(t.id_prospek));

const daftarDraf = (status) =>
  T.Draf.filter((d) => String(d.status).trim() === status && idTerlihat.has(d.id_prospek))
    .map((d) => {
      const c = percakapan[d.id_percakapan] || {};
      return {
        id_draf: d.id_draf,
        id_prospek: d.id_prospek,
        nama_perusahaan: namaProspek[d.id_prospek] || '',
        no_hp_pic: hpProspek[d.id_prospek] || '', // E-03: tujuan tombol Kirim (simulasi), nomor dummy
        id_percakapan: d.id_percakapan || '',
        pertanyaan: c.pertanyaan || '',
        isi_draf: d.isi_draf,
        catatan: d.catatan || '',
        dibuat: d.dibuat,
        diputuskan_oleh: d.diputuskan_oleh || '',
      };
    })
    .reverse(); // terbaru di atas

// Pengingat (FR-11): tanggal tindak lanjut sama dengan atau sebelum TANGGAL_SIMULASI.
const pengingat = [];
const tindak_lanjut_mendatang = [];
for (const p of terlihat) {
  const tgl = String(p.tgl_tindak_lanjut || '').trim();
  if (!tgl) continue;
  const butir = { id_prospek: p.id_prospek, nama_perusahaan: p.nama_perusahaan, ae: p.ae, tgl_tindak_lanjut: tgl };
  if (tanggal && tgl < tanggal) pengingat.push({ ...butir, keterangan: 'Terlewat' });
  else if (tgl === tanggal) pengingat.push({ ...butir, keterangan: 'Jatuh tempo hari ini' });
  else tindak_lanjut_mendatang.push(butir);
}
const urutTanggal = (a, b) => a.tgl_tindak_lanjut.localeCompare(b.tgl_tindak_lanjut);

// FR-19: baris lengkap sesuai header sheet (tanpa kolom bantu _baris), tersaring per peran.
const barisLengkap = (sheet, daftar) => daftar.map((r) => header[sheet].map((k) => r[k] ?? ''));
const dataEkspor = ekspor
  ? {
      // Ekspor memuat juga peserta yang diarsipkan (kolom aktif FALSE), karena arsip bukan penghapusan.
      prospek: { kolom: header.Prospek, baris: barisLengkap('Prospek', milikPeran) },
      histori: {
        kolom: header.Histori,
        baris: barisLengkap('Histori', T.Histori.filter((h) => milikPeran.some((p) => p.id_prospek === h.id_prospek))),
      },
    }
  : undefined;

return [
  {
    json: {
      status: 'ok',
      peran,
      tanggal_simulasi: tanggal,
      prospek,
      ringkasan: { total: terlihat.length, per_status, per_ae, diarsipkan: milikPeran.length - terlihat.length },
      antrean,
      draf_menunggu: daftarDraf('Menunggu persetujuan'),
      draf_disetujui: daftarDraf('Disetujui'),
      draf_siap_kirim: daftarDraf('Siap kirim (simulasi)'),
      draf_terkirim: daftarDraf('Terkirim (simulasi)'),
      pengingat: pengingat.sort(urutTanggal),
      tindak_lanjut_mendatang: tindak_lanjut_mendatang.sort(urutTanggal),
      ekspor: dataEkspor,
    },
  },
];
