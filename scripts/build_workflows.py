"""Merakit workflow n8n (SIMULASI MSI) dari sumber di repo.

Sumber:
  n8n/prompts/        system prompt dan skema JSON
  n8n/code/           isi Code node (file .js biasa, bisa diuji terpisah)
  .env                ID spreadsheet, nama model, alamat Ollama, origin halaman web

Keluaran:
  n8n/workflows/WF-01_agent_chat.json         siap dipasang dengan deploy_workflows.py
  n8n/workflows/WF-05_penanganan_error.json   error workflow (Log_Error)
  n8n/workflows/WF-90_reset_seed.json         utilitas uji: tulis ulang sheet dari seed/

Rujukan antar-workflow ditulis sebagai "@WF:<nama workflow>"; deploy_workflows.py menggantinya dengan ID asli.

Jalankan dari akar repo:  python scripts/build_workflows.py
Kredensial TIDAK ditulis ke file; dipilih di n8n atau diwarisi saat deploy.
"""

from __future__ import annotations

import csv
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


def url_baca_sheet(sid: str, sheets: list[str]) -> str:
    """Satu panggilan spreadsheets.get untuk beberapa sheet sekaligus (nilai + sheetId)."""
    return (
        SHEETS_API
        + sid
        + "?"
        + urllib.parse.urlencode(
            [("includeGridData", "true")]
            + [("ranges", s) for s in sheets]
            + [("fields", "sheets(properties(sheetId,title),data(rowData(values(formattedValue))))")]
        )
    )


def kode_olah(sheets: list[str]) -> str:
    return isi_penanda(teks("n8n/code/olah_data_sheet.js"), {"SHEET_WAJIB": sheets})


def kode_siapkan_log(workflow: str, node_masukan: str) -> str:
    return isi_penanda(teks("n8n/code/siapkan_log_error.js"), {"WORKFLOW": workflow, "NODE_MASUKAN": node_masukan})


def jalur_log(
    sid: str, x: int, y: int, kode_siapkan: str, catatan_siapkan: str, akhiran: str = ""
) -> tuple[list[dict], list[tuple[str, int, str]]]:
    """Siapkan Log Error > Baca Log Error > Susun Baris Log > Catat Log Error (nama diberi akhiran bila perlu).
    Semua memakai continueRegularOutput: kegagalan mencatat log tidak menghentikan respons gagal.
    Mengembalikan (nodes, koneksi internal)."""
    n = {k: f"{k}{akhiran}" for k in ("Siapkan Log Error", "Baca Log Error", "Susun Baris Log", "Catat Log Error")}
    url_baca = SHEETS_API + sid + "/values/" + urllib.parse.quote("Log_Error!A:F")
    url_append = (
        SHEETS_API + sid + "/values/" + urllib.parse.quote("Log_Error!A1")
        + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS"
    )
    kode_susun = isi_penanda(
        gabung("n8n/code/log_error.js", "n8n/code/susun_baris_log.js"), {"NODE_SUMBER": n["Siapkan Log Error"]}
    )
    nodes = [
        code_node(n["Siapkan Log Error"], (x, y), kode_siapkan, catatan_siapkan, on_error="continueRegularOutput"),
        http(n["Baca Log Error"], (x + 220, y), "GET", url_baca, "Nomor id_error berikutnya dan urutan kolom.",
             kredensial="googleSheetsOAuth2Api", on_error="continueRegularOutput"),
        code_node(n["Susun Baris Log"], (x + 440, y), kode_susun,
                  "Section 9: data_masukan tanpa kredensial (pola kunci disamarkan). Sumber: n8n/code/log_error.js",
                  on_error="continueRegularOutput"),
        http(n["Catat Log Error"], (x + 660, y), "POST", url_append, "Menambah satu baris ke sheet Log_Error.",
             kredensial="googleSheetsOAuth2Api", body_expr="={{ JSON.stringify($json.body_append) }}",
             on_error="continueRegularOutput"),
    ]
    koneksi = [
        (n["Siapkan Log Error"], 0, n["Baca Log Error"]),
        (n["Baca Log Error"], 0, n["Susun Baris Log"]),
        (n["Susun Baris Log"], 0, n["Catat Log Error"]),
    ]
    return nodes, koneksi


BODY_GAGAL_UMUM = (
    "={{ JSON.stringify({ status: 'gagal', "
    "pesan: 'Layanan sedang bermasalah, permintaan tidak dapat diproses. Silakan coba ulang.' }) }}"
)


def rantai_endpoint(
    env: dict[str, str],
    *,
    y: int,
    akhiran: str,
    workflow: str,
    metode: str,
    path: str,
    kode_validasi: str,
    sheets: list[str],
    kode_proses: str,
    catatan_proses: str,
    tulis: bool,
    header_auth: bool = False,
) -> tuple[list[dict], list[tuple[str, int, str]]]:
    """Rantai satu endpoint: Terima > Validasi > Valid? > Baca Sheet > Olah Sheet > Proses > [Boleh? > Tulis] > Kirim.
    Penolakan aturan bisnis -> 400 'ditolak'; error apa pun -> Log_Error -> 502 'gagal'."""
    sid = env["GOOGLE_SHEET_ID"]
    n = {
        "terima": f"Terima {akhiran}",
        "validasi": f"Validasi {akhiran}",
        "valid": f"{akhiran} Valid?",
        "baca": f"Baca Sheet {akhiran}",
        "olah": f"Olah Sheet {akhiran}",
        "proses": f"Proses {akhiran}" if tulis else f"Susun {akhiran}",
        "boleh": f"{akhiran} Boleh?",
        "tulis": f"Tulis {akhiran}",
        "kirim": f"Kirim Hasil {akhiran}",
        "tolak": f"Kirim Penolakan {akhiran}",
        "gagal": f"Kirim Respons Gagal {akhiran}",
    }
    akhir = f" ({akhiran})"
    log_nodes, log_koneksi = jalur_log(sid, 660, y + 380, kode_siapkan_log(workflow, n["validasi"]),
                                       "Menerima error dari node mana pun di rantai ini.", akhiran=akhir)
    siap_log = f"Siapkan Log Error{akhir}"

    nodes = [
        node(n["terima"], "n8n-nodes-base.webhook", 2.1, (0, y),
             {"httpMethod": metode, "path": path, "responseMode": "responseNode", "authentication": "headerAuth",
              "options": {}} if header_auth else
             {"httpMethod": metode, "path": path, "responseMode": "responseNode",
              "options": {"allowedOrigins": env["WEB_ORIGIN"]}},
             f"{metode} /{path}. " + ("Utilitas uji: wajib header X-Reset-Token." if header_auth
                                     else "Kontrak Section 10; hanya origin halaman web lokal yang diizinkan."),
             webhookId=node_id("webhook/" + path)),
        code_node(n["validasi"], (220, y), kode_validasi, "Validasi masukan dan peran."),
        if_benar(n["valid"], (440, y), "={{ $json.valid }}", "Masukan tidak valid ditolak (400)."),
        http(n["baca"], (660, y), "GET", url_baca_sheet(sid, sheets),
             f"Sheet {', '.join(sheets)} dalam SATU panggilan spreadsheets.get.", kredensial="googleSheetsOAuth2Api"),
        code_node(n["olah"], (880, y), kode_olah(sheets), "Baris sheet menjadi objek per kolom (+ nomor baris)."),
        code_node(n["proses"], (1100, y), kode_proses, catatan_proses),
        respond(n["tolak"], (1540, y + 200), 400, "={{ JSON.stringify({ status: 'ditolak', pesan: $json.pesan }) }}",
                "Ditolak karena aturan (bukan kegagalan sistem)."),
        respond(n["gagal"], (1540, y + 380), 502, BODY_GAGAL_UMUM, "G5: kegagalan dilaporkan jujur."),
        *log_nodes,
    ]
    koneksi = [
        (n["terima"], 0, n["validasi"]),
        (n["validasi"], 0, n["valid"]),
        (n["valid"], 0, n["baca"]),
        (n["valid"], 1, n["tolak"]),
        (n["baca"], 0, n["olah"]),
        (n["olah"], 0, n["proses"]),
        *[(x, 1, siap_log) for x in (n["validasi"], n["baca"], n["olah"], n["proses"])],
        *log_koneksi,
        (f"Catat Log Error{akhir}", 0, n["gagal"]),
    ]
    if tulis:
        nodes += [
            if_benar(n["boleh"], (1320, y), "={{ $json.boleh }}", "False: aturan menolak (400)."),
            http(n["tulis"], (1540, y), "POST", SHEETS_API + sid + ":batchUpdate",
                 "SATU spreadsheets.batchUpdate: ubah sel + tambah Histori, atomik.",
                 kredensial="googleSheetsOAuth2Api", body_expr="={{ JSON.stringify($json.body_tulis) }}"),
            respond(n["kirim"], (1760, y), 200, "={{ JSON.stringify($('" + n["proses"] + "').first().json.respons) }}",
                    "Respons sukses sesuai kontrak."),
        ]
        koneksi += [
            (n["proses"], 0, n["boleh"]),
            (n["boleh"], 0, n["tulis"]),
            (n["boleh"], 1, n["tolak"]),
            (n["tulis"], 0, n["kirim"]),
            (n["tulis"], 1, siap_log),
        ]
    else:
        nodes.append(respond(n["kirim"], (1320, y), 200, "={{ JSON.stringify($json) }}", "Respons sesuai kontrak."))
        koneksi.append((n["proses"], 0, n["kirim"]))
    return nodes, koneksi


def workflow_dasar(nama: str, nodes: list[dict], koneksi: list[tuple[str, int, str]], error_wf: bool = True) -> dict:
    settings: dict = {"executionOrder": "v1"}
    if error_wf:
        settings["errorWorkflow"] = "@WF:WF-05 Penanganan error"
    return {"name": nama, "nodes": nodes, "connections": hubung(*koneksi), "settings": settings,
            "pinData": {}, "active": False}


# ---------- WF-01 ----------

def bangun_wf01(env: dict[str, str]) -> dict:
    _AWALAN_ID[0] = "WF-01"
    sid = env["GOOGLE_SHEET_ID"]
    cfg = {"model_claude": env["CLAUDE_MODEL"], "model_ollama": env["OLLAMA_MODEL"]}

    url_baca = url_baca_sheet(sid, SHEET_WF01)
    url_tulis = SHEETS_API + sid + ":batchUpdate"
    log_nodes, log_koneksi = jalur_log(
        sid, 2420, 800, kode_siapkan_log("WF-01 Agent chat", "Validasi Masukan"),
        "FR-16. Menerima error dari node mana pun; mencatat node asal ($prevNode) dan pesannya.",
    )

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
        code_node("Olah Data Sheet", (880, y), kode_olah(SHEET_WF01),
                  "Baris sheet menjadi objek per kolom; menyimpan header dan sheetId. Sumber: n8n/code/olah_data_sheet.js"),
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
                  isi_penanda(gabung("n8n/code/pemeriksa_jawaban.js", "n8n/code/periksa_draf.js"),
                              {"NODE_KB": "Susun Prompt"}),
                  "PJ-01–PJ-04 untuk draf; pelanggaran diganti template aman dan dicatat."),
        code_node("Cek Mode Gagal", (4400, y), teks("n8n/code/wf01/cek_mode_gagal.js"),
                  "FR-17. MODE_GAGAL = TRUE memicu error buatan tepat sebelum langkah tulis (T-19)."),
        code_node("Siapkan Penulisan", (4620, y),
                  gabung("n8n/code/sheet_tulis.js", "n8n/code/wf01/siapkan_penulisan.js"),
                  "Langkah 5–8: Prospek, Histori, Percakapan, Antrean_Staf, Draf disusun jadi satu batchUpdate."),
        http("Tulis Semua Sheet", (4840, y), "POST", url_tulis,
             "Langkah 5–8. SATU spreadsheets.batchUpdate, diterapkan atomik oleh Google (semua atau tidak sama sekali).",
             kredensial="googleSheetsOAuth2Api", body_expr="={{ JSON.stringify($json.body_tulis) }}"),
        respond("Kirim Jawaban", (5060, y), 200, "={{ JSON.stringify($('Siapkan Penulisan').first().json.respons) }}",
                "Langkah 9. Kolom kontrak POST /chat."),
        *log_nodes,
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
        *log_koneksi,
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


# ---------- WF-02 ----------

def bangun_wf02(env: dict[str, str]) -> dict:
    _AWALAN_ID[0] = "WF-02"
    nodes, koneksi = rantai_endpoint(
        env, y=300, akhiran="Panel", workflow="WF-02 Data panel", metode="GET", path="panel",
        kode_validasi=teks("n8n/code/wf02/validasi_peran.js"),
        sheets=["Konfigurasi", "Prospek", "Percakapan", "Antrean_Staf", "Draf", "Histori"],
        kode_proses=gabung("n8n/code/sheet_tulis.js", "n8n/code/wf02/susun_panel.js"),
        catatan_proses="FR-12, FR-15. Ringkasan per status dan per AE, antrean, draf, pengingat; tanpa nilai penjualan.",
        tulis=False,
    )
    return workflow_dasar("WF-02 Data panel", nodes, koneksi)


# ---------- WF-03 ----------

def bangun_wf03(env: dict[str, str]) -> dict:
    _AWALAN_ID[0] = "WF-03"
    n1, k1 = rantai_endpoint(
        env, y=300, akhiran="Keputusan", workflow="WF-03 Keputusan dan status", metode="POST", path="approve",
        kode_validasi=teks("n8n/code/wf03/validasi_keputusan.js"),
        sheets=["Draf", "Histori"],
        kode_proses=gabung("n8n/code/sheet_tulis.js", "n8n/code/wf03/proses_keputusan.js"),
        catatan_proses="FR-14, G4. Setuju/tolak hanya dari Menunggu persetujuan; Siap kirim hanya dari Disetujui.",
        tulis=True,
    )
    n2, k2 = rantai_endpoint(
        env, y=1100, akhiran="Status", workflow="WF-03 Keputusan dan status", metode="POST", path="prospek/status",
        kode_validasi=gabung("n8n/code/sheet_tulis.js", "n8n/code/wf03/validasi_status.js"),
        sheets=["Prospek", "Histori"],
        kode_proses=gabung("n8n/code/sheet_tulis.js", "n8n/code/wf03/proses_status.js"),
        catatan_proses="FR-09. AE hanya prospek miliknya; Histori ubah_status (aktor, status lama, status baru).",
        tulis=True,
    )
    n3, k3 = rantai_draf_penawaran(env, y=1900)
    return workflow_dasar("WF-03 Keputusan dan status", n1 + n2 + n3, k1 + k2 + k3)


def rantai_draf_penawaran(env: dict[str, str], y: int) -> tuple[list[dict], list[tuple[str, int, str]]]:
    """POST /prospek/draf (FR-23): catatan AE > draf penawaran AI > pemeriksa > Draf + Histori (atomik)."""
    sid = env["GOOGLE_SHEET_ID"]
    cfg = {"model_claude": env["CLAUDE_MODEL"], "model_ollama": env["OLLAMA_MODEL"]}
    sheets = ["Konfigurasi", "KB", "Prospek", "Draf", "Histori"]
    kode_susun = isi_penanda(
        gabung("n8n/code/sheet_tulis.js", "n8n/code/wf03/susun_prompt_penawaran.js"),
        {
            "PROMPT_PENAWARAN": teks("n8n/prompts/draf_penawaran.md"),
            "SKEMA_DRAF": json.loads(teks("n8n/prompts/skema_draf.json")),
            "CFG": cfg,
        },
    )
    log_nodes, log_koneksi = jalur_log(sid, 1100, y + 420, kode_siapkan_log("WF-03 Keputusan dan status", "Validasi Draf"),
                                       "Menerima error dari node mana pun di rantai draf penawaran.", akhiran=" (Draf)")
    gagal = "Siapkan Log Error (Draf)"
    nodes = [
        node("Terima Draf", "n8n-nodes-base.webhook", 2.1, (0, y),
             {"httpMethod": "POST", "path": "prospek/draf", "responseMode": "responseNode",
              "options": {"allowedOrigins": env["WEB_ORIGIN"]}},
             "POST /prospek/draf (kontrak Section 10). Hanya origin halaman web lokal yang diizinkan.",
             webhookId=node_id("webhook/prospek/draf")),
        code_node("Validasi Draf", (220, y), teks("n8n/code/wf03/validasi_draf.js"),
                  "Catatan wajib; hanya AE atau admin."),
        if_benar("Draf Valid?", (440, y), "={{ $json.valid }}", "Masukan tidak valid ditolak (400)."),
        http("Baca Sheet Draf", (660, y), "GET", url_baca_sheet(sid, sheets),
             f"Sheet {', '.join(sheets)} dalam SATU panggilan.", kredensial="googleSheetsOAuth2Api"),
        code_node("Olah Sheet Draf", (880, y), kode_olah(sheets), "Baris sheet menjadi objek (+ nomor baris)."),
        code_node("Susun Prompt Penawaran", (1100, y), kode_susun,
                  "FR-23, AR-08. AE hanya prospek miliknya. Sumber: wf03/susun_prompt_penawaran.js + prompts/draf_penawaran.md"),
        if_benar("Penawaran Boleh?", (1320, y), "={{ $json.boleh }}", "False: prospek tidak ada atau milik AE lain (400)."),
        if_node("Pilih Model Penawaran", (1540, y), "={{ $json.model_ai }}", {"type": "string", "operation": "equals"},
                "ollama", "KA-01."),
        panggil_ollama("Panggil Ollama (Penawaran)", (1760, y - 120), env, "Draf penawaran lewat Ollama lokal."),
        panggil_claude("Panggil Claude (Penawaran)", (1760, y + 60), "Draf penawaran lewat Claude. Kredensial: Claude API (demo)."),
        code_node("Ambil Teks Penawaran", (1980, y),
                  isi_penanda(teks("n8n/code/wf01/ambil_teks_model.js"), {"NODE_KONTEKS": "Susun Prompt Penawaran"}),
                  "Menyamakan respons Claude dan Ollama."),
        code_node("Periksa Draf", (2200, y),
                  isi_penanda(gabung("n8n/code/pemeriksa_jawaban.js", "n8n/code/periksa_draf.js"),
                              {"NODE_KB": "Susun Prompt Penawaran"}),
                  "PJ-01–PJ-04 untuk draf; pelanggaran diganti template aman dan dicatat."),
        code_node("Siapkan Draf Penawaran", (2420, y),
                  gabung("n8n/code/sheet_tulis.js", "n8n/code/wf03/siapkan_draf_penawaran.js"),
                  "Draf Menunggu persetujuan (id_percakapan kosong) + Histori draf_dibuat."),
        http("Tulis Draf", (2640, y), "POST", SHEETS_API + sid + ":batchUpdate",
             "SATU batchUpdate atomik: Draf + Histori.", kredensial="googleSheetsOAuth2Api",
             body_expr="={{ JSON.stringify($json.body_tulis) }}"),
        respond("Kirim Hasil Draf", (2860, y), 200,
                "={{ JSON.stringify($('Siapkan Draf Penawaran').first().json.respons) }}", "Respons sesuai kontrak."),
        respond("Kirim Penolakan Draf", (1540, y + 240), 400,
                "={{ JSON.stringify({ status: 'ditolak', pesan: $json.pesan }) }}", "Ditolak karena aturan."),
        respond("Kirim Respons Gagal Draf", (2200, y + 420), 502, BODY_GAGAL_UMUM, "G5: kegagalan dilaporkan jujur."),
        *log_nodes,
    ]
    koneksi = [
        ("Terima Draf", 0, "Validasi Draf"),
        ("Validasi Draf", 0, "Draf Valid?"),
        ("Draf Valid?", 0, "Baca Sheet Draf"),
        ("Draf Valid?", 1, "Kirim Penolakan Draf"),
        ("Baca Sheet Draf", 0, "Olah Sheet Draf"),
        ("Olah Sheet Draf", 0, "Susun Prompt Penawaran"),
        ("Susun Prompt Penawaran", 0, "Penawaran Boleh?"),
        ("Penawaran Boleh?", 0, "Pilih Model Penawaran"),
        ("Penawaran Boleh?", 1, "Kirim Penolakan Draf"),
        ("Pilih Model Penawaran", 0, "Panggil Ollama (Penawaran)"),
        ("Pilih Model Penawaran", 1, "Panggil Claude (Penawaran)"),
        ("Panggil Ollama (Penawaran)", 0, "Ambil Teks Penawaran"),
        ("Panggil Claude (Penawaran)", 0, "Ambil Teks Penawaran"),
        ("Ambil Teks Penawaran", 0, "Periksa Draf"),
        ("Periksa Draf", 0, "Siapkan Draf Penawaran"),
        ("Siapkan Draf Penawaran", 0, "Tulis Draf"),
        ("Tulis Draf", 0, "Kirim Hasil Draf"),
        *[(n, 1, gagal) for n in (
            "Validasi Draf", "Baca Sheet Draf", "Olah Sheet Draf", "Susun Prompt Penawaran",
            "Panggil Ollama (Penawaran)", "Panggil Claude (Penawaran)", "Ambil Teks Penawaran", "Periksa Draf",
            "Siapkan Draf Penawaran", "Tulis Draf",
        )],
        *log_koneksi,
        ("Catat Log Error (Draf)", 0, "Kirim Respons Gagal Draf"),
    ]
    return nodes, koneksi


# ---------- WF-04 ----------

def bangun_wf04(env: dict[str, str]) -> dict:
    """Pengingat harian (FR-11): Schedule 08.00 WIB, tombol manual n8n, dan POST /pengingat dari Dashboard."""
    _AWALAN_ID[0] = "WF-04"
    sid = env["GOOGLE_SHEET_ID"]
    sheets = ["Konfigurasi", "Prospek"]
    log_nodes, log_koneksi = jalur_log(
        sid, 880, 700, kode_siapkan_log("WF-04 Pengingat harian", "Terima Jalankan"),
        "Menerima error dari node mana pun di WF-04.",
    )
    dari_webhook = "={{ $('Terima Jalankan').isExecuted }}"
    body_hasil = (
        "={{ JSON.stringify({ status: 'ok', tanggal_simulasi: $('Tandai Pengingat').first().json.tanggal_simulasi, "
        "ditandai: $('Tandai Pengingat').first().json.ditandai, "
        "sel_berubah: $('Tandai Pengingat').first().json.sel_berubah }) }}"
    )
    nodes = [
        node("Jadwal 08.00", "n8n-nodes-base.scheduleTrigger", 1.2, (0, 160),
             {"rule": {"interval": [{"field": "days", "daysInterval": 1, "triggerAtHour": 8, "triggerAtMinute": 0}]}},
             "FR-11. Setiap hari pukul 08.00 (zona waktu workflow Asia/Jakarta)."),
        node("Jalankan Manual", "n8n-nodes-base.manualTrigger", 1, (0, 320), {},
             "Tombol Execute workflow di n8n (T-23)."),
        node("Terima Jalankan", "n8n-nodes-base.webhook", 2.1, (0, 480),
             {"httpMethod": "POST", "path": "pengingat", "responseMode": "responseNode",
              "options": {"allowedOrigins": env["WEB_ORIGIN"]}},
             "POST /pengingat: tombol Jalankan pengingat di Dashboard. Idempoten; hanya menulis kolom pengingat.",
             webhookId=node_id("webhook/pengingat")),
        http("Baca Sheet Pengingat", (220, 320), "GET", url_baca_sheet(sid, sheets),
             "Konfigurasi dan Prospek dalam SATU panggilan.", kredensial="googleSheetsOAuth2Api"),
        code_node("Olah Sheet Pengingat", (440, 320), kode_olah(sheets), "Baris sheet menjadi objek (+ nomor baris)."),
        code_node("Tandai Pengingat", (660, 320), gabung("n8n/code/sheet_tulis.js", "n8n/code/wf04/tandai_pengingat.js"),
                  "Terlewat / Jatuh tempo hari ini terhadap TANGGAL_SIMULASI; hanya sel yang berubah."),
        if_benar("Ada Perubahan?", (880, 320), "={{ $json.sel_berubah > 0 }}", "Tanpa perubahan: tidak menulis."),
        http("Tulis Pengingat", (1100, 200), "POST", SHEETS_API + sid + ":batchUpdate",
             "SATU batchUpdate atomik untuk kolom pengingat.", kredensial="googleSheetsOAuth2Api",
             body_expr="={{ JSON.stringify($json.body_tulis) }}"),
        if_benar("Dari Webhook?", (1320, 320), dari_webhook, "Hanya pemicu webhook yang butuh respons HTTP."),
        respond("Kirim Hasil Pengingat", (1540, 320), 200, body_hasil, "Daftar prospek yang ditandai."),
        *log_nodes,
        if_benar("Gagal Dari Webhook?", (1760, 700), dari_webhook, "Hanya pemicu webhook yang butuh respons HTTP."),
        respond("Kirim Respons Gagal", (1980, 700), 502, BODY_GAGAL_UMUM, "G5: kegagalan dilaporkan jujur."),
    ]
    gagal = "Siapkan Log Error"
    koneksi = [
        ("Jadwal 08.00", 0, "Baca Sheet Pengingat"),
        ("Jalankan Manual", 0, "Baca Sheet Pengingat"),
        ("Terima Jalankan", 0, "Baca Sheet Pengingat"),
        ("Baca Sheet Pengingat", 0, "Olah Sheet Pengingat"),
        ("Baca Sheet Pengingat", 1, gagal),
        ("Olah Sheet Pengingat", 0, "Tandai Pengingat"),
        ("Olah Sheet Pengingat", 1, gagal),
        ("Tandai Pengingat", 0, "Ada Perubahan?"),
        ("Tandai Pengingat", 1, gagal),
        ("Ada Perubahan?", 0, "Tulis Pengingat"),
        ("Ada Perubahan?", 1, "Dari Webhook?"),
        ("Tulis Pengingat", 0, "Dari Webhook?"),
        ("Tulis Pengingat", 1, gagal),
        ("Dari Webhook?", 0, "Kirim Hasil Pengingat"),
        *log_koneksi,
        ("Catat Log Error", 0, "Gagal Dari Webhook?"),
        ("Gagal Dari Webhook?", 0, "Kirim Respons Gagal"),
    ]
    wf = workflow_dasar("WF-04 Pengingat harian", nodes, koneksi)
    wf["settings"]["timezone"] = "Asia/Jakarta"
    return wf


# ---------- WF-90 (utilitas uji) ----------

SHEET_SEED = ["KB", "Prospek", "Percakapan", "Antrean_Staf", "Draf", "Histori", "Konfigurasi", "Log_Error"]


def baca_seed() -> dict[str, list[list[str]]]:
    hasil = {}
    for s in SHEET_SEED:
        with open(ROOT / "seed" / f"{s}.csv", encoding="utf-8", newline="") as f:
            hasil[s] = [baris for baris in csv.reader(f)]
    return hasil


def bangun_wf90(env: dict[str, str]) -> dict:
    """Utilitas uji (Header Auth X-Reset-Token): POST /reset-seed, POST /uji/konfigurasi, GET /uji/data."""
    _AWALAN_ID[0] = "WF-90"
    sid = env["GOOGLE_SHEET_ID"]
    url_meta = SHEETS_API + sid + "?" + urllib.parse.urlencode({"fields": "sheets.properties(sheetId,title)"})
    body_gagal = "={{ JSON.stringify({ status: 'gagal', pesan: 'Reset seed gagal; data tidak berubah.' }) }}"
    nodes = [
        node("Terima Reset", "n8n-nodes-base.webhook", 2.1, (0, 300),
             {"httpMethod": "POST", "path": "reset-seed", "responseMode": "responseNode",
              "authentication": "headerAuth", "options": {}},
             "Utilitas uji (Section 13). Wajib header X-Reset-Token; token hanya di .env dan credential n8n.",
             webhookId=node_id("webhook/reset-seed")),
        http("Baca Daftar Sheet", (220, 300), "GET", url_meta, "sheetId setiap sheet.",
             kredensial="googleSheetsOAuth2Api"),
        code_node("Susun Reset", (440, 300), isi_penanda(teks("n8n/code/wf90/susun_reset.js"), {"SEED": baca_seed()}),
                  "Isi seed/ ditanam saat build. Satu batchUpdate atomik untuk 8 sheet."),
        http("Tulis Seed", (660, 300), "POST", SHEETS_API + sid + ":batchUpdate", "Menulis ulang semua sheet.",
             kredensial="googleSheetsOAuth2Api", body_expr="={{ JSON.stringify($json.body_tulis) }}"),
        respond("Kirim Hasil Reset", (880, 300), 200,
                "={{ JSON.stringify({ status: 'ok', baris_data: $('Susun Reset').first().json.ringkasan }) }}",
                "Jumlah baris data (tanpa header) per sheet."),
        respond("Kirim Respons Gagal", (660, 500), 502, body_gagal, "Batch atomik: bila gagal, tidak ada yang berubah."),
    ]
    koneksi = [
        ("Terima Reset", 0, "Baca Daftar Sheet"),
        ("Baca Daftar Sheet", 0, "Susun Reset"),
        ("Baca Daftar Sheet", 1, "Kirim Respons Gagal"),
        ("Susun Reset", 0, "Tulis Seed"),
        ("Susun Reset", 1, "Kirim Respons Gagal"),
        ("Tulis Seed", 0, "Kirim Hasil Reset"),
        ("Tulis Seed", 1, "Kirim Respons Gagal"),
    ]
    n2, k2 = rantai_endpoint(
        env, y=900, akhiran="Konfigurasi Uji", workflow="WF-90 Reset seed", metode="POST", path="uji/konfigurasi",
        kode_validasi=teks("n8n/code/wf90/validasi_konfigurasi.js"), sheets=["Konfigurasi"],
        kode_proses=gabung("n8n/code/sheet_tulis.js", "n8n/code/wf90/proses_konfigurasi.js"),
        catatan_proses="run_tests.py: MODE_GAGAL (T-19/T-20), MODEL_AI (T-27), TANGGAL_SIMULASI.",
        tulis=True, header_auth=True,
    )
    kode_data = teks("n8n/code/wf90/data_uji.js")
    n3, k3 = rantai_endpoint(
        env, y=1700, akhiran="Data Uji", workflow="WF-90 Reset seed", metode="GET", path="uji/data",
        kode_validasi=isi_penanda(kode_data, {"BAGIAN": "validasi"}), sheets=SHEET_SEED,
        kode_proses=isi_penanda(kode_data, {"BAGIAN": "susun"}),
        catatan_proses="run_tests.py: isi semua sheet untuk memeriksa baris yang tertulis.",
        tulis=False, header_auth=True,
    )
    return workflow_dasar("WF-90 Reset seed", nodes + n2 + n3, koneksi + k2 + k3)


# ---------- WF-05 ----------

def bangun_wf05(env: dict[str, str]) -> dict:
    _AWALAN_ID[0] = "WF-05"
    log_nodes, log_koneksi = jalur_log(
        env["GOOGLE_SHEET_ID"], 220, 300, teks("n8n/code/wf05/siapkan_log_wf05.js"),
        "FR-16. Jaring pengaman untuk kegagalan yang tidak tertangkap jalur gagal di workflow lain.",
    )
    nodes = [
        node("Terima Error", "n8n-nodes-base.errorTrigger", 1, (0, 300), {},
             "Error Trigger: dijalankan n8n saat workflow yang memasang WF-05 sebagai error workflow gagal."),
        *log_nodes,
    ]
    return workflow_dasar("WF-05 Penanganan error", nodes, [("Terima Error", 0, "Siapkan Log Error"), *log_koneksi],
                          error_wf=False)


def main() -> None:
    env = baca_env()
    for nama_file, pembangun in (
        ("WF-01_agent_chat.json", bangun_wf01),
        ("WF-02_data_panel.json", bangun_wf02),
        ("WF-03_keputusan_status.json", bangun_wf03),
        ("WF-04_pengingat_harian.json", bangun_wf04),
        ("WF-05_penanganan_error.json", bangun_wf05),
        ("WF-90_reset_seed.json", bangun_wf90),
    ):
        keluaran = ROOT / "n8n/workflows" / nama_file
        wf = pembangun(env)
        keluaran.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Ditulis: {keluaran.relative_to(ROOT)} ({len(wf['nodes'])} node)")


if __name__ == "__main__":
    main()
