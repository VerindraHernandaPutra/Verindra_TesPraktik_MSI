"""Merakit workflow n8n (SIMULASI MSI) dari sumber di repo.

Sumber:
  n8n/prompts/        system prompt dan skema JSON jawaban
  n8n/code/           isi Code node (file .js biasa, bisa diuji terpisah)
  .env                ID spreadsheet, nama model, alamat Ollama, origin halaman web

Keluaran:
  n8n/workflows/WF-01_agent_chat.json   siap di-import lewat menu Import di n8n

Jalankan dari akar repo:  python scripts/build_workflows.py
Kredensial TIDAK ditulis ke file; dipilih manual di n8n setelah import.
"""

from __future__ import annotations

import json
import re
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAMESPACE = uuid.UUID("6f1c2b6e-4d1a-4f43-9a52-5d0c3e7b9a10")

ENV_WAJIB = ["GOOGLE_SHEET_ID", "CLAUDE_MODEL", "OLLAMA_MODEL", "OLLAMA_BASE_URL", "WEB_ORIGIN"]


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


def node_id(nama: str) -> str:
    return str(uuid.uuid5(NAMESPACE, "WF-01/" + nama))


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


def code_node(nama: str, posisi: tuple[int, int], kode: str, catatan: str) -> dict:
    return node(nama, "n8n-nodes-base.code", 2, posisi, {"jsCode": kode}, catatan)


def sheets_baca(nama: str, posisi: tuple[int, int], sheet_id: str, sheet: str, catatan: str) -> dict:
    return node(
        nama,
        "n8n-nodes-base.googleSheets",
        4.7,
        posisi,
        {
            "documentId": {"__rl": True, "value": sheet_id, "mode": "id"},
            "sheetName": {"__rl": True, "value": sheet, "mode": "name"},
            "options": {},
        },
        catatan,
        executeOnce=True,
        onError="continueErrorOutput",
    )


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


def http_model(nama: str, posisi: tuple[int, int], url: str, catatan: str, kredensial: bool, timeout: int) -> dict:
    parameter = {
        "method": "POST",
        "url": url,
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify($json.body_model) }}",
        "options": {"timeout": timeout},
    }
    if kredensial:
        parameter.update(
            {
                "authentication": "predefinedCredentialType",
                "nodeCredentialType": "anthropicApi",
                "sendHeaders": True,
                "headerParameters": {"parameters": [{"name": "anthropic-version", "value": "2026-10-21"}]},
            }
        )
    hasil = node(nama, "n8n-nodes-base.httpRequest", 4.2, posisi, parameter, catatan, onError="continueErrorOutput")
    return hasil


def hubung(*pasangan: tuple[str, int, str]) -> dict:
    """pasangan: (node asal, indeks keluaran, node tujuan)."""
    koneksi: dict[str, dict] = {}
    for asal, keluaran, tujuan in pasangan:
        main = koneksi.setdefault(asal, {"main": []})["main"]
        while len(main) <= keluaran:
            main.append([])
        main[keluaran].append({"node": tujuan, "type": "main", "index": 0})
    return koneksi


def bangun_wf01(env: dict[str, str]) -> dict:
    prompt = teks("n8n/prompts/agent_system.md")
    skema = json.loads(teks("n8n/prompts/skema_jawaban.json"))
    cfg = {"model_claude": env["CLAUDE_MODEL"], "model_ollama": env["OLLAMA_MODEL"]}

    kode_susun = isi_penanda(
        teks("n8n/code/wf01/susun_prompt.js"),
        {"PROMPT_AGENT": prompt, "SKEMA_JAWABAN": skema, "CFG": cfg},
    )
    kode_periksa = teks("n8n/code/pemeriksa_jawaban.js") + "\n" + teks("n8n/code/wf01/periksa_jawaban.js")

    body_jawaban = (
        "={{ JSON.stringify({ status: $json.status, jawaban: $json.jawaban, rujukan_kb: $json.rujukan_kb, "
        "eskalasi: $json.eskalasi, id_prospek: $json.id_prospek, id_draf: $json.id_draf }) }}"
    )
    body_tolak = "={{ JSON.stringify({ status: 'ditolak', pesan: $json.pesan }) }}"
    body_gagal = (
        "={{ JSON.stringify({ status: 'gagal', "
        "pesan: 'Layanan sedang bermasalah, jawaban tidak dapat diproses. Silakan coba ulang.', "
        "id_permintaan: $('Validasi Masukan').first().json.id_permintaan }) }}"
    )

    nodes = [
        node(
            "Terima Pertanyaan",
            "n8n-nodes-base.webhook",
            2.1,
            (0, 300),
            {
                "httpMethod": "POST",
                "path": "chat",
                "responseMode": "responseNode",
                "options": {"allowedOrigins": env["WEB_ORIGIN"]},
            },
            "Langkah 1. POST /chat (kontrak Section 10). Hanya origin halaman web lokal yang diizinkan.",
            webhookId=node_id("webhook/chat"),
        ),
        code_node(
            "Validasi Masukan",
            (220, 300),
            teks("n8n/code/wf01/validasi_masukan.js"),
            "FR-01. Sumber: n8n/code/wf01/validasi_masukan.js",
        ),
        if_node(
            "Cek Masukan",
            (440, 300),
            "={{ $json.valid }}",
            {"type": "boolean", "operation": "true", "singleValue": True},
            "",
            "Pertanyaan kosong ditolak dengan status 400.",
        ),
        respond("Kirim Penolakan", (660, 520), 400, body_tolak, "Masukan tidak valid."),
        sheets_baca(
            "Baca Konfigurasi",
            (660, 200),
            env["GOOGLE_SHEET_ID"],
            "Konfigurasi",
            "Langkah 2. MODEL_AI, MODE_GAGAL, TANGGAL_SIMULASI.",
        ),
        sheets_baca(
            "Baca KB",
            (880, 200),
            env["GOOGLE_SHEET_ID"],
            "KB",
            "Langkah 2. FR-18: KB dibaca ulang setiap permintaan.",
        ),
        code_node(
            "Susun Prompt",
            (1100, 200),
            kode_susun,
            "Langkah 3. FR-02, FR-03. Sumber: n8n/code/wf01/susun_prompt.js + n8n/prompts/",
        ),
        if_node(
            "Pilih Model",
            (1320, 200),
            "={{ $json.model_ai }}",
            {"type": "string", "operation": "equals"},
            "ollama",
            "KA-01. MODEL_AI = ollama ke Ollama lokal, selain itu ke Claude.",
        ),
        http_model(
            "Panggil Ollama",
            (1540, 60),
            env["OLLAMA_BASE_URL"].rstrip("/") + "/api/chat",
            "Langkah 3 (cadangan). Ollama lokal, tanpa kredensial.",
            kredensial=False,
            timeout=120000,
        ),
        http_model(
            "Panggil Claude",
            (1540, 300),
            "https://api.anthropic.com/v1/messages",
            "Langkah 3. Kredensial: Claude API (demo). Structured outputs menjamin format JSON (AR-06).",
            kredensial=True,
            timeout=30000,
        ),
        code_node(
            "Ambil Teks Model",
            (1760, 200),
            teks("n8n/code/wf01/ambil_teks_model.js"),
            "Menyamakan respons Claude dan Ollama. Sumber: n8n/code/wf01/ambil_teks_model.js",
        ),
        code_node(
            "Periksa Jawaban",
            (1980, 200),
            kode_periksa,
            "Langkah 4. FR-05, PJ-01–PJ-04. Sumber: n8n/code/pemeriksa_jawaban.js + wf01/periksa_jawaban.js",
        ),
        respond("Kirim Jawaban", (2200, 200), 200, body_jawaban, "Langkah 9. Hanya kolom kontrak POST /chat."),
        respond(
            "Kirim Respons Gagal",
            (1980, 520),
            502,
            body_gagal,
            "G5: kegagalan dilaporkan jujur. Log_Error dan MODE_GAGAL menyusul di BL-12.",
        ),
    ]

    connections = hubung(
        ("Terima Pertanyaan", 0, "Validasi Masukan"),
        ("Validasi Masukan", 0, "Cek Masukan"),
        ("Cek Masukan", 0, "Baca Konfigurasi"),
        ("Cek Masukan", 1, "Kirim Penolakan"),
        ("Baca Konfigurasi", 0, "Baca KB"),
        ("Baca Konfigurasi", 1, "Kirim Respons Gagal"),
        ("Baca KB", 0, "Susun Prompt"),
        ("Baca KB", 1, "Kirim Respons Gagal"),
        ("Susun Prompt", 0, "Pilih Model"),
        ("Pilih Model", 0, "Panggil Ollama"),
        ("Pilih Model", 1, "Panggil Claude"),
        ("Panggil Ollama", 0, "Ambil Teks Model"),
        ("Panggil Ollama", 1, "Kirim Respons Gagal"),
        ("Panggil Claude", 0, "Ambil Teks Model"),
        ("Panggil Claude", 1, "Kirim Respons Gagal"),
        ("Ambil Teks Model", 0, "Periksa Jawaban"),
        ("Periksa Jawaban", 0, "Kirim Jawaban"),
    )

    return {
        "name": "WF-01 Agent chat",
        "nodes": nodes,
        "connections": connections,
        "settings": {"executionOrder": "v1"},
        "pinData": {},
        "active": False,
    }


def main() -> None:
    env = baca_env()
    keluaran = ROOT / "n8n/workflows/WF-01_agent_chat.json"
    wf = bangun_wf01(env)
    keluaran.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Ditulis: {keluaran.relative_to(ROOT)} ({len(wf['nodes'])} node)")


if __name__ == "__main__":
    main()
