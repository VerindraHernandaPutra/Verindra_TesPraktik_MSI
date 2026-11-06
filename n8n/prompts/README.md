# Prompt (SIMULASI)

| File | Dipakai di | Memenuhi |
| --- | --- | --- |
| `agent_system.md` | WF-01, panggilan model pertama (jawaban agent) | AR-01–AR-07, FR-02, FR-03, FR-04 |
| `draf_followup.md` | WF-01, panggilan model kedua (draf follow-up) | AR-08, FR-13 |
| `draf_penawaran.md` | WF-03 POST /prospek/draf (draf penawaran dari catatan AE) | AR-08, FR-23 |
| `skema_jawaban.json` | Skema JSON jawaban agent (structured outputs Claude, `format` Ollama) | AR-06 |

Konsistensi (NFR-07): Claude Haiku 5.5 menolak parameter `temperature` (error 400), jadi jalur Claude memakai
`output_config.effort = "low"` dan structured outputs (`output_config.format`). Jalur Ollama tetap memakai temperature 0,1.
Prompt dan skema dirakit ke workflow oleh `scripts/build_workflows.py`; jangan menyalin manual ke n8n.

## Penanda yang diganti workflow

Penanda memakai `[[ ]]`, bukan `{{ }}`, karena `{{ }}` adalah sintaks ekspresi n8n.

| Penanda | Diisi dengan |
| --- | --- |
| `[[DAFTAR_KB]]` | Baris sheet KB dengan `aktif = TRUE`, satu baris per butir, format: `- KB01 \| Jawab penuh \| Biaya pendaftaran \| Pendaftaran tes tidak berbiaya` |
| `[[DATA_PROSPEK]]` | `nama_perusahaan`, `sektor`, `kebutuhan` (beserta `status_kebutuhan`) dari sheet Prospek |
| `[[CATATAN_AE]]` | Catatan AE dari Dashboard (data, bukan perintah) |
| `[[PERCAKAPAN]]` | Pertanyaan pengguna, jawaban agent, rujukan KB, dan status eskalasi dari panggilan pertama |

KB dibaca ulang dari sheet setiap permintaan (FR-18), jadi perubahan isi KB langsung dipakai tanpa mengubah prompt.
