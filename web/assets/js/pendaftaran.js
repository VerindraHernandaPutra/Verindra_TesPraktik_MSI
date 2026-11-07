// Formulir pendaftaran peserta (EB-04, E-01): menyambungkan form ke POST /pendaftaran.
// Kontrak: docs/PERENCANAAN.md Section 10. Alamat n8n dibaca dari web/config.js (window.CONFIG).
// Halaman harus dibuka dari http://localhost:8000 (origin yang diizinkan webhook).
(function () {
  'use strict';

  var CFG = window.CONFIG || {};
  var POLA_HP = /^08120000\d{4}$/; // hanya nomor dummy 0812-0000-xxxx; server memeriksa ulang
  var form = document.getElementById('form-daftar');
  if (!form) return;

  var tombolKirim = document.getElementById('kirim-daftar');
  var tombolUlang = document.getElementById('coba-ulang');
  var hasil = document.getElementById('hasil-daftar');
  // id_permintaan dipertahankan sampai pendaftaran berhasil, sehingga Coba ulang tidak menggandakan data.
  var idPermintaan = null;

  function idBaru() {
    var acak = window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2, 10);
    return 'daftar-' + acak;
  }

  function nilai(id) {
    return form.elements[id].value.replace(/\s+/g, ' ').trim();
  }

  function tampilkan(jenis, judul, isi) {
    hasil.textContent = '';
    var kotak = document.createElement('div');
    kotak.className = 'alert alert-' + jenis + ' mb-0';
    if (judul) {
      var b = document.createElement('strong');
      b.textContent = judul + ' ';
      kotak.appendChild(b);
    }
    kotak.appendChild(document.createTextNode(isi));
    hasil.appendChild(kotak);
    return kotak;
  }

  function tambahBaris(kotak, teks) {
    var p = document.createElement('div');
    p.className = 'mt-2';
    p.textContent = teks;
    kotak.appendChild(p);
  }

  function periksa() {
    var pesan = [];
    if (!nilai('nama_perusahaan')) pesan.push('Nama perusahaan wajib diisi.');
    if (!nilai('sektor')) pesan.push('Sektor wajib diisi.');
    if (!form.elements.kategori.value) pesan.push('Pilih kategori ajang.');
    if (!nilai('nama_pic')) pesan.push('Nama PIC wajib diisi.');
    if (!POLA_HP.test(nilai('no_hp_pic').replace(/[\s-]/g, ''))) {
      pesan.push('Nomor HP PIC tidak valid. Gunakan format 0812-0000-xxxx.');
    }
    if (!form.elements.setuju_simulasi.checked) pesan.push('Centang persetujuan ketentuan pendaftaran untuk melanjutkan.');
    return pesan;
  }

  function atur(sedangKirim) {
    tombolKirim.disabled = sedangKirim;
    tombolUlang.disabled = sedangKirim;
    tombolKirim.textContent = sedangKirim ? 'Mengirim…' : 'Daftar Sekarang';
  }

  function tampilkanChat(kotak, chat) {
    if (!chat) return;
    if (chat.status === 'ok') {
      tambahBaris(kotak, 'Jawaban atas pertanyaan awal Anda: ' + chat.jawaban);
      if (chat.rujukan_kb && chat.rujukan_kb.length) tambahBaris(kotak, 'Sumber: ' + chat.rujukan_kb.join(', '));
      if (chat.eskalasi) tambahBaris(kotak, 'Pertanyaan ini diteruskan ke staf.');
    } else {
      tambahBaris(kotak, chat.pesan || 'Pertanyaan awal belum terjawab. Silakan tanyakan lagi lewat aplikasi chat.');
    }
  }

  async function kirim() {
    var pesan = periksa();
    if (pesan.length) {
      tampilkan('danger', 'Data belum lengkap.', pesan.join(' '));
      tombolUlang.classList.add('d-none');
      return;
    }
    if (!idPermintaan) idPermintaan = idBaru();
    var badan = {
      id_permintaan: idPermintaan,
      nama_perusahaan: nilai('nama_perusahaan'),
      sektor: nilai('sektor'),
      nama_pic: nilai('nama_pic'),
      no_hp_pic: nilai('no_hp_pic'),
      kategori: form.elements.kategori.value,
      pertanyaan: form.elements.pertanyaan.value.trim(),
      setuju_simulasi: form.elements.setuju_simulasi.checked,
    };

    atur(true);
    tombolUlang.classList.add('d-none');
    tampilkan('info', '', 'Mengirim pendaftaran…');
    var kontrol = new AbortController();
    var batas = setTimeout(function () { kontrol.abort(); }, CFG.BATAS_WAKTU_MS || 60000);
    try {
      var res = await fetch(CFG.N8N_WEBHOOK_URL + '/pendaftaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(badan),
        signal: kontrol.signal,
      });
      var data = await res.json().catch(function () { return {}; });
      if (res.status === 400) {
        // Ditolak aturan: perbaiki isian, lalu kirim sebagai pendaftaran baru.
        idPermintaan = null;
        tampilkan('danger', 'Pendaftaran ditolak.', data.pesan || 'Periksa kembali isian Anda.');
      } else if (res.ok && data.status === 'ok') {
        var jenis = data.baru ? 'success' : 'info';
        var kotak = tampilkan(jenis, data.baru ? 'Pendaftaran tercatat.' : 'Sudah terdaftar.', data.pesan);
        if (data.berulang) tambahBaris(kotak, 'Ini hasil pendaftaran yang sudah tersimpan sebelumnya; tidak ada data ganda.');
        tampilkanChat(kotak, data.chat);
        idPermintaan = null;
        if (data.baru) form.reset();
        $('select').niceSelect('update');
      } else {
        throw new Error('gagal');
      }
    } catch (e) {
      tampilkan('danger', 'Gagal menyimpan, data tidak tercatat.', 'Layanan sedang bermasalah atau tidak terjangkau. Tekan Coba ulang; data tidak akan ganda.');
      tombolUlang.classList.remove('d-none');
    } finally {
      clearTimeout(batas);
      atur(false);
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    kirim();
  });
  tombolUlang.addEventListener('click', kirim);
})();
