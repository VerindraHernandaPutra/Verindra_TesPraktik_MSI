// SIMULASI MSI — konfigurasi halaman web. Tidak berisi kredensial apa pun.
// Halaman harus dibuka dari http://localhost:8000 (origin yang diizinkan webhook, WEB_ORIGIN di .env).
window.CONFIG = {
  // Alamat dasar webhook n8n (production URL)
  N8N_WEBHOOK_URL: 'http://localhost:5678/webhook',
  // Batas waktu menunggu jawaban agent, dalam milidetik
  BATAS_WAKTU_MS: 60000,
  // Daftar prospek untuk pemilih perusahaan (data seed P01–P10, Section 9).
  // Akan diganti data langsung dari GET /panel setelah BL-14.
  PROSPEK: [
    { id: 'P01', nama: 'PT Simulasi Surya Reka' },
    { id: 'P02', nama: 'PT Simulasi Laut Biru' },
    { id: 'P03', nama: 'PT Simulasi Tani Makmur' },
    { id: 'P04', nama: 'PT Simulasi Bina Dana' },
    { id: 'P05', nama: 'PT Simulasi Mitra Sehat' },
    { id: 'P06', nama: 'PT Simulasi Digital Karya' },
    { id: 'P07', nama: 'PT Simulasi Tirta Lestari' },
    { id: 'P08', nama: 'PT Simulasi Daya Hijau' },
    { id: 'P09', nama: 'PT Simulasi Niaga Sentosa' },
    { id: 'P10', nama: 'PT Simulasi Cipta Sarana' },
  ],
};
