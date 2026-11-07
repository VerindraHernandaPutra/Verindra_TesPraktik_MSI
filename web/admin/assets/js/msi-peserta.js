// SIMULASI MSI — Tabel peserta (EB-05, E-02): cari, filter status dan AE, tambah, ubah, arsip dengan konfirmasi.
// Memakai GET /panel dan POST /peserta (docs/PERENCANAAN.md Section 10). Arsip = aktif FALSE; tidak ada hapus.
(function () {
  'use strict';
  var M = window.Msi;
  var el = M.el;
  var KATEGORI = ['CSR', 'Tata Kelola (GRC)', 'Human Capital', 'Digital', 'BUMD'];
  var POLA_HP = /^08120000\d{4}$/;
  var tabel = null;
  var data = [];
  var peranSekarang;
  var siapkanBaru = null; // id_permintaan tambah bertahan sampai berhasil, agar coba ulang tidak menggandakan data

  function modal(id) { return window.bootstrap.Modal.getOrCreateInstance(el(id)); }

  function lencanaStatus(s) {
    var warna = { Baru: 'primary', Kualifikasi: 'info', 'Follow-up': 'warning', 'Penawaran draf': 'success' }[s] || 'secondary';
    return '<span class="badge bg-soft-' + warna + ' text-' + warna + '">' + M.esc(s) + '</span>';
  }

  function aksiHtml(p) {
    var id = M.esc(p.id_prospek);
    return '<div class="hstack gap-2 justify-content-end">' +
      '<a href="javascript:void(0)" class="avatar-text avatar-md aksi-ubah" data-id="' + id + '" title="Ubah ' + id + '" aria-label="Ubah ' + id + '"><i class="feather feather-edit-3"></i></a>' +
      '<a href="javascript:void(0)" class="avatar-text avatar-md aksi-arsip" data-id="' + id + '" title="Arsipkan ' + id + '" aria-label="Arsipkan ' + id + '"><i class="feather feather-archive"></i></a>' +
      '</div>';
  }

  function mulaiTabel() {
    tabel = window.jQuery('#tabelPeserta').DataTable({
      data: data,
      pageLength: 10,
      lengthMenu: [10, 20, 50, 100],
      order: [[0, 'asc']],
      columns: [
        { data: 'id_prospek', render: function (v) { return M.esc(v); } },
        { data: 'nama_perusahaan', render: function (v, t, p) {
            return t === 'display' ? '<div class="fw-semibold text-truncate-1-line">' + M.esc(v) + '</div><div class="fs-12 text-muted">' + M.esc(p.sektor || '–') + '</div>' : v + ' ' + (p.sektor || '');
          } },
        { data: 'nama_pic', render: function (v, t, p) {
            return t === 'display' ? '<div>' + M.esc(v || '–') + '</div><div class="fs-12 text-muted">' + M.esc(p.no_hp_pic || '–') + '</div>' : (v || '') + ' ' + (p.no_hp_pic || '');
          } },
        { data: 'kategori', render: function (v, t) { return t === 'display' ? M.esc(v || '–') : v || ''; } },
        { data: 'ae', render: function (v, t) { return t === 'display' ? M.esc(v) : v; } },
        { data: 'status', render: function (v, t) { return t === 'display' ? lencanaStatus(v) : v; } },
        { data: 'sumber', render: function (v, t) { return t === 'display' ? M.esc(v || '–') : v || ''; } },
        { data: 'diubah', render: function (v, t) { return t === 'display' ? M.esc(M.formatWaktu(v) || '–') : v || ''; } },
        { data: null, orderable: false, searchable: false, className: 'text-end', render: function (v, t, p) { return aksiHtml(p); } },
      ],
      language: {
        search: 'Cari:', lengthMenu: 'Tampilkan _MENU_ baris', info: '_START_–_END_ dari _TOTAL_ peserta',
        infoEmpty: 'Tidak ada peserta', infoFiltered: '(disaring dari _MAX_ peserta)', zeroRecords: 'Tidak ada peserta yang cocok.',
        emptyTable: 'Belum ada peserta aktif.', paginate: { previous: 'Sebelumnya', next: 'Berikutnya' },
      },
    });
  }

  function saring() {
    var status = el('filter-status').value;
    var ae = el('filter-ae').value;
    var kolom = function (i, v) { tabel.column(i).search(v ? '^' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$' : '', true, false); };
    kolom(5, status);
    kolom(4, ae);
    tabel.draw();
  }

  function ringkasan() {
    el('jumlah-peserta').textContent = data.length + ' peserta aktif';
  }

  async function muat(hapusPesan) {
    if (hapusPesan !== false) M.pesan('pesan-peserta', 'info', 'Memuat peserta…');
    el('muat-peserta').disabled = true;
    var r = await M.api('GET', '/panel?peran=' + peranSekarang());
    el('muat-peserta').disabled = false;
    if (!r.ok) return M.pesan('pesan-peserta', 'danger', r.data.pesan || 'Peserta gagal dimuat. Silakan coba ulang.');
    data = r.data.prospek;
    if (hapusPesan !== false) M.pesan('pesan-peserta', 'info', '');
    ringkasan();
    if (!tabel) mulaiTabel(); else tabel.clear().rows.add(data).draw(false);
    var sembunyi = r.data.ringkasan.diarsipkan;
    el('catatan-arsip').textContent = sembunyi ? sembunyi + ' peserta diarsipkan disembunyikan dari tabel (baris tetap tersimpan).' : '';
  }

  // ---------- Form tambah / ubah ----------
  function isiForm(p) {
    var f = el('form-peserta');
    f.dataset.id = p ? p.id_prospek : '';
    ['nama_perusahaan', 'sektor', 'nama_pic', 'no_hp_pic'].forEach(function (k) { f.elements[k].value = p ? p[k] || '' : ''; });
    f.elements.kategori.value = p ? p.kategori || '' : '';
    f.elements.ae.value = p ? p.ae : '';
    f.elements.catatan.value = '';
    el('judul-modal-peserta').textContent = p ? 'Ubah peserta ' + p.id_prospek : 'Tambah peserta';
    el('simpan-peserta').textContent = p ? 'Simpan perubahan' : 'Tambah';
    el('baris-ae').hidden = peranSekarang() !== 'admin';
    M.pesan('pesan-form', 'info', '');
  }

  function periksaForm(f, tambah) {
    var s = function (k) { return f.elements[k].value.replace(/\s+/g, ' ').trim(); };
    var galat = [];
    if (!s('nama_perusahaan')) galat.push('Nama perusahaan wajib diisi.');
    if (!s('sektor')) galat.push('Sektor wajib diisi.');
    if (!s('nama_pic')) galat.push('Nama PIC wajib diisi.');
    if (!POLA_HP.test(s('no_hp_pic').replace(/[\s-]/g, ''))) galat.push('Nomor HP PIC tidak valid. Gunakan format 0812-0000-xxxx.');
    if (KATEGORI.indexOf(f.elements.kategori.value) < 0) galat.push('Pilih kategori ajang.');
    return galat;
  }

  async function simpan() {
    var f = el('form-peserta');
    var id = f.dataset.id;
    var galat = periksaForm(f, !id);
    if (galat.length) return M.pesan('pesan-form', 'danger', galat.join(' '));
    var s = function (k) { return f.elements[k].value.replace(/\s+/g, ' ').trim(); };
    var badan = {
      aksi: id ? 'ubah' : 'tambah', oleh: peranSekarang(),
      nama_perusahaan: s('nama_perusahaan'), sektor: s('sektor'), nama_pic: s('nama_pic'), no_hp_pic: s('no_hp_pic'),
      kategori: f.elements.kategori.value, catatan: s('catatan'),
    };
    if (id) badan.id_prospek = id;
    else {
      if (!siapkanBaru) siapkanBaru = 'tambah-' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2, 10));
      badan.id_permintaan = siapkanBaru;
    }
    if (peranSekarang() === 'admin' && f.elements.ae.value) badan.ae = f.elements.ae.value;
    el('simpan-peserta').disabled = true;
    M.pesan('pesan-form', 'info', 'Menyimpan…');
    var r = await M.api('POST', '/peserta', badan);
    el('simpan-peserta').disabled = false;
    if (r.ok) {
      if (!id) siapkanBaru = null;
      modal('modal-peserta').hide();
      M.pesan('pesan-peserta', 'success', r.data.pesan + ' Histori tercatat.');
      return muat(false);
    }
    if (r.status === 400) siapkanBaru = null; // ditolak aturan: perbaiki isian lalu kirim sebagai permintaan baru
    M.pesan('pesan-form', 'danger', r.data.pesan || 'Gagal menyimpan, data tidak tercatat. Tekan simpan lagi untuk mencoba ulang.');
  }

  // ---------- Arsip dengan konfirmasi ----------
  var idArsip = null;
  function mintaArsip(p) {
    idArsip = p.id_prospek;
    el('teks-arsip').textContent = p.id_prospek + ' — ' + p.nama_perusahaan;
    el('catatan-arsip-input').value = '';
    M.pesan('pesan-arsip', 'info', '');
    modal('modal-arsip').show();
  }

  async function arsipkan() {
    el('ya-arsip').disabled = true;
    var r = await M.api('POST', '/peserta', { aksi: 'arsip', oleh: peranSekarang(), id_prospek: idArsip, catatan: el('catatan-arsip-input').value.trim() });
    el('ya-arsip').disabled = false;
    if (r.ok) {
      modal('modal-arsip').hide();
      M.pesan('pesan-peserta', 'success', r.data.pesan + ' Baris tidak dihapus; Histori arsip_peserta tercatat.');
      return muat(false);
    }
    M.pesan('pesan-arsip', 'danger', r.data.pesan || 'Arsip gagal. Silakan coba ulang.');
  }

  // ---------- Pasang ----------
  window.jQuery(function () {
    var kat = el('kategori-peserta');
    KATEGORI.forEach(function (k) { kat.add(new Option(k, k)); });
    peranSekarang = M.pasangPemilihPeran('peran-peserta', function () { muat(); });

    el('muat-peserta').addEventListener('click', function () { muat(); });
    el('tambah-peserta').addEventListener('click', function () { isiForm(null); modal('modal-peserta').show(); });
    el('filter-status').addEventListener('change', saring);
    el('filter-ae').addEventListener('change', saring);
    el('form-peserta').addEventListener('submit', function (e) { e.preventDefault(); simpan(); });
    el('ya-arsip').addEventListener('click', arsipkan);
    window.jQuery('#tabelPeserta tbody').on('click', 'a.aksi-ubah, a.aksi-arsip', function () {
      var p = data.find(function (x) { return x.id_prospek === this.dataset.id; }, this);
      if (!p) return;
      if (this.classList.contains('aksi-ubah')) { isiForm(p); modal('modal-peserta').show(); } else mintaArsip(p);
    });
    muat().then(bukaDariParameter);
  });

  // Tautan "Lengkapi di Tabel Peserta" dari Panel Staf: buka modal ubah untuk prospek yang dimaksud.
  function bukaDariParameter() {
    var id = (new URLSearchParams(window.location.search).get('lengkapi') || '').toUpperCase();
    if (!id) return;
    var p = data.find(function (x) { return x.id_prospek === id; });
    if (p) { isiForm(p); modal('modal-peserta').show(); }
    else M.pesan('pesan-peserta', 'warning', 'Prospek ' + id + ' tidak ditemukan atau sudah diarsipkan.');
    window.history.replaceState(null, '', window.location.pathname);
  }
})();
