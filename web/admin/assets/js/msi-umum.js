// Fungsi bersama semua halaman admin: akses n8n, peran contoh (bukan login), penampil pesan.
// Alamat n8n dibaca dari web/config.js (window.CONFIG). Teks dari server selalu lewat textContent/esc, tidak pernah HTML.
window.Msi = (function () {
  'use strict';
  var CFG = window.CONFIG || {};
  var NAMA_PERAN = { admin: 'Admin', ae_a: 'AE A', ae_b: 'AE B', staf: 'Staf' };
  var KUNCI_PERAN = 'msi_peran';
  var GALAT_SAMBUNG = 'Tidak dapat terhubung ke layanan. Pastikan n8n berjalan dan halaman dibuka dari http://localhost:8000.';

  function el(id) { return document.getElementById(id); }

    // Admin menampilkan status apa adanya, termasuk "(simulasi)": pengiriman di sini hanya mengubah status.
  function bersih(teks) {
    return String(teks == null ? '' : teks);
  }

  function buat(tag, kelas, teks) {
    var e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks !== undefined) e.textContent = teks;
    return e;
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Peran simulasi (bukan login). Dibagi antarhalaman lewat localStorage; bila diblokir, memakai nilai bawaan.
  function peran(bawaan) {
    try {
      var p = localStorage.getItem(KUNCI_PERAN);
      if (p && NAMA_PERAN[p] && p !== 'staf') return p;
    } catch (e) { /* diabaikan */ }
    return bawaan || 'admin';
  }
  function simpanPeran(p) {
    try { localStorage.setItem(KUNCI_PERAN, p); } catch (e) { /* diabaikan */ }
  }

  async function api(metode, path, body, batasMs) {
    var kontrol = new AbortController();
    var timer = setTimeout(function () { kontrol.abort(); }, batasMs || CFG.BATAS_WAKTU_MS || 60000);
    try {
      var res = await fetch(CFG.N8N_WEBHOOK_URL + path, {
        method: metode,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: kontrol.signal,
      });
      var data = await res.json().catch(function () { return {}; });
      return { ok: res.ok && data.status === 'ok', status: res.status, data: data };
    } catch (e) {
      return { ok: false, status: 0, data: { pesan: e.name === 'AbortError' ? 'Waktu tunggu habis.' : GALAT_SAMBUNG }, galatSambung: true };
    } finally {
      clearTimeout(timer);
    }
  }

  // Pesan status di wadah (komponen alert Bootstrap bawaan template). jenis: success | danger | info | warning.
  function pesan(idWadah, jenis, teks) {
    var w = el(idWadah);
    w.replaceChildren();
    if (!teks) return;
    var a = buat('div', 'alert alert-' + jenis + ' mb-3', bersih(teks));
    a.setAttribute('role', jenis === 'danger' ? 'alert' : 'status');
    w.append(a);
  }

  // Isi pemilih peran halaman (admin, AE A, AE B) dan simpan pilihan.
  function pasangPemilihPeran(idPilih, saatBerubah) {
    var s = el(idPilih);
    var p = peran();
    s.value = p;
    s.addEventListener('change', function () { simpanPeran(s.value); saatBerubah(); });
    return function () { return s.value; };
  }

  function formatWaktu(iso) {
    return String(iso || '').replace('T', ' ').replace(/\+\d\d:\d\d$/, '');
  }

  // Tema admin menyiutkan sidebar lewat CSS di bawah 1600 px, tetapi kelas "minimenu" (yang menggeser isi dan header)
  // baru dipasang saat jendela diubah ukurannya. Picu sekali saat dimuat agar sidebar dan isi selalu selaras.
  if (window.jQuery) window.jQuery(function () { window.jQuery(window).trigger('resize'); });

  return { CFG: CFG, NAMA_PERAN: NAMA_PERAN, GALAT_SAMBUNG: GALAT_SAMBUNG, el: el, bersih: bersih, buat: buat, esc: esc, peran: peran,
    simpanPeran: simpanPeran, api: api, pesan: pesan, pasangPemilihPeran: pasangPemilihPeran, formatWaktu: formatWaktu };
})();
