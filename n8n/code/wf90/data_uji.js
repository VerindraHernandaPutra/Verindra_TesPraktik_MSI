// WF-90 node "Validasi Data Uji" dan "Susun Data Uji" (GET /uji/data, utilitas run_tests.py).
// Mengembalikan isi semua sheet (data SIMULASI) agar uji bisa memeriksa baris yang tertulis.
// BAGIAN diisi saat dirakit: "validasi" atau "susun".
const BAGIAN = /*@BAGIAN*/ null;
if (BAGIAN === 'validasi') return [{ json: { valid: true } }];
return [{ json: { status: 'ok', tabel: $('Olah Sheet Data Uji').first().json.tabel } }];
