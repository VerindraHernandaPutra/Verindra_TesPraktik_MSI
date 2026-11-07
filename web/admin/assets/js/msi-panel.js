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
  var JUDUL = { antrean: 'Antrean eskalasi', menunggu: 'Menunggu persetujuan', disetujui: 'Disetujui', siap: 'Siap kirim (simulasi)', terkirim: 'Terkirim (simulasi)' };
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
  var SUMBER = { chat: ['Chat', 'info'], catatan_ae: ['Catatan AE', 'warning'], jawaban_staf: ['Jawaban staf', 'success'] };
  function sumber(v, t, d) {
    var s = SUMBER[d.sumber] || (d.id_percakapan ? SUMBER.chat : SUMBER.catatan_ae);
    var label = s[0] + (d.id_tiket ? ' · ' + d.id_tiket : '');
    return t === 'display' ? '<span class="badge bg-soft-' + s[1] + ' text-' + s[1] + '">' + M.esc(label) + '</span>' : label;
  }
  function usia(iso) {
    var ms = Date.now() - new Date(iso).getTime();
    if (!iso || isNaN(ms)) return '–';
    var menit = Math.max(0, Math.round(ms / 60000));
    if (menit < 60) return menit + ' menit lalu';
    var jam = Math.round(menit / 60);
    return jam < 24 ? jam + ' jam lalu' : Math.round(jam / 24) + ' hari lalu';
  }
  function statusTiket(v, t, d) {
    if (t !== 'display') return d.status;
    var warna = d.status === 'Baru' ? 'danger' : 'warning';
    var info = d.status === 'Ditangani' && d.ditangani_oleh ? '<div class="fs-12 text-muted">oleh ' + M.esc(d.ditangani_oleh) + '</div>' : '';
    var draf = d.draf_jawaban ? '<div class="fs-12 text-muted">Draf ' + M.esc(d.draf_jawaban.id_draf) + ' · ' + M.esc(M.bersih(d.draf_jawaban.status)) + '</div>' : '';
    return '<span class="badge bg-soft-' + warna + ' text-' + warna + '">' + M.esc(d.status) + '</span>' + info + draf;
  }
  function hp(v, t, d) {
    if (t !== 'display') return d.no_hp_pic || '';
    return d.no_hp_pic ? M.esc(d.no_hp_pic) : '<span class="badge bg-soft-danger text-danger">Belum ada</span>';
  }
  // Aksi cepat per baris (gaya ikon aksi tabel template). Aksi yang butuh isian membuka modal di mode yang sesuai.
  function ikonAksi(aksi, ikon, judul) {
    return '<a href="javascript:void(0)" class="avatar-text avatar-md aksi-cepat" data-aksi="' + aksi + '" title="' + judul +
      '" aria-label="' + judul + '"><i class="feather ' + ikon + '"></i></a>';
  }
  function aksiKolom(jenis) {
    return function (v, t, d) {
      if (t !== 'display') return '';
      var a = [];
      if (jenis === 'antrean') {
        if (d.status === 'Baru') a.push(ikonAksi('ambil', 'feather-user-check', 'Ambil tiket'));
        if (!d.draf_jawaban) a.push(ikonAksi('jawab', 'feather-edit-3', 'Jawab lewat draf'));
        a.push(ikonAksi('selesai', 'feather-check-circle', 'Tandai selesai'));
      } else if (jenis === 'menunggu') {
        a.push(ikonAksi('setuju', 'feather-check', 'Setujui'), ikonAksi('tolak', 'feather-x', 'Tolak (perlu catatan)'));
      } else if (jenis === 'disetujui') {
        a.push(ikonAksi('siap', 'feather-flag', 'Tandai Siap kirim (simulasi)'));
      } else if (jenis === 'siap') {
        a.push(d.no_hp_pic ? ikonAksi('kirim', 'feather-send', 'Kirim (simulasi) ke ' + M.esc(d.no_hp_pic)) : ikonAksi('lengkapi', 'feather-user-plus', 'Lengkapi No. HP di Tabel Peserta'));
      }
      a.push(ikonAksi('detail', 'feather-eye', 'Lihat detail'));
      return '<div class="hstack gap-2 justify-content-end">' + a.join('') + '</div>';
    };
  }

  var KOLOM = {
    antrean: [
      { title: 'Tiket', data: 'id_tiket' },
      { title: 'Perusahaan', data: 'nama_perusahaan', render: perusahaan },
      { title: 'Pertanyaan', data: 'pertanyaan', render: teksSaja('pertanyaan', 55) },
      { title: 'Status', data: 'status', render: statusTiket },
      { title: 'Usia', data: 'waktu', render: function (v, t) { return t === 'display' ? M.esc(usia(v)) : v; } },
    ],
    draf: [
      { title: 'Draf', data: 'id_draf' },
      { title: 'Perusahaan', data: 'nama_perusahaan', render: perusahaan },
      { title: 'Isi draf', data: 'isi_draf', render: teksSaja('isi_draf', 70) },
      { title: 'Sumber', data: 'id_percakapan', render: sumber },
      { title: 'Dibuat', data: 'dibuat', render: waktu('dibuat') },
    ],
  };
  var KOLOM_SIAP = KOLOM.draf.slice(0, 4).concat([{ title: 'No. HP', data: 'no_hp_pic', render: hp }], KOLOM.draf.slice(4));

  function mulaiTabel(jenis) {
    var kolom = (jenis === 'antrean' ? KOLOM.antrean : jenis === 'siap' ? KOLOM_SIAP : KOLOM.draf)
      .concat([{ title: 'Aksi', data: null, orderable: false, searchable: false, className: 'text-end text-nowrap', render: aksiKolom(jenis) }]);
    tabel[jenis] = $('#tabel-' + jenis).DataTable({
      data: data[jenis],
      columns: kolom,
      order: [[0, jenis === 'antrean' ? 'asc' : 'desc']],
      pageLength: 10,
      lengthMenu: [10, 25, 50],
      language: {
        search: 'Cari:', lengthMenu: 'Tampilkan _MENU_ baris', info: '_START_–_END_ dari _TOTAL_', infoEmpty: 'Tidak ada data',
        infoFiltered: '(disaring dari _MAX_)', zeroRecords: 'Tidak ada yang cocok.', emptyTable: 'Belum ada data pada tab ini.',
        paginate: { previous: 'Sebelumnya', next: 'Berikutnya' },
      },
      autoWidth: false,
      createdRow: function (baris) { baris.style.cursor = 'pointer'; },
    });
    $('#tabel-' + jenis + ' tbody').on('click', 'a.aksi-cepat', function (e) {
      e.preventDefault();
      e.stopPropagation(); // jangan ikut membuka detail lewat klik baris
      var d = tabel[jenis].row($(this).closest('tr')).data();
      if (d) aksiCepat(jenis, d, this.dataset.aksi, this);
    });
    $('#tabel-' + jenis + ' tbody').on('click', 'tr', function () {
      var d = tabel[jenis].row(this).data();
      if (d) bukaDetail(jenis, d);
    });
  }

  function aksiCepat(jenis, d, aksi, a) {
    if (aksi === 'detail') return bukaDetail(jenis, d);
    if (aksi === 'jawab' || aksi === 'selesai' || aksi === 'tolak') return bukaDetail(jenis, d, aksi);
    if (aksi === 'lengkapi') { window.location.href = 'index.html?lengkapi=' + encodeURIComponent(d.id_prospek); return; }
    // Penanda sibuk untuk ikon tautan (pengganti atribut disabled pada tombol).
    var t = { set disabled(v) { a.classList.toggle('disabled', v); a.style.pointerEvents = v ? 'none' : ''; a.style.opacity = v ? '0.5' : ''; } };
    if (aksi === 'ambil') return ubahTiket(t, d.id_tiket, 'ambil', {}, 'pesan-panel');
    if (aksi === 'setuju') return putuskan(t, d.id_draf, 'setuju', '', 'pesan-panel');
    if (aksi === 'siap') return putuskan(t, d.id_draf, 'siap_kirim', '', 'pesan-panel');
    if (aksi === 'kirim') {
      if (!window.confirm('Kirim (simulasi) draf ' + d.id_draf + ' ke ' + d.no_hp_pic + '? Hanya status yang berubah; tidak ada pesan yang dikirim.')) return;
      return kirim(t, d, 'pesan-panel');
    }
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

  function bukaDetail(jenis, d, modeAwal) {
    jenisDetail = jenis;
    itemDetail = d;
    var isi = el('isi-detail');
    var kaki = el('aksi-detail');
    isi.replaceChildren();
    kaki.replaceChildren();
    M.pesan('pesan-detail', 'info', '');
    var nama = (d.nama_perusahaan || '') + (d.id_prospek ? ' (' + d.id_prospek + ')' : '');

    if (jenis === 'antrean') {
      el('judul-detail').textContent = 'Tiket ' + d.id_tiket + ' · ' + d.status;
      isi.append(bagian('Perusahaan', nama), bagian('Pertanyaan', d.pertanyaan, 'bg-soft-dark rounded p-3'),
        bagian('Jawaban asisten', d.jawaban || '–'), bagian('Alasan eskalasi', d.alasan),
        bagian('Status', d.status + (d.ditangani_oleh ? ' oleh ' + d.ditangani_oleh : '') + ' · masuk ' + M.formatWaktu(d.waktu) + ' (' + usia(d.waktu) + ')'));
      aksiTiket(d, isi, kaki, modeAwal);
      modal('modal-detail').show();
      return;
    } else {
      el('judul-detail').textContent = 'Draf ' + d.id_draf + ' · ' + JUDUL[jenis];
      isi.append(bagian('Perusahaan', nama));
      if (d.pertanyaan) isi.append(bagian('Pertanyaan asal', d.pertanyaan));
      isi.append(bagian('Isi draf', d.isi_draf, 'bg-soft-dark rounded p-3'));
      if (d.catatan) isi.append(bagian('Catatan', d.catatan));
      if (d.id_tiket) isi.append(bagian('Menjawab tiket', d.id_tiket + ' · tiket selesai otomatis saat draf ini terkirim'));
      isi.append(bagian('Sumber', (d.id_percakapan ? 'Percakapan ' + d.id_percakapan : 'Catatan AE') + ' · dibuat ' + M.formatWaktu(d.dibuat)));
    }

    var tutup = tombol('Tutup', 'btn-light-brand', function () { modal('modal-detail').hide(); });
    if (jenis === 'menunggu') {
      var catatan = buat('textarea', 'form-control');
      catatan.rows = 2;
      catatan.placeholder = 'Catatan (wajib bila menolak)';
      catatan.setAttribute('aria-label', 'Catatan untuk ' + d.id_draf);
      isi.append(catatan);
      if (modeAwal === 'tolak') {
        M.pesan('pesan-detail', 'warning', 'Isi alasan penolakan, lalu tekan Tolak.');
        saatTerbuka(function () { catatan.focus(); });
      }
      kaki.append(tutup,
        tombol('Tolak', 'btn-light-brand', function (t) {
          if (!catatan.value.trim()) { catatan.focus(); return M.pesan('pesan-detail', 'danger', 'Isi catatan dulu sebelum menolak ' + d.id_draf + '.'); }
          putuskan(t, d.id_draf, 'tolak', catatan.value);
        }),
        tombol('Setujui', 'btn-primary', function (t) { putuskan(t, d.id_draf, 'setuju', catatan.value); }));
    } else if (jenis === 'disetujui') {
      kaki.append(tutup, tombol('Tandai Siap kirim (simulasi)', 'btn-primary', function (t) { putuskan(t, d.id_draf, 'siap_kirim', ''); }));
    } else if (jenis === 'siap') {
      if (d.no_hp_pic) {
        isi.append(bagian('Tujuan', d.no_hp_pic));
        kaki.append(tutup, tombol('Kirim (simulasi) ke ' + d.no_hp_pic, 'btn-primary', function (t) { kirim(t, d); }));
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

  // Tindakan tiket (Opsi B): ambil, jawab lewat draf, tandai selesai. Semua lewat POST /tiket.
  function saatTerbuka(fn) {
    el('modal-detail').addEventListener('shown.bs.modal', fn, { once: true });
  }

  function aksiTiket(d, isi, kaki, modeAwal) {
    var tutup = tombol('Tutup', 'btn-light-brand', function () { modal('modal-detail').hide(); });
    var formulir = buat('div', 'mt-2');
    var label = buat('label', 'form-label fw-semibold');
    var kotak = buat('textarea', 'form-control');
    kotak.rows = 4;
    formulir.append(label, kotak);
    formulir.hidden = true;
    isi.append(formulir);
    var mode = null;

    function siapkan(m, teksLabel, placeholder) {
      mode = m;
      formulir.hidden = false;
      label.textContent = teksLabel;
      kotak.placeholder = placeholder;
      kotak.value = '';
      kotak.focus();
      kirimForm.hidden = false;
      kirimForm.textContent = m === 'jawab' ? 'Buat draf jawaban' : 'Simpan, tiket selesai';
    }
    var kirimForm = tombol('', 'btn-primary', function (t) {
      var teks = kotak.value.trim();
      if (!teks) { kotak.focus(); return M.pesan('pesan-detail', 'danger', mode === 'jawab' ? 'Tulis jawaban dulu.' : 'Catatan penyelesaian wajib diisi.'); }
      ubahTiket(t, d.id_tiket, mode, mode === 'jawab' ? { jawaban: teks } : { catatan: teks });
    });
    kirimForm.hidden = true;

    var tombolTombol = [tutup];
    if (d.status === 'Baru') tombolTombol.push(tombol('Ambil tiket', 'btn-light-brand', function (t) { ubahTiket(t, d.id_tiket, 'ambil', {}); }));
    if (d.draf_jawaban) {
      isi.insertBefore(bagian('Draf jawaban', d.draf_jawaban.id_draf + ' · ' + M.bersih(d.draf_jawaban.status) + ' (lanjutkan di tab draf)'), formulir);
    } else {
      tombolTombol.push(tombol('Jawab lewat draf', 'btn-light-brand', function () {
        siapkan('jawab', 'Jawaban untuk calon peserta', 'Tulis jawaban staf; akan menjadi draf yang perlu disetujui sebelum dikirim.');
      }));
    }
    tombolTombol.push(tombol('Tandai selesai', 'btn-light-brand', function () {
      siapkan('selesai', 'Catatan penyelesaian', 'Misalnya: sudah dijawab lewat telepon.');
    }));
    tombolTombol.push(kirimForm);
    tombolTombol.forEach(function (b) { kaki.append(b); });
    // Dibuka dari aksi cepat: langsung tampilkan kolom isian yang sesuai.
    if (modeAwal === 'jawab' && !d.draf_jawaban) {
      siapkan('jawab', 'Jawaban untuk calon peserta', 'Tulis jawaban staf; akan menjadi draf yang perlu disetujui sebelum dikirim.');
      saatTerbuka(function () { kotak.focus(); });
    } else if (modeAwal === 'selesai') {
      siapkan('selesai', 'Catatan penyelesaian', 'Misalnya: sudah dijawab lewat telepon.');
      saatTerbuka(function () { kotak.focus(); });
    }
  }

  async function ubahTiket(t, idTiket, aksi, tambahan, wadah) {
    t.disabled = true;
    var r = await M.api('POST', '/tiket', Object.assign({ id_tiket: idTiket, aksi: aksi, oleh: 'staf' }, tambahan));
    if (r.ok) {
      modal('modal-detail').hide();
      M.pesan('pesan-panel', 'success', r.data.pesan);
      return muat(false);
    }
    M.pesan(wadah || 'pesan-detail', 'danger', r.data.pesan || 'Tiket gagal diperbarui. Silakan coba ulang.');
    t.disabled = false;
  }

  async function putuskan(t, idDraf, keputusan, catatan, wadah) {
    t.disabled = true;
    var r = await M.api('POST', '/approve', { id_draf: idDraf, keputusan: keputusan, catatan: catatan, oleh: 'staf' });
    if (r.ok) {
      modal('modal-detail').hide();
      M.pesan('pesan-panel', 'success', idDraf + ' sekarang berstatus "' + M.bersih(r.data.status_draf) + '".');
      return muat(false);
    }
    M.pesan(wadah || 'pesan-detail', 'danger', r.data.pesan || 'Keputusan gagal diproses. Silakan coba ulang.');
    t.disabled = false;
  }

  async function kirim(t, d, wadah) {
    t.disabled = true;
    var r = await M.api('POST', '/draf/kirim', { id_draf: d.id_draf, oleh: 'staf' });
    if (r.ok) {
      modal('modal-detail').hide();
      M.pesan('pesan-panel', 'success', r.data.pesan);
      return muat(false);
    }
    M.pesan(wadah || 'pesan-detail', 'danger', r.data.pesan || 'Pengiriman gagal. Silakan coba ulang.');
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
