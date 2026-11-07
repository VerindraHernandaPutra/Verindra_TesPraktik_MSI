// SIMULASI MSI — Panel staf (BL-13 dimigrasi ke template admin, plus E-03 Kirim (simulasi)).
// GET /panel?peran=staf, POST /approve, POST /draf/kirim. Tidak ada pengiriman nyata di mana pun.
(function () {
  'use strict';
  var M = window.Msi;
  var el = M.el;
  var buat = M.buat;

  function isiDaftar(idWadah, idJumlah, daftar, buatButir, teksKosong) {
    var w = el(idWadah);
    w.replaceChildren();
    el(idJumlah).textContent = String(daftar.length);
    if (!daftar.length) w.append(buat('div', 'text-muted fs-13', teksKosong));
    daftar.forEach(function (d) { w.append(buatButir(d)); });
  }

  function kepalaButir(id, prospek, lencana, kelasLencana) {
    var k = buat('div', 'hstack gap-3 mb-2 flex-wrap');
    k.append(buat('strong', '', id), buat('span', '', prospek), buat('span', 'badge ' + kelasLencana, lencana));
    return k;
  }

  function butirAntrean(t) {
    var b = buat('div', 'border rounded p-3 mb-3');
    b.append(kepalaButir(t.id_tiket, t.id_prospek + ' — ' + t.nama_perusahaan, 'Diteruskan ke staf · ' + t.status, 'bg-soft-warning text-warning'),
      buat('div', '', t.pertanyaan), buat('div', 'fs-12 text-muted mt-2', 'Alasan: ' + t.alasan));
    return b;
  }

  function badanDraf(d, lencana, kelas) {
    var b = buat('div', 'border rounded p-3 mb-3');
    b.append(kepalaButir(d.id_draf, d.id_prospek + ' — ' + d.nama_perusahaan, lencana, kelas));
    if (d.pertanyaan) b.append(buat('div', 'fs-12 text-muted mb-2', 'Pertanyaan: ' + d.pertanyaan));
    b.append(buat('div', 'bg-soft-dark rounded p-3', d.isi_draf));
    if (d.catatan) b.append(buat('div', 'fs-12 text-muted mt-2', 'Catatan: ' + d.catatan));
    return b;
  }

  function tombol(teks, kelas) {
    var t = buat('button', 'btn ' + kelas, teks);
    t.type = 'button';
    return t;
  }

  function butirMenunggu(d) {
    var b = badanDraf(d, 'Menunggu persetujuan', 'bg-soft-warning text-warning');
    var catatan = buat('textarea', 'form-control mt-3');
    catatan.rows = 2;
    catatan.placeholder = 'Catatan (wajib bila menolak)';
    catatan.setAttribute('aria-label', 'Catatan untuk ' + d.id_draf);
    var setujui = tombol('Setujui', 'btn-primary btn-sm');
    var tolak = tombol('Tolak', 'btn-light-brand btn-sm');
    setujui.addEventListener('click', function () { putuskan(d.id_draf, 'setuju', catatan.value, [setujui, tolak]); });
    tolak.addEventListener('click', function () {
      if (!catatan.value.trim()) { catatan.focus(); return M.pesan('pesan-panel', 'danger', 'Isi catatan dulu sebelum menolak ' + d.id_draf + '.'); }
      putuskan(d.id_draf, 'tolak', catatan.value, [setujui, tolak]);
    });
    var aksi = buat('div', 'hstack gap-2 mt-3');
    aksi.append(setujui, tolak);
    b.append(catatan, aksi);
    return b;
  }

  function butirDisetujui(d) {
    var b = badanDraf(d, 'Disetujui', 'bg-soft-success text-success');
    var siap = tombol('Tandai Siap kirim', 'btn-primary btn-sm');
    siap.addEventListener('click', function () { putuskan(d.id_draf, 'siap_kirim', '', [siap]); });
    var aksi = buat('div', 'hstack gap-3 mt-3');
    aksi.append(siap);
    b.append(aksi);
    return b;
  }

  // E-03: tombol Kirim (simulasi) pada draf Siap kirim (simulasi).
  function butirSiapKirim(d) {
    var b = badanDraf(d, 'Siap kirim', 'bg-soft-info text-info');
    var kirim = tombol('Kirim ke ' + (d.no_hp_pic || 'nomor belum ada'), 'btn-primary btn-sm');
    if (!d.no_hp_pic) kirim.disabled = true;
    kirim.addEventListener('click', function () { kirimSimulasi(d, kirim); });
    var aksi = buat('div', 'hstack gap-3 mt-3');
    aksi.append(kirim);
    b.append(aksi);
    return b;
  }

  function butirTerkirim(d) {
    var b = badanDraf(d, 'Terkirim', 'bg-soft-success text-success');
    b.append(buat('div', 'fs-12 text-muted mt-2', 'Tujuan: ' + (d.no_hp_pic || '–')));
    return b;
  }

  async function putuskan(idDraf, keputusan, catatan, daftarTombol) {
    daftarTombol.forEach(function (t) { t.disabled = true; });
    var r = await M.api('POST', '/approve', { id_draf: idDraf, keputusan: keputusan, catatan: catatan, oleh: 'staf' });
    if (r.ok) {
      M.pesan('pesan-panel', 'success', idDraf + ' sekarang berstatus "' + M.bersih(r.data.status_draf) + '".');
      return muat(false);
    }
    M.pesan('pesan-panel', 'danger', r.data.pesan || 'Keputusan gagal diproses. Silakan coba ulang.');
    daftarTombol.forEach(function (t) { t.disabled = false; });
  }

  async function kirimSimulasi(d, tombolKirim) {
    tombolKirim.disabled = true;
    var r = await M.api('POST', '/draf/kirim', { id_draf: d.id_draf, oleh: 'staf' });
    if (r.ok) {
      M.pesan('pesan-panel', 'success', r.data.pesan);
      return muat(false);
    }
    M.pesan('pesan-panel', 'danger', r.data.pesan || 'Pengiriman gagal. Silakan coba ulang.');
    tombolKirim.disabled = false;
  }

  async function muat(hapusPesan) {
    if (hapusPesan !== false) M.pesan('pesan-panel', 'info', 'Memuat panel…');
    el('muat-panel').disabled = true;
    var r = await M.api('GET', '/panel?peran=staf');
    el('muat-panel').disabled = false;
    if (!r.ok) return M.pesan('pesan-panel', 'danger', r.data.pesan || 'Panel gagal dimuat. Silakan coba ulang.');
    var d = r.data;
    isiDaftar('daftar-antrean', 'jumlah-antrean', d.antrean, butirAntrean, 'Tidak ada tiket eskalasi.');
    isiDaftar('daftar-menunggu', 'jumlah-menunggu', d.draf_menunggu, butirMenunggu, 'Tidak ada draf yang menunggu persetujuan.');
    isiDaftar('daftar-disetujui', 'jumlah-disetujui', d.draf_disetujui, butirDisetujui, 'Tidak ada draf disetujui yang menunggu ditandai.');
    isiDaftar('daftar-siap', 'jumlah-siap', d.draf_siap_kirim, butirSiapKirim, 'Tidak ada draf siap kirim.');
    isiDaftar('daftar-terkirim', 'jumlah-terkirim', d.draf_terkirim, butirTerkirim, 'Belum ada draf terkirim.');
    if (hapusPesan !== false) M.pesan('pesan-panel', 'info', '');
  }

  window.jQuery(function () {
    el('muat-panel').addEventListener('click', function () { muat(); });
    muat();
  });
})();
