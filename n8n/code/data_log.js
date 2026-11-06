// Langkah "Data Log" pada node Catat Gagal (WF-01 sampai WF-04, WF-90). Mode: Run Once for All Items.
// Mengambil baris Log_Error dari data sheet yang SUDAH dibaca di awal workflow, untuk nomor id_error berikutnya,
// sehingga jalur gagal tidak perlu membaca sheet lagi. Bila pembacaan awal itu sendiri yang gagal,
// daftar kosong dipakai (id_error mulai dari E0001; batasan yang diketahui).
// NODE_DATA diisi saat dirakit: langkah yang memuat {tabel, header} hasil "Olah Data Sheet".
const NODE_DATA = /*@NODE_DATA*/ null;

let values = [];
try {
  const D = $(NODE_DATA).first().json;
  const kolom = D.header.Log_Error || [];
  values = [kolom, ...(D.tabel.Log_Error || []).map((r) => kolom.map((k) => r[k] ?? ''))];
} catch (e) {
  values = [];
}
return [{ json: { values } }];
