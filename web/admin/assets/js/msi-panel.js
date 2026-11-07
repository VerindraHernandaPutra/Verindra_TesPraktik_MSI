// Panel staf: ringkasan, tab per status dengan tabel, dan modal detail berisi tindakan.
// GET /panel?peran=staf, POST /approve, POST /draf/kirim. Tombol kirim hanya mengubah status dan mencatat Histori.
(function () {
  'use strict';
  var M = window.Msi;
  var el = M.el;
  var buat = M.buat;
  var $ = window.jQuery;

  var JENIS = ['antrean', 'menunggu', 'disetujui', 'siap', 'terkirim'];
  var SUMBER_API = { antrean: 'antrean', menunggu: 'draf_menunggu', disetujui: 'draf_disetujui', siap: 'draf_siap_kirim', terkirim: 'draf_terkirim' };
  var JUDUL = { antrean: 'Antrean eskalasi', menunggu: 'Menunggu persetujuan', disetujui: 'Disetujui', siap: 'Siap kirim', terkirim: 'Terkirim' };
  var IKON = { antrean: 'feather-alert-circle', menunggu: 'feather-clock', disetujui: 'feather-check-circle', siap: 'feather-send', terkirim: 'feather-check-square' };
  var WARNA = { antrean: 'danger', menunggu: 'warning', disetujui: 'info', siap: 'primary', terkirim: 'success' };
  var tabel = {};
  var data = {};
  var jenisDetail = null;
  var itemDetail = null;

  function modal(id) { return window.bootstrap.Modal.getOrCreateInstance(el(id)); }
  function ringkas(teks, n) { teks = String(teks || ''); return teks.length > n ? teks.slice(0, n - 1) + '…' : teks; }
  function perusahaan(v, t, d) {
    return t === 'display' ? '<div class="fw-semibold">' + M.esc(d.nama_perusahaan || '–') + '</div><div class="fs-12 text-muted">' + M.esc(d.id_prospek || '') + '</div>' : (d.nama_perusahaan || '') + ' ' + (d.id_prospek || '');
  }
  function teksSaja(kunci, n) {
    return function (v, t) { return t === 'display' ? M.esc(n ? ringkas(v, n) : v || '–') : v || ''; };
  }
  function waktu(kunci) {
    return function (v, t, d) { var w = d[kunci] || ''; return t === 'display' ? M.esc(M.formatWaktu(w) || '–') : w; };
  }
  function sumber(v, t, d) {
    var s = d.id_percakapan ? 'Chat' : 'Catatan AE';
    return t === 'display' ? '<span class="badge bg-soft-' + (d.id_percakapan ? 'info text-info' : 'warning text-warning') + '">' + s + '</span>' : s;
  }
  function hp(v, t, d) {
    if (t !== 'display') return d.no_hp_pic || '';
    return d.no_hp_pic ? M.esc(d.no_hp_pic) : '<span class="badge bg-soft-danger text-danger">Belum ada</span>';
  }
  function aksi() { return '<span class="fs-12 text-muted">Buka</span> <i class="feather feather-chevron-right"></i>'; }

  var KOLOM = {
    antrean: [
      { title: 'Tiket', data: 'id_tiket' },
      { title: 'Perusahaan', data: 'nama_perusahaan', render: perusahaan },
      { title: 'Pertanyaan', data: 'pertanyaan', render: teksSaja('pertanyaan', 90) },
      { title: 'Alasan', data: 'alasan', render: teksSaja('alasan', 70) },
      { title: 'Waktu', data: 'waktu', render: waktu('waktu') },
      { title: '', data: null, orderable: false, searchable: false, className: 'text-end', render: aksi },
    ],
    draf: [
      { title: 'Draf', data: 'id_draf' },
      { title: 'Perusahaan', data: 'nama_perusahaan', render: perusahaan },
      { title: 'Isi draf', data: 'isi_draf', render: teksSaja('isi_draf', 100) },
      { title: 'Sumber', data: 'id_percakapan', render: sumber },
      { title: 'Dibuat', data: 'dibuat', render: waktu('dibuat') },
      { title: '', data: null, orderable: false, searchable: false, className: 'text-end', render: aksi },
    ],
  };
  var KOLOM_SIAP = KOLOM.draf.slice(0, 4).concat([{ title: 'No. HP', data: 'no_hp_pic', render: hp }], KOLOM.draf.slice(4));

  function mulaiTabel(jenis) {
    var kolom = jenis === 'antrean' ? KOLOM.antrean : jenis === 'siap' ? KOLOM_SIAP : KOLOM.draf;
    tabel[jenis] = $('#tabel-' + jenis).DataTable({
      data: data[jenis],
      columns: kolom,
      order: [[0, 'desc']],
      pageLength: 10,
      lengthMenu: [10, 25, 50],
      language: {
        search: 'Cari:', lengthMenu: 'Tampilkan _MENU_ baris', info: '_START_–_END_ dari _TOTAL_', infoEmpty: 'Tidak ada data',
        infoFiltered: '(disaring dari _MAX_)', zeroRecords: 'Tidak ada yang cocok.', emptyTable: 'Belum ada data pada tab ini.',
        paginate: { previous: 'Sebelumnya', next: 'Berikutnya' },
      },
      createdRow: function (baris) { baris.style.cursor = 'pointer'; },
    });
    $('#tabel-' + jenis + ' tbody').on('click', 'tr', function () {
      var d = tabel[jenis].row(this).data();
      if (d) bukaDetail(jenis, d);
    });
  }

  function kartuAngka(jenis, jumlah) {
    var kolom = buat('div', 'col-xxl col-md-4 col-6');
    var kartu = buat('div', 'card stretch stretch-full');
    kartu.style.cursor = 'pointer';
    var badan = buat('div', 'card-body');
    var baris = buat('div', 'hstack justify-content-between');
    var teks = buat('div');
    teks.append(buat('div', 'fs-11 text-muted text-uppercase fw-semibold', JUDUL[jenis]), buat('h3', 'fw-bold mb-0 mt-2', String(jumlah)));
    var ik = buat('div', 'avatar-text avatar-lg bg-soft-' + WARNA[jenis] + ' text-' + WARNA[jenis] + ' rounded');
    ik.append(buat('i', 'feather ' + IKON[jenis]));
    baris.append(teks, ik);
    badan.append(baris);
    kartu.append(badan);
    kolom.append(kartu);
    kartu.addEventListener('click', function () { window.bootstrap.Tab.getOrCreateInstance(el('btn-' + jenis)).show(); });
    return kolom;
  }

  // ---------- Detail dan tindakan ----------
  function bagian(judul, isi, kelas) {
    var b = buat('div', 'mb-3');
    b.append(buat('div', 'fs-12 text-muted text-uppercase fw-semibold mb-1', judul), buat('div', kelas || '', isi));
    return b;
  }

  function tombol(teks, kelas, saatKlik) {
    var t = buat('button', 'btn ' + kelas, teks);
    t.type = 'button';
    t.addEventListener('click', function () { saatKlik(t); });
    return t;
  }

  function bukaDetail(jenis, d) {
    jenisDetail = jenis;
    itemDetail = d;
    var isi = el('isi-detail');
    var kaki = el('aksi-detail');
    isi.replaceChildren();
    kaki.replaceChildren();
    M.pesan('pesan-detail', 'info', '');
    var nama = (d.nama_perusahaan || '') + (d.id_prospek ? ' (' + d.id_prospek + ')' : '');

    if (jenis === 'antrean') {
      el('judul-detail').textContent = 'Tiket ' + d.id_tiket;
      isi.append(bagian('Perusahaan', nama), bagian('Pertanyaan', d.pertanyaan, 'bg-soft-dark rounded p-3'),
        bagian('Jawaban asisten', d.jawaban || '–'), bagian('Alasan eskalasi', d.alasan), bagian('Status', d.status + ' · ' + M.formatWaktu(d.waktu)));
    } else {
      el('judul-detail').textContent = 'Draf ' + d.id_draf + ' · ' + JUDUL[jenis];
      isi.append(bagian('Perusahaan', nama));
      if (d.pertanyaan) isi.append(bagian('Pertanyaan asal', d.pertanyaan));
      isi.append(bagian('Isi draf', d.isi_draf, 'bg-soft-dark rounded p-3'));
      if (d.catatan) isi.append(bagian('Catatan', d.catatan));
      isi.append(bagian('Sumber', (d.id_percakapan ? 'Percakapan ' + d.id_percakapan : 'Catatan AE') + ' · dibuat ' + M.formatWaktu(d.dibuat)));
    }

    var tutup = tombol('Tutup', 'btn-light-brand', function () { modal('modal-detail').hide(); });
    if (jenis === 'menunggu') {
      var catatan = buat('textarea', 'form-control');
      catatan.rows = 2;
      catatan.placeholder = 'Catatan (wajib bila menolak)';
      catatan.setAttribute('aria-label', 'Catatan untuk ' + d.id_draf);
      isi.append(catatan);
      kaki.append(tutup,
        tombol('Tolak', 'btn-light-brand', function (t) {
          if (!catatan.value.trim()) { catatan.focus(); return M.pesan('pesan-detail', 'danger', 'Isi catatan dulu sebelum menolak ' + d.id_draf + '.'); }
          putuskan(t, d.id_draf, 'tolak', catatan.value);
        }),
        tombol('Setujui', 'btn-primary', function (t) { putuskan(t, d.id_draf, 'setuju', catatan.value); }));
    } else if (jenis === 'disetujui') {
      kaki.append(tutup, tombol('Tandai siap kirim', 'btn-primary', function (t) { putuskan(t, d.id_draf, 'siap_kirim', ''); }));
    } else if (jenis === 'siap') {
      if (d.no_hp_pic) {
        isi.append(bagian('Tujuan', d.no_hp_pic));
        kaki.append(tutup, tombol('Kirim ke ' + d.no_hp_pic, 'btn-primary', function (t) { kirim(t, d); }));
      } else {
        M.pesan('pesan-detail', 'warning', 'No. HP PIC untuk ' + (d.nama_perusahaan || d.id_prospek) + ' belum ada, jadi draf belum bisa dikirim.');
        var lengkapi = buat('a', 'btn btn-primary', 'Lengkapi di Tabel Peserta');
        lengkapi.href = 'index.html?lengkapi=' + encodeURIComponent(d.id_prospek);
        var nonaktif = tombol('Kirim', 'btn-light-brand', function () {});
        nonaktif.disabled = true;
        kaki.append(tutup, nonaktif, lengkapi);
      }
    } else {
      if (jenis === 'terkirim') isi.append(bagian('Tujuan', d.no_hp_pic || '–'));
      kaki.append(tutup);
    }
    modal('modal-detail').show();
  }

  async function putuskan(t, idDraf, keputusan, catatan) {
    t.disabled = true;
    var r = await M.api('POST', '/approve', { id_draf: idDraf, keputusan: keputusan, catatan: catatan, oleh: 'staf' });
    if (r.ok) {
      modal('modal-detail').hide();
      M.pesan('pesan-panel', 'success', idDraf + ' sekarang berstatus "' + M.bersih(r.data.status_draf) + '".');
      return muat(false);
    }
    M.pesan('pesan-detail', 'danger', r.data.pesan || 'Keputusan gagal diproses. Silakan coba ulang.');
    t.disabled = false;
  }

  async function kirim(t, d) {
    t.disabled = true;
    var r = await M.api('POST', '/draf/kirim', { id_draf: d.id_draf, oleh: 'staf' });
    if (r.ok) {
      modal('modal-detail').hide();
      M.pesan('pesan-panel', 'success', r.data.pesan);
      return muat(false);
    }
    M.pesan('pesan-detail', 'danger', r.data.pesan || 'Pengiriman gagal. Silakan coba ulang.');
    t.disabled = false;
  }

  // ---------- Muat data ----------
  async function muat(hapusPesan) {
    if (hapusPesan !== false) M.pesan('pesan-panel', 'info', 'Memuat panel…');
    el('muat-panel').disabled = true;
    var r = await M.api('GET', '/panel?peran=staf');
    el('muat-panel').disabled = false;
    if (!r.ok) return M.pesan('pesan-panel', 'danger', r.data.pesan || 'Panel gagal dimuat. Silakan coba ulang.');
    var kartu = [];
    JENIS.forEach(function (j) {
      data[j] = r.data[SUMBER_API[j]] || [];
      el('jumlah-' + j).textContent = String(data[j].length);
      kartu.push(kartuAngka(j, data[j].length));
      if (!tabel[j]) mulaiTabel(j); else tabel[j].clear().rows.add(data[j]).draw(false);
    });
    el('kartu-panel').replaceChildren.apply(el('kartu-panel'), kartu);
    if (hapusPesan !== false) M.pesan('pesan-panel', 'info', '');
  }

  $(function () {
    el('muat-panel').addEventListener('click', function () { muat(); });
    // Tabel di tab tersembunyi dihitung lebarnya saat tab ditampilkan.
    $(document).on('shown.bs.tab', 'button[data-bs-toggle="tab"]', function () {
      $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust();
    });
    muat();
  });
})();
