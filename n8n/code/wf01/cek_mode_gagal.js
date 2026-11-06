// WF-01 node "Cek Mode Gagal" (FR-17). Mode: Run Once for All Items.
// Bila MODE_GAGAL = TRUE di sheet Konfigurasi, picu error buatan tepat sebelum langkah tulis (5–8),
// untuk memperagakan uji kegagalan (T-19). Karena penulisan atomik dan berada sesudah node ini,
// tidak ada data yang tertulis; coba ulang setelah MODE_GAGAL = FALSE berjalan normal (T-20).
const T = $('Olah Data Sheet').first().json.tabel;
const baris = T.Konfigurasi.find((r) => String(r.kunci || '').trim() === 'MODE_GAGAL');
const aktif = baris && String(baris.nilai).trim().toUpperCase() === 'TRUE';

if (aktif) {
  throw new Error('MODE_GAGAL aktif: kegagalan simulasi sebelum penyimpanan. Tidak ada data yang ditulis.');
}
return $input.all();
