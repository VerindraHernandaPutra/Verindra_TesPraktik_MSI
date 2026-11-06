"""Merakit workflow n8n (SIMULASI MSI) dari sumber di repo.

Sumber:
  n8n/prompts/        system prompt dan skema JSON
  n8n/code/           isi Code node (file .js biasa, bisa diuji terpisah)
  .env                ID spreadsheet, nama model, alamat Ollama, origin halaman web

Keluaran:
  n8n/workflows/WF-01_agent_chat.json         siap dipasang dengan deploy_workflows.py
  n8n/workflows/WF-05_penanganan_error.json   error workflow untuk WF-01 (Log_Error)

Rujukan antar-workflow ditulis sebagai "@WF:<nama workflow>"; deploy_workflows.py menggantinya dengan ID asli.

Jalankan dari akar repo:  python scripts/build_workflows.py
Kredensial TIDAK ditulis ke file; dipilih di n8n atau diwarisi saat deploy.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.parse
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAMESPACE = uuid.UUID("6f1c2b6e-4d1a-4f43-9a52-5d0c3e7b9a10")

ENV_WAJIB = ["GOOGLE_SHEET_ID", "CLAUDE_MODEL", "OLLAMA_MODEL", "OLLAMA_BASE_URL", "WEB_ORIGIN"]

# Sheet yang dibaca WF-01 dalam satu panggilan spreadsheets.get (Section 9)
SHEET_WF01 = ["Konfigurasi", "KB", "Prospek", "Histori", "Percakapan", "Antrean_Staf", "Draf"]

SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets/"
CLAUDE_API = "https://api.anthropic.com/v1/messages"


# ---------- utilitas ----------

def baca_env() -> dict[str, str]:
    path = ROOT / ".env"
    if not path.exists():
        sys.exit("File .env tidak ditemukan. Salin .env.example menjadi .env lalu isi nilainya.")
    env: dict[str, str] = {}
    for baris in path.read_text(encoding="utf-8").splitlines():
        baris = baris.strip()
        if not baris or baris.startswith("#") or "=" not in baris:
            continue
        kunci, nilai = baris.split("=", 1)
        env[kunci.strip()] = nilai.strip()
    kosong = [k for k in ENV_WAJIB if not env.get(k)]
    if kosong:
        sys.exit("Nilai berikut belum diisi di .env: " + ", ".join(kosong))
    return env


def teks(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def gabung(*rel: str) -> str:
    return "\n".join(teks(r) for r in rel)


def isi_penanda(kode: str, nilai: dict[str, object]) -> str:
    for nama, isi in nilai.items():
        penanda = f"/*@{nama}*/ null"
        if penanda not in kode:
            sys.exit(f"Penanda {penanda} tidak ditemukan di kode.")
        kode = kode.replace(penanda, json.dumps(isi, ensure_ascii=False, indent=2))
    sisa = re.findall(r"/\*@\w+\*/", kode)
    if sisa:
        sys.exit("Penanda belum terisi: " + ", ".join(sisa))
    return kode


_AWALAN_ID = ["WF-01"]  # diganti saat membangun workflow lain agar ID node unik per workflow


def node_id(nama: str) -> str:
    return str(uuid.uuid5(NAMESPACE, _AWALAN_ID[0] + "/" + nama))


# ---------- pembuat node ----------

def node(nama: str, tipe: str, versi: float, posisi: tuple[int, int], parameter: dict, catatan: str, **lain) -> dict:
    hasil = {
        "parameters": parameter,
        "id": node_id(nama),
        "name": nama,
        "type": tipe,
        "typeVersion": versi,
        "position": list(posisi),
        "notes": catatan,
    }
    hasil.update(lain)
    return hasil


def code_node(
    nama: str, posisi: tuple[int, int], kode: str, catatan: str, on_error: str | None = "continueErrorOutput"
) -> dict:
    """on_error: continueErrorOutput (keluaran ke-2 = jalur gagal), continueRegularOutput, atau None."""
    lain = {"onError": on_error} if on_error else {}
    return node(nama, "n8n-nodes-base.code", 2, posisi, {"jsCode": kode}, catatan, **lain)


def if_benar(nama: str, posisi: tuple[int, int], ekspresi: str, catatan: str) -> dict:
    """IF yang lolos (keluaran 0) bila ekspresi bernilai boolean true."""
    return if_node(nama, posisi, ekspresi, {"type": "boolean", "operation": "true", "singleValue": True}, "", catatan)


def if_node(nama: str, posisi: tuple[int, int], kiri: str, operator: dict, kanan, catatan: str) -> dict:
    return node(
        nama,
        "n8n-nodes-base.if",
        2.2,
        posisi,
        {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                "conditions": [
                    {"id": node_id(nama + "/kondisi"), "leftValue": kiri, "rightValue": kanan, "operator": operator}
                ],
                "combinator": "and",
            },
            "options": {},
        },
        catatan,
    )


def respond(nama: str, posisi: tuple[int, int], kode_http: int, body_expr: str, catatan: str) -> dict:
    return node(
        nama,
        "n8n-nodes-base.respondToWebhook",
        1.4,
        posisi,
        {"respondWith": "json", "responseBody": body_expr, "options": {"responseCode": kode_http}},
        catatan,
    )


def http(
    nama: str,
    posisi: tuple[int, int],
    metode: str,
    url: str,
    catatan: str,
    kredensial: str | None = None,
    body_expr: str | None = None,
    header: dict[str, str] | None = None,
    timeout: int = 30000,
    on_error: str = "continueErrorOutput",
) -> dict:
    parameter: dict = {"method": metode, "url": url, "options": {"timeout": timeout}}
    if kredensial:
        parameter.update({"authentication": "predefinedCredentialType", "nodeCredentialType": kredensial})
    if header:
        parameter.update(
            {"sendHeaders": True, "headerParameters": {"parameters": [{"name": k, "value": v} for k, v in header.items()]}}
        )
    if body_expr:
        parameter.update({"sendBody": True, "specifyBody": "json", "jsonBody": body_expr})
    return node(nama, "n8n-nodes-base.httpRequest", 4.2, posisi, parameter, catatan, onError=on_error)


def panggil_claude(nama: str, posisi: tuple[int, int], catatan: str) -> dict:
    return http(
        nama,
        posisi,
        "POST",
        CLAUDE_API,
        catatan,
        kredensial="anthropicApi",
        body_expr="={{ JSON.stringify($json.body_model) }}",
        header={"anthropic-version": "2026-10-21"},
    )


def panggil_ollama(nama: str, posisi: tuple[int, int], env: dict[str, str], catatan: str) -> dict:
    return http(
        nama,
        posisi,
        "POST",
        env["OLLAMA_BASE_URL"].rstrip("/") + "/api/chat",
        catatan,
        body_expr="={{ JSON.stringify($json.body_model) }}",
        timeout=120000,
    )


def hubung(*pasangan: tuple[str, int, str]) -> dict:
    """pasangan: (node asal, indeks keluaran, node tujuan)."""
    koneksi: dict[str, dict] = {}
    for asal, keluaran, tujuan in pasangan:
        main = koneksi.setdefault(asal, {"main": []})["main"]
        while len(main) <= keluaran:
            main.append([])
        main[keluaran].append({"node": tujuan, "type": "main", "index": 0})
    return koneksi


def jalur_log(sid: str, x: int, y: int, kode_siapkan: str, catatan_siapkan: str) -> list[dict]:
    """Siapkan Log Error > Baca Log Error > Susun Baris Log > Catat Log Error.
    Semua memakai continueRegularOutput: kegagalan mencatat log tidak menghentikan respons gagal."""
    url_baca = SHEETS_API + sid + "/values/" + urllib.parse.quote("Log_Error!A:F")
    url_append = (
        SHEETS_API + sid + "/values/" + urllib.parse.quote("Log_Error!A1")
        + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS"
    )
    kode_susun = isi_penanda(
        gabung("n8n/code/log_error.js", "n8n/code/susun_baris_log.js"), {"NODE_SUMBER": "Siapkan Log Error"}
    )
    return [
        code_node("Siapkan Log Error", (x, y), kode_siapkan, catatan_siapkan, on_error="continueRegularOutput"),
        http("Baca Log Error", (x + 220, y), "GET", url_baca, "Nomor id_error berikutnya dan urutan kolom.",
             kredensial="googleSheetsOAuth2Api", on_error="continueRegularOutput"),
        code_node("Susun Baris Log", (x + 440, y), kode_susun,
                  "Section 9: data_masukan tanpa kredensial (pola kunci disamarkan). Sumber: n8n/code/log_error.js",
                  on_error="continueRegularOutput"),
        http("Catat Log Error", (x + 660, y), "POST", url_append, "Menambah satu baris ke sheet Log_Error.",
             kredensial="googleSheetsOAuth2Api", body_expr="={{ JSON.stringify($json.body_append) }}",
             on_error="continueRegularOutput"),
    ]


# ---------- WF-01 ----------

def bangun_wf01(env: dict[str, str]) -> dict:
    _AWALAN_ID[0] = "WF-01"
    sid = env["GOOGLE_SHEET_ID"]
    cfg = {"model_claude": env["CLAUDE_MODEL"], "model_ollama": env["OLLAMA_MODEL"]}

    url_baca = (
        SHEETS_API
        + sid
        + "?"
        + urllib.parse.urlencode(
            [("includeGridData", "true")]
            + [("ranges", s) for s in SHEET_WF01]
            + [("fields", "sheets(properties(sheetId,title),data(rowData(values(formattedValue))))")]
        )
    )
    url_tulis = SHEETS_API + sid + ":batchUpdate"

    kode_susun = isi_penanda(
        teks("n8n/code/wf01/susun_prompt.js"),
        {
            "PROMPT_AGENT": teks("n8n/prompts/agent_system.md"),
            "SKEMA_JAWABAN": json.loads(teks("n8n/prompts/skema_jawaban.json")),
            "CFG": cfg,
        },
    )
    kode_susun_draf = isi_penanda(
        teks("n8n/code/wf01/susun_prompt_draf.js"),
        {
            "PROMPT_DRAF": teks("n8n/prompts/draf_followup.md"),
            "SKEMA_DRAF": json.loads(teks("n8n/prompts/skema_draf.json")),
            "CFG": cfg,
        },
    )
    ambil = teks("n8n/code/wf01/ambil_teks_model.js")

    body_tolak = "={{ JSON.stringify({ status: 'ditolak', pesan: $json.pesan }) }}"
    body_gagal = (
        "={{ JSON.stringify({ status: 'gagal', "
        "pesan: 'Layanan sedang bermasalah, jawaban tidak dapat diproses. Silakan coba ulang.', "
        "id_permintaan: $('Validasi Masukan').first().json.id_permintaan }) }}"
    )

    y, ya, yb = 300, 120, 480  # baris utama, cabang atas, cabang bawah
    nodes = [
        node(
            "Terima Pertanyaan",
            "n8n-nodes-base.webhook",
            2.1,
            (0, y),
            {
                "httpMethod": "POST",
                "path": "chat",
                "responseMode": "responseNode",
                "options": {"allowedOrigins": env["WEB_ORIGIN"]},
            },
            "Langkah 1. POST /chat (kontrak Section 10). Hanya origin halaman web lokal yang diizinkan.",
            webhookId=node_id("webhook/chat"),
        ),
        code_node("Validasi Masukan", (220, y), teks("n8n/code/wf01/validasi_masukan.js"),
                  "FR-01. Sumber: n8n/code/wf01/validasi_masukan.js", on_error="continueRegularOutput"),
        if_benar("Cek Masukan", (440, y), "={{ $json.valid }}", "Pertanyaan atau identitas kosong ditolak (400)."),
        http("Baca Semua Sheet", (660, y), "GET", url_baca,
             "Langkah 2. Tujuh sheet dalam SATU panggilan spreadsheets.get. Kredensial: Google Sheets (demo).",
             kredensial="googleSheetsOAuth2Api"),
        code_node("Olah Data Sheet", (880, y), teks("n8n/code/wf01/olah_data_sheet.js"),
                  "Baris sheet menjadi objek per kolom; menyimpan header dan sheetId. Sumber: wf01/olah_data_sheet.js"),
        code_node("Cek Permintaan Lama", (1100, y), teks("n8n/code/wf01/cek_permintaan_lama.js"),
                  "FR-16. id_permintaan yang sudah tercatat: kembalikan hasil lama, tanpa model dan tanpa menulis."),
        if_benar("Permintaan Lama?", (1320, y), "={{ $json.lama }}", "True: kirim jawaban yang sudah tersimpan."),
        respond("Kirim Jawaban Lama", (1540, yb + 160), 200, "={{ JSON.stringify($json.respons) }}",
                "Permintaan berulang (idempoten, NFR-04)."),
        code_node("Cari Prospek", (1540, y),
                  gabung("n8n/code/normalisasi_kunci.js", "n8n/code/wf01/cari_prospek.js"),
                  "FR-08. Cari per id_prospek atau kunci_normal; belum menulis."),
        if_benar("Prospek Valid", (1760, y), "={{ $json.valid }}",
                 "ID tak dikenal atau nama kosong ditolak sebelum memanggil model."),
        respond("Kirim Penolakan", (1980, yb + 160), 400, body_tolak, "Masukan atau identitas prospek tidak valid."),
        code_node("Susun Prompt", (1980, y), kode_susun,
                  "Langkah 3. FR-02, FR-03, FR-18. Sumber: wf01/susun_prompt.js + n8n/prompts/"),
        if_node("Pilih Model", (2200, y), "={{ $json.model_ai }}", {"type": "string", "operation": "equals"},
                "ollama", "KA-01. MODEL_AI = ollama ke Ollama lokal, selain itu ke Claude."),
        panggil_ollama("Panggil Ollama", (2420, ya), env, "Langkah 3 (cadangan). Ollama lokal."),
        panggil_claude("Panggil Claude", (2420, y + 60),
                       "Langkah 3. Kredensial: Claude API (demo). Structured outputs (AR-06)."),
        code_node("Ambil Teks Model", (2640, y), isi_penanda(ambil, {"NODE_KONTEKS": "Susun Prompt"}),
                  "Menyamakan respons Claude dan Ollama."),
        code_node("Periksa Jawaban", (2860, y),
                  gabung("n8n/code/pemeriksa_jawaban.js", "n8n/code/wf01/periksa_jawaban.js"),
                  "Langkah 4. FR-05, PJ-01–PJ-04."),
        if_benar("Perlu Draf?", (3080, y),
                 "={{ !($json.topik.length === 1 && $json.topik[0] === 'sapaan') }}",
                 "Draf follow-up untuk semua percakapan kecuali sapaan."),
        code_node("Susun Prompt Draf", (3300, ya), kode_susun_draf,
                  "FR-13, AR-08. Sumber: wf01/susun_prompt_draf.js + n8n/prompts/draf_followup.md"),
        if_node("Pilih Model Draf", (3520, ya), "={{ $json.model_ai }}", {"type": "string", "operation": "equals"},
                "ollama", "KA-01 untuk draf."),
        panggil_ollama("Panggil Ollama (Draf)", (3740, ya - 100), env, "Draf lewat Ollama lokal."),
        panggil_claude("Panggil Claude (Draf)", (3740, ya + 60), "Draf lewat Claude. Kredensial: Claude API (demo)."),
        code_node("Ambil Teks Draf", (3960, ya), isi_penanda(ambil, {"NODE_KONTEKS": "Susun Prompt Draf"}),
                  "Menyamakan respons Claude dan Ollama untuk draf."),
        code_node("Periksa Draf", (4180, ya),
                  gabung("n8n/code/pemeriksa_jawaban.js", "n8n/code/wf01/periksa_draf.js"),
                  "PJ-01–PJ-04 untuk draf; pelanggaran diganti template aman dan dicatat."),
        code_node("Cek Mode Gagal", (4400, y), teks("n8n/code/wf01/cek_mode_gagal.js"),
                  "FR-17. MODE_GAGAL = TRUE memicu error buatan tepat sebelum langkah tulis (T-19)."),
        code_node("Siapkan Penulisan", (4620, y), teks("n8n/code/wf01/siapkan_penulisan.js"),
                  "Langkah 5–8: Prospek, Histori, Percakapan, Antrean_Staf, Draf disusun jadi satu batchUpdate."),
        http("Tulis Semua Sheet", (4840, y), "POST", url_tulis,
             "Langkah 5–8. SATU spreadsheets.batchUpdate, diterapkan atomik oleh Google (semua atau tidak sama sekali).",
             kredensial="googleSheetsOAuth2Api", body_expr="={{ JSON.stringify($json.body_tulis) }}"),
        respond("Kirim Jawaban", (5060, y), 200, "={{ JSON.stringify($('Siapkan Penulisan').first().json.respons) }}",
                "Langkah 9. Kolom kontrak POST /chat."),
        *jalur_log(sid, 2420, yb + 320, teks("n8n/code/wf01/siapkan_log_error.js"),
                   "FR-16. Menerima error dari node mana pun; mencatat node asal ($prevNode) dan pesannya."),
        respond("Kirim Respons Gagal", (3300, yb + 320), 502, body_gagal,
                "G5: halaman menerima status gagal, bukan sukses; tidak ada data yang setengah tertulis."),
    ]

    gagal = "Siapkan Log Error"
    connections = hubung(
        ("Terima Pertanyaan", 0, "Validasi Masukan"),
        ("Validasi Masukan", 0, "Cek Masukan"),
        ("Cek Masukan", 0, "Baca Semua Sheet"),
        ("Cek Masukan", 1, "Kirim Penolakan"),
        ("Baca Semua Sheet", 0, "Olah Data Sheet"),
        ("Baca Semua Sheet", 1, gagal),
        ("Olah Data Sheet", 0, "Cek Permintaan Lama"),
        ("Cek Permintaan Lama", 0, "Permintaan Lama?"),
        ("Permintaan Lama?", 0, "Kirim Jawaban Lama"),
        ("Permintaan Lama?", 1, "Cari Prospek"),
        ("Cari Prospek", 0, "Prospek Valid"),
        ("Prospek Valid", 0, "Susun Prompt"),
        ("Prospek Valid", 1, "Kirim Penolakan"),
        ("Susun Prompt", 0, "Pilih Model"),
        ("Pilih Model", 0, "Panggil Ollama"),
        ("Pilih Model", 1, "Panggil Claude"),
        ("Panggil Ollama", 0, "Ambil Teks Model"),
        ("Panggil Ollama", 1, gagal),
        ("Panggil Claude", 0, "Ambil Teks Model"),
        ("Panggil Claude", 1, gagal),
        ("Ambil Teks Model", 0, "Periksa Jawaban"),
        ("Periksa Jawaban", 0, "Perlu Draf?"),
        ("Perlu Draf?", 0, "Susun Prompt Draf"),
        ("Perlu Draf?", 1, "Cek Mode Gagal"),
        ("Susun Prompt Draf", 0, "Pilih Model Draf"),
        ("Pilih Model Draf", 0, "Panggil Ollama (Draf)"),
        ("Pilih Model Draf", 1, "Panggil Claude (Draf)"),
        ("Panggil Ollama (Draf)", 0, "Ambil Teks Draf"),
        ("Panggil Ollama (Draf)", 1, gagal),
        ("Panggil Claude (Draf)", 0, "Ambil Teks Draf"),
        ("Panggil Claude (Draf)", 1, gagal),
        ("Ambil Teks Draf", 0, "Periksa Draf"),
        ("Periksa Draf", 0, "Cek Mode Gagal"),
        ("Cek Mode Gagal", 0, "Siapkan Penulisan"),
        ("Siapkan Penulisan", 0, "Tulis Semua Sheet"),
        ("Tulis Semua Sheet", 0, "Kirim Jawaban"),
        ("Tulis Semua Sheet", 1, gagal),
        # keluaran error setiap Code node di jalur utama
        *[(n, 1, gagal) for n in (
            "Olah Data Sheet", "Cek Permintaan Lama", "Cari Prospek", "Susun Prompt", "Ambil Teks Model",
            "Periksa Jawaban", "Susun Prompt Draf", "Ambil Teks Draf", "Periksa Draf", "Cek Mode Gagal",
            "Siapkan Penulisan",
        )],
        # jalur pencatatan, lalu respons gagal
        ("Siapkan Log Error", 0, "Baca Log Error"),
        ("Baca Log Error", 0, "Susun Baris Log"),
        ("Susun Baris Log", 0, "Catat Log Error"),
        ("Catat Log Error", 0, "Kirim Respons Gagal"),
    )

    return {
        "name": "WF-01 Agent chat",
        "nodes": nodes,
        "connections": connections,
        "settings": {"executionOrder": "v1", "errorWorkflow": "@WF:WF-05 Penanganan error"},
        "pinData": {},
        "active": False,
    }


# ---------- WF-05 ----------

def bangun_wf05(env: dict[str, str]) -> dict:
    _AWALAN_ID[0] = "WF-05"
    nodes = [
        node("Terima Error", "n8n-nodes-base.errorTrigger", 1, (0, 300), {},
             "Error Trigger: dijalankan n8n saat workflow yang memasang WF-05 sebagai error workflow gagal."),
        *jalur_log(env["GOOGLE_SHEET_ID"], 220, 300, teks("n8n/code/wf05/siapkan_log_wf05.js"),
                   "FR-16. Jaring pengaman untuk kegagalan yang tidak tertangkap jalur gagal di WF-01."),
    ]
    connections = hubung(
        ("Terima Error", 0, "Siapkan Log Error"),
        ("Siapkan Log Error", 0, "Baca Log Error"),
        ("Baca Log Error", 0, "Susun Baris Log"),
        ("Susun Baris Log", 0, "Catat Log Error"),
    )
    return {
        "name": "WF-05 Penanganan error",
        "nodes": nodes,
        "connections": connections,
        "settings": {"executionOrder": "v1"},
        "pinData": {},
        "active": False,
    }


def main() -> None:
    env = baca_env()
    for nama_file, pembangun in (("WF-01_agent_chat.json", bangun_wf01), ("WF-05_penanganan_error.json", bangun_wf05)):
        keluaran = ROOT / "n8n/workflows" / nama_file
        wf = pembangun(env)
        keluaran.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Ditulis: {keluaran.relative_to(ROOT)} ({len(wf['nodes'])} node)")


if __name__ == "__main__":
    main()
