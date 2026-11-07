// Asisten AI mengambang (BL-09, FR-01 s.d. FR-04, FR-16): chat calon peserta di situs publik. POST /chat (docs/PERENCANAAN.md Section 10).
// Bot meminta nama perusahaan sekali (WF-01 butuh identitas prospek), lalu mengingatnya selama halaman terbuka.
// Gagal terlihat gagal: gelembung merah + Coba ulang dengan id_permintaan yang SAMA, sehingga data tidak ganda.
(function () {
  'use strict';
  var CFG = window.CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var buka = $('asisten-buka');
  var panel = $('asisten-panel');
  if (!buka || !panel) return;
  var area = $('asisten-pesan');
  var saran = $('asisten-saran');
  var form = $('asisten-form');
  var input = $('asisten-input');
  var kirimTombol = $('asisten-kirim');
  var ganti = $('asisten-ganti');
  var sub = $('asisten-sub');

  var perusahaan = '';   // diisi setelah pengguna menyebut nama perusahaan
  var sudahSapa = false;
  var sibuk = false;

  var SARAN = ['Apakah pendaftaran dipungut biaya?', 'Bagaimana tahapan penilaiannya?', 'Apakah sponsorship wajib?'];

  function buat(tag, kelas, teks) {
    var e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks !== undefined) e.textContent = teks; // textContent: teks server tidak pernah dieksekusi sebagai HTML
    return e;
  }

  function tambah(jenis, teks) {
    var baris = buat('div', 'asisten-baris ' + jenis);
    var gelembung = buat('div', 'asisten-gelembung', teks);
    baris.append(gelembung);
    area.append(baris);
    area.scrollTop = area.scrollHeight;
    return { baris: baris, gelembung: gelembung };
  }

  function chip(teks, kelas) { return buat('span', 'asisten-chip' + (kelas ? ' ' + kelas : ''), teks); }

  function meta(pesan, hasil) {
    var m = buat('div', 'asisten-meta');
    var rujukan = Array.isArray(hasil.rujukan_kb) ? hasil.rujukan_kb : [];
    if (rujukan.length) {
      m.append(buat('span', '', 'Rujukan:'));
      rujukan.forEach(function (kode) { m.append(chip(kode)); });
    }
    if (hasil.berulang === true) m.append(buat('span', '', '· jawaban yang sudah tersimpan'));
    if (hasil.eskalasi === true) m.append(chip('Diteruskan ke staf', 'eskalasi'));
    if (m.childNodes.length) pesan.gelembung.append(m);
  }

  function tampilkanSaran(tampil) {
    saran.replaceChildren();
    saran.hidden = !tampil;
    if (!tampil) return;
    SARAN.forEach(function (s) {
      var b = buat('button', '', s);
      b.type = 'button';
      b.addEventListener('click', function () { kirimPertanyaan(s); });
      saran.append(b);
    });
  }

  function atur(sedangKirim) {
    sibuk = sedangKirim;
    kirimTombol.disabled = sedangKirim; // keadaan Memuat: cegah terkirim dua kali
    input.disabled = sedangKirim;
  }

  function tanyaNama() {
    perusahaan = '';
    ganti.hidden = true;
    sub.textContent = 'Company Award Website';
    tampilkanSaran(false);
    input.placeholder = 'Nama perusahaan Anda';
    tambah('agent', 'Boleh tahu nama perusahaan Anda? Nama ini kami pakai untuk mencatat percakapan.');
  }

  function sapa() {
    sudahSapa = true;
    tambah('agent', 'Halo, saya asisten AI program Company Award Website, bukan staf manusia. ' +
      'Saya menjawab berdasarkan informasi resmi program; pertanyaan yang belum tercakup akan saya teruskan kepada staf.');
    tanyaNama();
  }

  function tampilkanGagal(permintaan, sebab) {
    var pesan = tambah('gagal', 'Gagal menyimpan, data tidak tercatat. ' + sebab);
    var ulang = buat('button', 'asisten-ulang', 'Coba ulang');
    ulang.type = 'button';
    ulang.addEventListener('click', function () {
      if (sibuk) return;
      pesan.baris.remove();
      kirim(permintaan);
    });
    pesan.gelembung.append(document.createElement('br'), ulang);
  }

  async function kirim(permintaan) {
    atur(true);
    var memuat = tambah('memuat', 'Mencari di knowledge base…');
    var kontrol = new AbortController();
    var timer = setTimeout(function () { kontrol.abort(); }, CFG.BATAS_WAKTU_MS || 60000);
    try {
      var res = await fetch(CFG.N8N_WEBHOOK_URL + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permintaan),
        signal: kontrol.signal,
      });
      var hasil = await res.json().catch(function () { return {}; });
      memuat.baris.remove();
      if (res.ok && hasil.status === 'ok') {
        var pesan = tambah('agent', hasil.jawaban);
        meta(pesan, hasil);
      } else if (hasil.status === 'ditolak') {
        tambah('gagal', hasil.pesan || 'Permintaan tidak valid.');
      } else {
        tampilkanGagal(permintaan, hasil.pesan || '');
      }
    } catch (err) {
      memuat.baris.remove();
      tampilkanGagal(permintaan, err.name === 'AbortError' ? 'Waktu tunggu habis.' : 'Layanan tidak dapat dihubungi saat ini.');
    } finally {
      clearTimeout(timer);
      atur(false);
      input.focus();
    }
  }

  function kirimPertanyaan(teks) {
    if (sibuk || !perusahaan) return;
    var id = window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    tambah('pengguna', teks);
    tampilkanSaran(false);
    kirim({ id_permintaan: 'tanya-' + id, prospek: perusahaan, pertanyaan: teks });
  }

  function tanggapiMasukan(teks) {
    if (!perusahaan) {
      var nama = teks.replace(/\s+/g, ' ').trim();
      if (nama.length > 100) { tambah('gagal', 'Nama perusahaan maksimal 100 karakter.'); return; }
      perusahaan = nama;
      tambah('pengguna', nama);
      ganti.hidden = false;
      sub.textContent = nama;
      input.placeholder = 'Tulis pertanyaan Anda';
      tambah('agent', 'Terima kasih, ' + nama + '. Silakan tanyakan seputar pendaftaran, atau pilih pertanyaan di bawah.');
      tampilkanSaran(true);
      return;
    }
    kirimPertanyaan(teks);
  }

  function tampil(terbuka) {
    panel.hidden = !terbuka;
    buka.setAttribute('aria-expanded', String(terbuka));
    if (terbuka) {
      if (!sudahSapa) sapa();
      input.focus();
    } else {
      buka.focus();
    }
  }

  buka.addEventListener('click', function () { tampil(panel.hidden); });
  $('asisten-tutup').addEventListener('click', function () { tampil(false); });
  ganti.addEventListener('click', function () { if (!sibuk) tanyaNama(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) tampil(false); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sibuk) return;
    var teks = input.value.trim();
    if (!teks) return input.focus();
    input.value = '';
    tanggapiMasukan(teks);
  });

  // Tombol "Daftar Sekarang" memakai tautan #daftar biasa; asisten tidak menyentuh formulir.
})();
