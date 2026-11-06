# Prompt (SIMULASI)

| File | Dipakai di | Memenuhi |
| --- | --- | --- |
| `agent_system.md` | WF-01, panggilan model pertama (jawaban agent) | AR-01–AR-07, FR-02, FR-03, FR-04 |
| `draf_followup.md` | WF-01, panggilan model kedua (draf follow-up) | AR-08, FR-13 |

Temperature model: 0–0,2 (NFR-07).

## Penanda yang diganti workflow

Penanda memakai `[[ ]]`, bukan `{{ }}`, karena `{{ }}` adalah sintaks ekspresi n8n.

| Penanda | Diisi dengan |
| --- | --- |
| `[[DAFTAR_KB]]` | Baris sheet KB dengan `aktif = TRUE`, satu baris per butir, format: `- KB01 \| Jawab penuh \| Biaya pendaftaran \| Pendaftaran tes tidak berbiaya` |
| `[[DATA_PROSPEK]]` | `nama_perusahaan`, `sektor`, `kebutuhan` (beserta `status_kebutuhan`) dari sheet Prospek |
| `[[PERCAKAPAN]]` | Pertanyaan pengguna, jawaban agent, rujukan KB, dan status eskalasi dari panggilan pertama |

KB dibaca ulang dari sheet setiap permintaan (FR-18), jadi perubahan isi KB langsung dipakai tanpa mengubah prompt.
