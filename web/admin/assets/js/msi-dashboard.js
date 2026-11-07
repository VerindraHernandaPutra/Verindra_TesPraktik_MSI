// SIMULASI MSI — Dashboard pipeline (BL-14 s.d. BL-17, BL-22 dimigrasi ke template admin).
// GET /panel, POST /prospek/status, POST /prospek/draf, POST /pengingat. Tanpa nilai penjualan; tidak ada pengiriman nyata.
(function () {
  'use strict';
  var M = window.Msi;
  var el = M.el;
  var buat = M.buat;
  var STATUS = ['Baru', 'Kualifikasi', 'Follow-up', 'Penawaran draf'];
  var peranSekarang;
  var urutanMuat = 0; // respons terlambat (mis. peran lama) diabaikan agar tidak menimpa data terbaru
  var prospekDraf = null;

  function modal(id) { return window.bootstrap.Modal.getOrCreateInstance(el(id)); }

  function kartuAngka(angka, label, ikon, warna) {
    var kolom = buat('div', 'col-xxl-3 col-md-4 col-6');
    var kartu = buat('div', 'card stretch stretch-full');
    var badan = buat('div', 'card-body');
    var baris = buat('div', 'hstack justify-content-between');
    var teks = buat('div');
    teks.append(buat('div', 'fs-11 text-muted text-uppercase fw-semibold', label), buat('h3', 'fw-bold mb-0 mt-2', String(angka)));
    var ik = buat('div', 'avatar-text avatar-lg bg-soft-' + warna + ' text-' + warna + ' rounded');
    ik.append(buat('i', 'feather ' + ikon));
    baris.append(teks, ik);
    badan.append(baris);
    kartu.append(badan);
    kolom.append(kartu);
    return kolom;
  }

  function isiDaftar(idWadah, idJumlah, daftar, buatButir, teksKosong) {
    var w = el(idWadah);
    w.replaceChildren();
    el(idJumlah).textContent = String(daftar.length);
    if (!daftar.length) w.append(buat('div', 'text-muted fs-13', teksKosong));
    daftar.forEach(function (d) { w.append(buatButir(d)); });
  }

  function butirPengingat(p) {
    var terlewat = p.keterangan === 'Terlewat';
    var b = buat('div', 'hstack gap-3 border rounded p-3 mb-2');
    // Ikon dan teks: arti tidak bergantung pada warna saja.
    var ik = buat('div', 'avatar-text avatar-md rounded bg-soft-' + (terlewat ? 'danger text-danger' : 'warning text-warning'));
    ik.append(buat('i', 'feather ' + (terlewat ? 'feather-alert-circle' : 'feather-clock')));
    var teks = buat('div');
    teks.append(buat('div', 'fw-semibold', p.id_prospek + ' — ' + p.nama_perusahaan),
      buat('div', 'fs-12 text-muted', p.keterangan + ' · ' + p.tgl_tindak_lanjut + ' · ' + p.ae));
    b.append(ik, teks);
    return b;
  }

  function butirMendatang(p) {
    var b = buat('div', 'border rounded p-3 mb-2');
    b.append(buat('div', 'fw-semibold', p.id_prospek + ' — ' + p.nama_perusahaan), buat('div', 'fs-12 text-muted', p.tgl_tindak_lanjut + ' · ' + p.ae));
    return b;
  }

  function barisProspek(p) {
    var tr = document.createElement('tr');
    var tdKeb = buat('td');
    tdKeb.append(buat('div', '', p.kebutuhan || '–'), buat('div', 'fs-12 text-muted', p.status_kebutuhan));
    var pilih = buat('select', 'form-select form-select-sm');
    pilih.setAttribute('aria-label', 'Status ' + p.id_prospek);
    STATUS.forEach(function (s) { pilih.add(new Option(s, s, false, s === p.status)); });
    var simpan = buat('button', 'btn btn-light-brand btn-sm', 'Simpan');
    simpan.type = 'button';
    simpan.disabled = true;
    pilih.addEventListener('change', function () { simpan.disabled = pilih.value === p.status; });
    simpan.addEventListener('click', function () { ubahStatus(p.id_prospek, pilih.value, [pilih, simpan]); });
    var tdStatus = buat('td');
    var wadah = buat('div', 'hstack gap-2');
    wadah.append(pilih, simpan);
    tdStatus.append(wadah);
    var tdDraf = buat('td', 'text-end');
    var buka = buat('button', 'btn btn-light-brand btn-sm', 'Catatan & draf AI');
    buka.type = 'button';
    buka.addEventListener('click', function () { bukaDraf(p); });
    tdDraf.append(buka);
    tr.append(buat('td', '', p.id_prospek), buat('td', 'fw-semibold', p.nama_perusahaan), buat('td', '', p.sektor || '–'),
      buat('td', '', p.ae), tdKeb, buat('td', '', p.tgl_tindak_lanjut || '–'), tdStatus, tdDraf);
    return tr;
  }

  async function ubahStatus(idProspek, statusBaru, kontrol) {
    kontrol.forEach(function (k) { k.disabled = true; });
    var r = await M.api('POST', '/prospek/status', { id_prospek: idProspek, status_baru: statusBaru, oleh: peranSekarang() });
    if (r.ok) {
      var h = r.data.histori;
      M.pesan('pesan-dash', 'success', idProspek + ': ' + h.nilai_lama + ' → ' + h.nilai_baru + '. Histori ' + h.id_histori + ' tercatat (' + h.aktor + ').');
      return muat(false);
    }
    M.pesan('pesan-dash', 'danger', r.data.pesan || 'Perubahan status gagal. Silakan coba ulang.');
    kontrol.forEach(function (k) { k.disabled = false; });
  }

  // BL-22 (FR-23): catatan AE lalu draf AI, dalam modal.
  function bukaDraf(p) {
    prospekDraf = p;
    el('judul-modal-draf').textContent = 'Draf AI untuk ' + p.id_prospek + ' — ' + p.nama_perusahaan;
    var c = el('catatan-draf');
    c.value = '';
    c.placeholder = 'Catatan ' + M.NAMA_PERAN[peranSekarang()] + ' untuk ' + p.id_prospek + ', misalnya: Perlu mengonfirmasi apakah perusahaan ingin informasi program awards';
    el('hasil-draf').replaceChildren();
    M.pesan('pesan-modal-draf', 'info', '');
    modal('modal-draf').show();
  }

  async function buatDraf() {
    var c = el('catatan-draf');
    if (!c.value.trim()) { c.focus(); return M.pesan('pesan-modal-draf', 'danger', 'Isi catatan dulu sebelum meminta draf AI.'); }
    el('buat-draf').disabled = true;
    M.pesan('pesan-modal-draf', 'info', 'AI sedang menyusun draf…');
    var r = await M.api('POST', '/prospek/draf', { id_prospek: prospekDraf.id_prospek, catatan: c.value, oleh: peranSekarang() });
    el('buat-draf').disabled = false;
    if (r.ok) {
      M.pesan('pesan-modal-draf', 'success', r.data.id_draf + ' · ' + r.data.status_draf + ' · menunggu persetujuan di Panel Staf. Histori tercatat.');
      el('hasil-draf').replaceChildren(buat('div', 'bg-soft-dark rounded p-3', r.data.isi_draf));
      c.value = '';
    } else {
      M.pesan('pesan-modal-draf', 'danger', r.data.pesan || 'Draf gagal dibuat. Silakan coba ulang.');
    }
  }

  async function muat(hapusPesan) {
    var nomor = ++urutanMuat;
    var peran = peranSekarang();
    if (hapusPesan !== false) M.pesan('pesan-dash', 'info', 'Memuat dashboard…');
    el('muat-dashboard').disabled = true;
    var r = await M.api('GET', '/panel?peran=' + peran);
    if (nomor !== urutanMuat) return;
    el('muat-dashboard').disabled = false;
    if (!r.ok) return M.pesan('pesan-dash', 'danger', r.data.pesan || 'Dashboard gagal dimuat. Silakan coba ulang.');
    var d = r.data;
    var rg = d.ringkasan;
    var ikon = ['feather-flag', 'feather-check-circle', 'feather-phone-call', 'feather-file-text'];
    var warna = ['primary', 'info', 'warning', 'success'];
    el('kartu-status').replaceChildren(kartuAngka(rg.total, 'Total prospek', 'feather-users', 'primary'),
      ...STATUS.map(function (s, i) { return kartuAngka(rg.per_status[s] || 0, s, ikon[i], warna[i]); }));
    el('kartu-ae').replaceChildren(...Object.entries(rg.per_ae).map(function (e) { return kartuAngka(e[1], e[0], 'feather-user', 'indigo'); }));
    el('keterangan-dash').textContent = 'Per tanggal ' + d.tanggal_simulasi + ' · ' +
      (peran === 'admin' ? 'semua prospek aktif' : 'hanya prospek milik ' + M.NAMA_PERAN[peran]) + ' · Tanpa nilai penjualan';
    isiDaftar('daftar-pengingat', 'jumlah-pengingat', d.pengingat, butirPengingat, 'Tidak ada tindak lanjut jatuh tempo.');
    isiDaftar('daftar-mendatang', 'jumlah-mendatang', d.tindak_lanjut_mendatang, butirMendatang, 'Tidak ada jadwal mendatang.');
    el('jumlah-prospek').textContent = String(d.prospek.length);
    el('tabel-prospek').tBodies[0].replaceChildren(...d.prospek.map(barisProspek));
    if (hapusPesan !== false) M.pesan('pesan-dash', 'info', '');
  }

  // BL-17 (FR-19): Ekspor CSV sesuai peran; dibuat di peramban.
  function keCsv(kolom, baris) {
    var sel = function (v) { var t = String(v == null ? '' : v); return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    return [kolom].concat(baris).map(function (r) { return r.map(sel).join(','); }).join('\r\n') + '\r\n';
  }
  function unduh(namaFile, isi) {
    var url = URL.createObjectURL(new Blob(['﻿' + isi], { type: 'text/csv;charset=utf-8' })); // BOM agar Excel membaca UTF-8
    var a = document.createElement('a');
    a.href = url;
    a.download = namaFile;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  async function ekspor() {
    var peran = peranSekarang();
    el('ekspor-csv').disabled = true;
    var r = await M.api('GET', '/panel?peran=' + peran + '&ekspor=1');
    el('ekspor-csv').disabled = false;
    if (!r.ok || !r.data.ekspor) return M.pesan('pesan-dash', 'danger', r.data.pesan || 'Ekspor gagal. Silakan coba ulang.');
    var e = r.data.ekspor;
    var akhiran = peran + '_' + r.data.tanggal_simulasi + '.csv';
    unduh('prospek_' + akhiran, keCsv(e.prospek.kolom, e.prospek.baris));
    unduh('histori_' + akhiran, keCsv(e.histori.kolom, e.histori.baris));
    M.pesan('pesan-dash', 'success', 'Diunduh: prospek_' + akhiran + ' (' + e.prospek.baris.length + ' baris, termasuk yang diarsipkan) dan histori_' + akhiran + ' (' + e.histori.baris.length + ' baris).');
  }

  async function jalankanPengingat() {
    el('jalankan-pengingat').disabled = true;
    M.pesan('pesan-dash', 'info', 'Menjalankan pengingat…');
    var r = await M.api('POST', '/pengingat', {});
    el('jalankan-pengingat').disabled = false;
    if (r.ok) {
      var daftar = r.data.ditandai.map(function (d) { return d.id_prospek + ' (' + d.pengingat + ')'; }).join(', ') || 'tidak ada';
      M.pesan('pesan-dash', 'success', 'Pengingat per ' + r.data.tanggal_simulasi + ': ' + daftar + '. ' + r.data.sel_berubah + ' sel diperbarui di sheet Prospek.');
      return muat(false);
    }
    M.pesan('pesan-dash', 'danger', r.data.pesan || 'Pengingat gagal dijalankan. Silakan coba ulang.');
  }

  window.jQuery(function () {
    peranSekarang = M.pasangPemilihPeran('peran-dashboard', function () { muat(); });
    el('muat-dashboard').addEventListener('click', function () { muat(); });
    el('ekspor-csv').addEventListener('click', ekspor);
    el('jalankan-pengingat').addEventListener('click', jalankanPengingat);
    el('buat-draf').addEventListener('click', buatDraf);
    muat();
  });
})();
