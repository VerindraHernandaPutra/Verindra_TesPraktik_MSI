"""Merakit workflow n8n (SIMULASI MSI) dari sumber di repo.

Sumber:
  n8n/prompts/        system prompt dan skema JSON
  n8n/code/           kode langkah (file .js biasa, bisa diuji terpisah)
  .env                ID spreadsheet, nama model Claude, origin halaman web

Keluaran (n8n/workflows/):
  WF-01_agent_chat.json         POST /chat
  WF-02_data_panel.json         GET /panel
  WF-03_keputusan_status.json   POST /approve, /prospek/status, /prospek/draf
  WF-04_pengingat_harian.json   jadwal 08.00, manual, POST /pengingat
  WF-05_penanganan_error.json   error workflow (Log_Error)
  WF-90_reset_seed.json         utilitas uji: reset seed, ubah Konfigurasi, baca data

NODE GABUNGAN: beberapa file kode yang berurutan dijalankan dalam SATU Code node agar kanvas n8n sederhana.
Setiap file tetap utuh dan menjadi satu "langkah"; rujukan $('Nama Langkah') di dalam file tetap berfungsi,
termasuk ke langkah di node gabungan lain (lewat __langkah pada keluaran node). Error diberi awalan nama langkah.

Rujukan antar-workflow ditulis "@WF:<nama workflow>"; deploy_workflows.py menggantinya dengan ID asli.
Jalankan dari akar repo:  python scripts/build_workflows.py
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
ENV_WAJIB = ["GOOGLE_SHEET_ID", "CLAUDE_MODEL", "WEB_ORIGIN"]
SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets/"
CLAUDE_API = "https://api.anthropic.com/v1/messages"
SHEET_SEED = ["KB", "Prospek", "Percakapan", "Antrean_Staf", "Draf", "Histori", "Konfigurasi", "Log_Error"]

TOLAK_VALID = "__out.valid ? null : { aksi: 'tolak', kode: 400, body: { status: 'ditolak', pesan: __out.pesan } }"
TOLAK_BOLEH = "__out.boleh === false ? { aksi: 'tolak', kode: 400, body: { status: 'ditolak', pesan: __out.pesan } } : null"
BODY_GAGAL = ("={{ JSON.stringify({ status: 'gagal', "
              "pesan: 'Layanan sedang bermasalah, permintaan tidak dapat diproses. Silakan coba ulang.' }) }}")


# ---------- utilitas ----------

def baca_env() -> dict[str, str]:
    path = ROOT / ".env"
    if not path.exists():
        sys.exit("File .env tidak ditemukan. Salin .env.example menjadi .env lalu isi nilainya.")
    env: dict[str, str] = {}
    for baris in path.read_text(encoding="utf-8").splitlines():
        baris = baris.strip()
        if baris and not baris.startswith("#") and "=" in baris:
            k, v = baris.split("=", 1)
            env[k.strip()] = v.strip()
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


_AWALAN_ID = ["WF-01"]  # diganti per workflow agar ID node unik


def node_id(nama: str) -> str:
    return str(uuid.uuid5(NAMESPACE, _AWALAN_ID[0] + "/" + nama))


def baca_seed() -> dict[str, list[list[str]]]:
    hasil = {}
    for s in SHEET_SEED:
        with open(ROOT / "seed" / f"{s}.csv", encoding="utf-8", newline="") as f:
            hasil[s] = [b for b in csv.reader(f)]
    return hasil


# ---------- pembuat node ----------

def node(nama, tipe, versi, posisi, parameter, catatan, **lain) -> dict:
    hasil = {"parameters": parameter, "id": node_id(nama), "name": nama, "type": tipe, "typeVersion": versi,
             "position": list(posisi), "notes": catatan}
    hasil.update(lain)
    return hasil


def code_node(nama, posisi, kode, catatan, on_error="continueErrorOutput") -> dict:
    return node(nama, "n8n-nodes-base.code", 2, posisi, {"jsCode": kode}, catatan, onError=on_error)


def if_benar(nama, posisi, ekspresi, catatan) -> dict:
    """IF: keluaran 0 bila ekspresi bernilai boolean true, keluaran 1 bila tidak."""
    return node(nama, "n8n-nodes-base.if", 2.2, posisi, {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{"id": node_id(nama + "/kondisi"), "leftValue": ekspresi, "rightValue": "",
                            "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
            "combinator": "and",
        },
        "options": {},
    }, catatan)


def respond(nama, posisi, kode_http, body_expr, catatan) -> dict:
    return node(nama, "n8n-nodes-base.respondToWebhook", 1.4, posisi,
                {"respondWith": "json", "responseBody": body_expr, "options": {"responseCode": kode_http}}, catatan)


def respond_dinamis(nama, posisi, catatan) -> dict:
    """Respons dengan kode dan body dari item: { kode, body }."""
    return respond(nama, posisi, "={{ $json.kode }}", "={{ JSON.stringify($json.body) }}", catatan)


def http(nama, posisi, metode, url, catatan, kredensial=None, body_expr=None, header=None,
         timeout=30000, on_error="continueErrorOutput") -> dict:
    p: dict = {"method": metode, "url": url, "options": {"timeout": timeout}}
    if kredensial:
        p.update({"authentication": "predefinedCredentialType", "nodeCredentialType": kredensial})
    if header:
        p.update({"sendHeaders": True, "headerParameters": {"parameters": [{"name": k, "value": v} for k, v in header.items()]}})
    if body_expr:
        p.update({"sendBody": True, "specifyBody": "json", "jsonBody": body_expr})
    return node(nama, "n8n-nodes-base.httpRequest", 4.2, posisi, p, catatan, onError=on_error)


def tanya_claude(nama, posisi, catatan) -> dict:
    return http(nama, posisi, "POST", CLAUDE_API, catatan, kredensial="anthropicApi",
                body_expr="={{ JSON.stringify($json.body_model) }}", header={"anthropic-version": "2026-10-21"})


def webhook(nama, posisi, metode, path, env, catatan, header_auth=False) -> dict:
    p = {"httpMethod": metode, "path": path, "responseMode": "responseNode", "options": {}}
    if header_auth:
        p["authentication"] = "headerAuth"
    else:
        p["options"] = {"allowedOrigins": env["WEB_ORIGIN"]}
    return node(nama, "n8n-nodes-base.webhook", 2.1, posisi, p, catatan, webhookId=node_id("webhook/" + path))


def url_baca_sheet(sid: str, sheets: list[str]) -> str:
    return SHEETS_API + sid + "?" + urllib.parse.urlencode(
        [("includeGridData", "true")] + [("ranges", s) for s in sheets]
        + [("fields", "sheets(properties(sheetId,title),data(rowData(values(formattedValue))))")])


def baca_sheet(nama, posisi, env, sheets) -> dict:
    return http(nama, posisi, "GET", url_baca_sheet(env["GOOGLE_SHEET_ID"], sheets),
                f"Sheet {', '.join(sheets)} dalam SATU panggilan spreadsheets.get.", kredensial="googleSheetsOAuth2Api")


def tulis_sheet(nama, posisi, env, catatan) -> dict:
    return http(nama, posisi, "POST", SHEETS_API + env["GOOGLE_SHEET_ID"] + ":batchUpdate", catatan,
                kredensial="googleSheetsOAuth2Api", body_expr="={{ JSON.stringify($json.body_tulis) }}")


def hubung(*pasangan) -> dict:
    koneksi: dict[str, dict] = {}
    for asal, keluaran, tujuan in pasangan:
        main = koneksi.setdefault(asal, {"main": []})["main"]
        while len(main) <= keluaran:
            main.append([])
        main[keluaran].append({"node": tujuan, "type": "main", "index": 0})
    return koneksi


# ---------- node gabungan ----------

class Rakitan:
    """Mengumpulkan node gabungan satu workflow; peta langkah -> node nyata dibuat setelah semua terdaftar."""

    def __init__(self) -> None:
        self.gabungan: list[tuple[dict, list[dict], str]] = []

    def tambah(self, nama, posisi, langkah, catatan, akhir="__data[0].json", on_error="continueErrorOutput") -> dict:
        n = code_node(nama, posisi, "", catatan, on_error=on_error)
        self.gabungan.append((n, langkah, akhir))
        return n

    def selesaikan(self, nodes: list[dict]) -> None:
        peta = {l["nama"]: n["name"] for n, ls, _ in self.gabungan for l in ls}
        semua = [x["name"] for x in nodes]
        for n, ls, akhir in self.gabungan:
            lokal = [l["nama"] for l in ls]
            nyata = [x for x in semua if x != n["name"] and "'" not in x]
            n["parameters"]["jsCode"] = kode_gabungan(ls, {k: v for k, v in peta.items() if k not in lokal}, lokal, akhir, nyata)
            n["notes"] += " Langkah: " + " > ".join(lokal) + "."


def langkah(nama, kode, masukan="prev", berhenti=None, jika=None) -> dict:
    """masukan: 'prev' (keluaran langkah sebelumnya), 'input' (masukan node), atau nama node nyata."""
    return {"nama": nama, "kode": kode, "masukan": masukan, "berhenti": berhenti, "jika": jika}


KERANGKA = """// NODE GABUNGAN (dirakit oleh scripts/build_workflows.py). Setiap langkah = satu file di n8n/code/.
// Rujukan $('Nama Node') ditulis eksplisit agar task runner n8n mengirim data node tersebut.
const __nyata = __NYATA__;
const __asli = (n) => (n in __nyata ? __nyata[n]() : $(n));
const __peta = __PETA__;
const __lokal = __LOKAL__;
const __hasil = {};
const __tidakJalan = (n) => ({ isExecuted: false, first: () => { throw new Error('Langkah ' + n + ' tidak dijalankan.'); }, all: () => [] });
function __ref(n) {
  if (n in __hasil) return { isExecuted: true, first: () => __hasil[n][0], all: () => __hasil[n] };
  if (__lokal.includes(n)) return __tidakJalan(n);
  if (n in __peta) {
    const nyata = __asli(__peta[n]);
    if (!nyata.isExecuted) return __tidakJalan(n);
    const j = (nyata.first().json.__langkah || {})[n];
    if (j === undefined) return __tidakJalan(n);
    return { isExecuted: true, first: () => ({ json: j }), all: () => [{ json: j }] };
  }
  return __asli(n);
}
const __masuk = (items) => ({ first: () => items[0], all: () => items });
function __jalan(nama, fn, items) {
  try {
    const out = fn(__ref, __masuk(items));
    __hasil[nama] = out;
    return out;
  } catch (e) {
    e.message = '[' + nama + '] ' + e.message;
    throw e;
  }
}
const __selesai = (json) => [{
  json: { ...json, __langkah: Object.fromEntries(Object.entries(__hasil).map(([k, v]) => [k, v[0] && v[0].json])) },
}];
let __data = $input.all();
"""


def kode_gabungan(ls: list[dict], peta: dict, lokal: list[str], akhir: str, nyata: list[str]) -> str:
    objek = "{ " + ", ".join(f"{json.dumps(n, ensure_ascii=False)}: () => $('{n}')" for n in nyata) + " }"
    bagian = [KERANGKA.replace("__NYATA__", objek).replace("__PETA__", json.dumps(peta, ensure_ascii=False))
                      .replace("__LOKAL__", json.dumps(lokal, ensure_ascii=False))]
    for l in ls:
        if l["masukan"] == "prev":
            sumber = "__data"
        elif l["masukan"] == "input":
            sumber = "$input.all()"
        else:
            sumber = f"__asli({json.dumps(l['masukan'])}).all()"
        isi = f"__data = __jalan({json.dumps(l['nama'])}, function ($, $input) {{\n{l['kode']}\n}}, {sumber});\n"
        if l["berhenti"]:
            isi += (f"{{ const __out = __data[0].json; const __henti = ({l['berhenti']}); "
                    f"if (__henti) return __selesai(__henti); }}\n")
        if l["jika"]:
            isi = f"if ({l['jika']}) {{\n{isi}}}\n"
        bagian.append(f"// ===== langkah: {l['nama']} =====\n{isi}")
    bagian.append(f"return __selesai({akhir});\n")
    return "\n".join(bagian)


def kode_olah(sheets: list[str]) -> str:
    return isi_penanda(teks("n8n/code/olah_data_sheet.js"), {"SHEET_WAJIB": sheets})


def jalur_gagal(r: Rakitan, env, x, y, workflow, node_masukan, node_data, akhiran="", kirim_respons=True):
    """Catat Gagal (siapkan + ambil baris Log_Error + susun) > Tulis Log Error > Kirim Respons Gagal.
    Mengembalikan (nodes, koneksi, nama node awal)."""
    catat, tulis, kirim = f"Catat Gagal{akhiran}", f"Tulis Log Error{akhiran}", f"Kirim Respons Gagal{akhiran}"
    siap = isi_penanda(teks("n8n/code/siapkan_log_error.js"), {"WORKFLOW": workflow, "NODE_MASUKAN": node_masukan})
    data = isi_penanda(teks("n8n/code/data_log.js"), {"NODE_DATA": node_data})
    susun = isi_penanda(gabung("n8n/code/log_error.js", "n8n/code/susun_baris_log.js"),
                        {"NODE_SUMBER": f"Siapkan Log Error{akhiran}"})
    url = (SHEETS_API + env["GOOGLE_SHEET_ID"] + "/values/" + urllib.parse.quote("Log_Error!A1")
           + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS")
    nodes = [
        r.tambah(catat, (x, y), [
            langkah(f"Siapkan Log Error{akhiran}", siap, masukan="input"),
            langkah(f"Data Log{akhiran}", data),
            langkah(f"Susun Baris Log{akhiran}", susun),
        ], "FR-16. Mencatat node asal error dan pesannya; kredensial disamarkan.", on_error="continueRegularOutput"),
        http(tulis, (x + 220, y), "POST", url, "Menambah satu baris ke sheet Log_Error.",
             kredensial="googleSheetsOAuth2Api", body_expr="={{ JSON.stringify($json.body_append) }}",
             on_error="continueRegularOutput"),
    ]
    koneksi = [(catat, 0, tulis)]
    if kirim_respons:
        nodes.append(respond(kirim, (x + 440, y), 502, BODY_GAGAL, "G5: kegagalan dilaporkan jujur."))
        koneksi.append((tulis, 0, kirim))
    return nodes, koneksi, catat


def workflow_dasar(nama, nodes, koneksi, error_wf=True) -> dict:
    settings: dict = {"executionOrder": "v1"}
    if error_wf:
        settings["errorWorkflow"] = "@WF:WF-05 Penanganan error"
    return {"name": nama, "nodes": nodes, "connections": hubung(*koneksi), "settings": settings,
            "pinData": {}, "active": False}


def endpoint(r: Rakitan, env, *, y, akhiran, workflow, metode, path, sheets, ls, tulis, header_auth=False):
    """Endpoint data: Terima > Baca Sheet > Proses (gabungan) > [Tulis?] > Kirim. Penolakan 400; error 502."""
    sheets = sheets + (["Log_Error"] if "Log_Error" not in sheets else [])
    terima, baca, proses = f"Terima {akhiran}", f"Baca Sheet {akhiran}", f"Proses {akhiran}"
    akhir = "{ ...__data[0].json, aksi: 'tulis' }" if tulis else "{ kode: 200, body: __data[0].json }"
    nodes = [
        webhook(terima, (0, y), metode, path, env, f"{metode} /{path}.", header_auth=header_auth),
        baca_sheet(baca, (220, y), env, sheets),
        r.tambah(proses, (440, y), ls, "Validasi, olah data, dan aturan bisnis.", akhir=akhir),
    ]
    gn, gk, catat = jalur_gagal(r, env, 440, y + 300, workflow, ls[0]["nama"], ls[1]["nama"], f" ({akhiran})")
    nodes += gn
    koneksi = [(terima, 0, baca), (baca, 0, proses), (baca, 1, catat), (proses, 1, catat), *gk]
    if tulis:
        nodes += [
            if_benar(f"Tulis {akhiran}?", (660, y), "={{ $json.aksi === 'tulis' }}", "False: ditolak aturan (400)."),
            tulis_sheet(f"Tulis {akhiran}", (880, y - 100), env, "SATU batchUpdate atomik."),
            respond(f"Kirim Hasil {akhiran}", (1100, y - 100), 200,
                    "={{ JSON.stringify($('" + proses + "').first().json.respons) }}", "Respons sukses."),
            respond_dinamis(f"Kirim Penolakan {akhiran}", (880, y + 100), "Ditolak karena aturan (400)."),
        ]
        koneksi += [(proses, 0, f"Tulis {akhiran}?"), (f"Tulis {akhiran}?", 0, f"Tulis {akhiran}"),
                    (f"Tulis {akhiran}?", 1, f"Kirim Penolakan {akhiran}"), (f"Tulis {akhiran}", 0, f"Kirim Hasil {akhiran}"),
                    (f"Tulis {akhiran}", 1, catat)]
    else:
        nodes.append(respond_dinamis(f"Kirim {akhiran}", (660, y), "Respons sesuai kontrak (atau penolakan 400)."))
        koneksi.append((proses, 0, f"Kirim {akhiran}"))
    return nodes, koneksi


# ---------- WF-01 ----------

def bangun_wf01(env) -> dict:
    _AWALAN_ID[0] = "WF-01"
    r = Rakitan()
    cfg = {"model_claude": env["CLAUDE_MODEL"]}
    sheets = ["Konfigurasi", "KB", "Prospek", "Histori", "Percakapan", "Antrean_Staf", "Draf", "Log_Error"]
    susun = isi_penanda(teks("n8n/code/wf01/susun_prompt.js"), {
        "PROMPT_AGENT": teks("n8n/prompts/agent_system.md"),
        "SKEMA_JAWABAN": json.loads(teks("n8n/prompts/skema_jawaban.json")), "CFG": cfg})
    susun_draf = isi_penanda(teks("n8n/code/wf01/susun_prompt_draf.js"), {
        "PROMPT_DRAF": teks("n8n/prompts/draf_followup.md"),
        "SKEMA_DRAF": json.loads(teks("n8n/prompts/skema_draf.json")), "CFG": cfg})
    ambil = teks("n8n/code/wf01/ambil_teks_model.js")
    periksa_draf = isi_penanda(gabung("n8n/code/pemeriksa_jawaban.js", "n8n/code/periksa_draf.js"), {"NODE_KB": "Susun Prompt"})
    j_periksa = "__hasil['Periksa Jawaban'][0].json"

    y = 300
    nodes = [
        webhook("Terima Pertanyaan", (0, y), "POST", "chat", env, "POST /chat (kontrak Section 10)."),
        baca_sheet("Baca Semua Sheet", (220, y), env, sheets),
        r.tambah("Siapkan Jawaban", (440, y), [
            langkah("Validasi Masukan", teks("n8n/code/wf01/validasi_masukan.js"), masukan="Terima Pertanyaan", berhenti=TOLAK_VALID),
            langkah("Olah Data Sheet", kode_olah(sheets), masukan="input"),
            langkah("Cek Permintaan Lama", teks("n8n/code/wf01/cek_permintaan_lama.js"),
                    berhenti="__out.lama ? { aksi: 'lama', kode: 200, body: __out.respons } : null"),
            langkah("Cari Prospek", gabung("n8n/code/normalisasi_kunci.js", "n8n/code/wf01/cari_prospek.js"), berhenti=TOLAK_VALID),
            langkah("Susun Prompt", susun),
        ], "Validasi, data sheet, idempotensi (FR-16), anti-dobel (FR-08), prompt + KB (FR-02, FR-03, FR-18).",
            akhir="{ ...__data[0].json, aksi: 'lanjut' }"),
        if_benar("Lanjut?", (660, y), "={{ $json.aksi === 'lanjut' }}", "False: ditolak (400) atau jawaban tersimpan (berulang)."),
        respond_dinamis("Kirim Respons Awal", (880, y + 160), "Penolakan 400 atau jawaban lama (berulang: true)."),
        tanya_claude("Tanya Claude", (880, y), "Jawaban agent. Structured outputs (AR-06). Kredensial: Claude API (demo)."),
        r.tambah("Periksa & Susun Draf", (1100, y), [
            langkah("Ambil Teks Model", ambil, masukan="input"),
            langkah("Periksa Jawaban", gabung("n8n/code/pemeriksa_jawaban.js", "n8n/code/wf01/periksa_jawaban.js")),
            langkah("Susun Prompt Draf", susun_draf,
                    jika=f"!({j_periksa}.topik.length === 1 && {j_periksa}.topik[0] === 'sapaan')"),
        ], "Pemeriksa PJ-01–PJ-04 (FR-05); prompt draf follow-up kecuali sapaan (FR-13).",
            akhir="__hasil['Susun Prompt Draf'] ? { ...__hasil['Susun Prompt Draf'][0].json, perlu_draf: true } : { perlu_draf: false }"),
        if_benar("Perlu Draf?", (1320, y), "={{ $json.perlu_draf }}", "Sapaan tidak dibuatkan draf."),
        tanya_claude("Tanya Claude (Draf)", (1540, y - 100), "Draf follow-up. Kredensial: Claude API (demo)."),
        r.tambah("Simpan Jawaban", (1760, y), [
            langkah("Ambil Teks Draf", ambil, masukan="input", jika="__asli('Tanya Claude (Draf)').isExecuted"),
            langkah("Periksa Draf", periksa_draf, jika="__asli('Tanya Claude (Draf)').isExecuted"),
            langkah("Cek Mode Gagal", teks("n8n/code/wf01/cek_mode_gagal.js")),
            langkah("Siapkan Penulisan", gabung("n8n/code/sheet_tulis.js", "n8n/code/wf01/siapkan_penulisan.js")),
        ], "Pemeriksa draf, MODE_GAGAL (FR-17), lalu semua baris baru disusun jadi satu batchUpdate (langkah 5–8)."),
        tulis_sheet("Tulis Semua Sheet", (1980, y), env, "Langkah 5–8: SATU batchUpdate atomik (semua atau tidak sama sekali)."),
        respond("Kirim Jawaban", (2200, y), 200, "={{ JSON.stringify($('Simpan Jawaban').first().json.respons) }}",
                "Langkah 9: kolom kontrak POST /chat."),
    ]
    gn, gk, catat = jalur_gagal(r, env, 1100, y + 360, "WF-01 Agent chat", "Validasi Masukan", "Olah Data Sheet")
    # Respons gagal WF-01 menyertakan id_permintaan agar halaman bisa Coba ulang dengan id yang sama.
    gn[-1]["parameters"]["responseBody"] = (
        "={{ JSON.stringify({ status: 'gagal', pesan: 'Layanan sedang bermasalah, jawaban tidak dapat diproses. "
        "Silakan coba ulang.', id_permintaan: $('Terima Pertanyaan').first().json.body.id_permintaan }) }}")
    nodes += gn
    r.selesaikan(nodes)
    koneksi = [
        ("Terima Pertanyaan", 0, "Baca Semua Sheet"), ("Baca Semua Sheet", 0, "Siapkan Jawaban"),
        ("Siapkan Jawaban", 0, "Lanjut?"), ("Lanjut?", 0, "Tanya Claude"), ("Lanjut?", 1, "Kirim Respons Awal"),
        ("Tanya Claude", 0, "Periksa & Susun Draf"), ("Periksa & Susun Draf", 0, "Perlu Draf?"),
        ("Perlu Draf?", 0, "Tanya Claude (Draf)"), ("Perlu Draf?", 1, "Simpan Jawaban"),
        ("Tanya Claude (Draf)", 0, "Simpan Jawaban"), ("Simpan Jawaban", 0, "Tulis Semua Sheet"),
        ("Tulis Semua Sheet", 0, "Kirim Jawaban"),
        *[(n, 1, catat) for n in ("Baca Semua Sheet", "Siapkan Jawaban", "Tanya Claude", "Periksa & Susun Draf",
                                  "Tanya Claude (Draf)", "Simpan Jawaban", "Tulis Semua Sheet")],
        *gk,
    ]
    return workflow_dasar("WF-01 Agent chat", nodes, koneksi)


# ---------- WF-02 ----------

def bangun_wf02(env) -> dict:
    _AWALAN_ID[0] = "WF-02"
    r = Rakitan()
    sheets = ["Konfigurasi", "Prospek", "Percakapan", "Antrean_Staf", "Draf", "Histori", "Log_Error"]
    nodes, koneksi = endpoint(r, env, y=300, akhiran="Panel", workflow="WF-02 Data panel", metode="GET", path="panel",
                              sheets=sheets, tulis=False, ls=[
        langkah("Validasi Panel", teks("n8n/code/wf02/validasi_peran.js"), masukan="Terima Panel", berhenti=TOLAK_VALID),
        langkah("Olah Sheet Panel", kode_olah(sheets), masukan="input"),
        langkah("Susun Panel", gabung("n8n/code/sheet_tulis.js", "n8n/code/wf02/susun_panel.js")),
    ])
    r.selesaikan(nodes)
    return workflow_dasar("WF-02 Data panel", nodes, koneksi)


# ---------- WF-03 ----------

def bangun_wf03(env) -> dict:
    _AWALAN_ID[0] = "WF-03"
    r = Rakitan()
    wf = "WF-03 Keputusan dan status"
    s1 = ["Draf", "Histori", "Log_Error"]
    n1, k1 = endpoint(r, env, y=300, akhiran="Keputusan", workflow=wf, metode="POST", path="approve", sheets=s1, tulis=True, ls=[
        langkah("Validasi Keputusan", teks("n8n/code/wf03/validasi_keputusan.js"), masukan="Terima Keputusan", berhenti=TOLAK_VALID),
        langkah("Olah Sheet Keputusan", kode_olah(s1), masukan="input"),
        langkah("Proses Keputusan", gabung("n8n/code/sheet_tulis.js", "n8n/code/wf03/proses_keputusan.js"), berhenti=TOLAK_BOLEH),
    ])
    s2 = ["Prospek", "Histori", "Log_Error"]
    n2, k2 = endpoint(r, env, y=900, akhiran="Status", workflow=wf, metode="POST", path="prospek/status", sheets=s2, tulis=True, ls=[
        langkah("Validasi Status", gabung("n8n/code/sheet_tulis.js", "n8n/code/wf03/validasi_status.js"),
                masukan="Terima Status", berhenti=TOLAK_VALID),
        langkah("Olah Sheet Status", kode_olah(s2), masukan="input"),
        langkah("Proses Status", gabung("n8n/code/sheet_tulis.js", "n8n/code/wf03/proses_status.js"), berhenti=TOLAK_BOLEH),
    ])
    n3, k3 = rantai_draf_penawaran(r, env, y=1500)
    r.selesaikan(n1 + n2 + n3)
    return workflow_dasar(wf, n1 + n2 + n3, k1 + k2 + k3)


def rantai_draf_penawaran(r: Rakitan, env, y):
    """POST /prospek/draf (FR-23): catatan AE > Claude > pemeriksa > Draf + Histori (atomik)."""
    sheets = ["Konfigurasi", "KB", "Prospek", "Draf", "Histori", "Log_Error"]
    susun = isi_penanda(gabung("n8n/code/sheet_tulis.js", "n8n/code/wf03/susun_prompt_penawaran.js"), {
        "PROMPT_PENAWARAN": teks("n8n/prompts/draf_penawaran.md"),
        "SKEMA_DRAF": json.loads(teks("n8n/prompts/skema_draf.json")), "CFG": {"model_claude": env["CLAUDE_MODEL"]}})
    nodes = [
        webhook("Terima Draf", (0, y), "POST", "prospek/draf", env, "POST /prospek/draf (kontrak Section 10)."),
        baca_sheet("Baca Sheet Draf", (220, y), env, sheets),
        r.tambah("Siapkan Penawaran", (440, y), [
            langkah("Validasi Draf", teks("n8n/code/wf03/validasi_draf.js"), masukan="Terima Draf", berhenti=TOLAK_VALID),
            langkah("Olah Sheet Draf", kode_olah(sheets), masukan="input"),
            langkah("Susun Prompt Penawaran", susun, berhenti=TOLAK_BOLEH),
        ], "Catatan wajib; AE hanya prospek miliknya; prompt draf penawaran (FR-23, AR-08).",
            akhir="{ ...__data[0].json, aksi: 'lanjut' }"),
        if_benar("Lanjut Penawaran?", (660, y), "={{ $json.aksi === 'lanjut' }}", "False: ditolak (400)."),
        respond_dinamis("Kirim Penolakan Draf", (880, y + 160), "Ditolak karena aturan (400)."),
        tanya_claude("Tanya Claude (Penawaran)", (880, y), "Draf penawaran. Kredensial: Claude API (demo)."),
        r.tambah("Simpan Penawaran", (1100, y), [
            langkah("Ambil Teks Penawaran", teks("n8n/code/wf01/ambil_teks_model.js"), masukan="input"),
            langkah("Periksa Draf", isi_penanda(gabung("n8n/code/pemeriksa_jawaban.js", "n8n/code/periksa_draf.js"),
                                                {"NODE_KB": "Susun Prompt Penawaran"})),
            langkah("Siapkan Draf Penawaran", gabung("n8n/code/sheet_tulis.js", "n8n/code/wf03/siapkan_draf_penawaran.js")),
        ], "Pemeriksa PJ-01–PJ-04; Draf Menunggu persetujuan + Histori draf_dibuat."),
        tulis_sheet("Tulis Draf", (1320, y), env, "SATU batchUpdate atomik: Draf + Histori."),
        respond("Kirim Hasil Draf", (1540, y), 200,
                "={{ JSON.stringify($('Simpan Penawaran').first().json.respons) }}", "Respons sesuai kontrak."),
    ]
    gn, gk, catat = jalur_gagal(r, env, 880, y + 360, "WF-03 Keputusan dan status", "Validasi Draf", "Olah Sheet Draf", " (Draf)")
    nodes += gn
    koneksi = [
        ("Terima Draf", 0, "Baca Sheet Draf"), ("Baca Sheet Draf", 0, "Siapkan Penawaran"),
        ("Siapkan Penawaran", 0, "Lanjut Penawaran?"), ("Lanjut Penawaran?", 0, "Tanya Claude (Penawaran)"),
        ("Lanjut Penawaran?", 1, "Kirim Penolakan Draf"), ("Tanya Claude (Penawaran)", 0, "Simpan Penawaran"),
        ("Simpan Penawaran", 0, "Tulis Draf"), ("Tulis Draf", 0, "Kirim Hasil Draf"),
        *[(n, 1, catat) for n in ("Baca Sheet Draf", "Siapkan Penawaran", "Tanya Claude (Penawaran)", "Simpan Penawaran", "Tulis Draf")],
        *gk,
    ]
    return nodes, koneksi


# ---------- WF-04 ----------

def bangun_wf04(env) -> dict:
    """Pengingat harian (FR-11): Schedule 08.00 WIB, tombol manual n8n, dan POST /pengingat dari Dashboard."""
    _AWALAN_ID[0] = "WF-04"
    r = Rakitan()
    sheets = ["Konfigurasi", "Prospek", "Log_Error"]
    dari_webhook = "={{ $('Terima Jalankan').isExecuted }}"
    hasil = "$('Proses Pengingat').first().json"
    nodes = [
        node("Jadwal 08.00", "n8n-nodes-base.scheduleTrigger", 1.2, (0, 160),
             {"rule": {"interval": [{"field": "days", "daysInterval": 1, "triggerAtHour": 8, "triggerAtMinute": 0}]}},
             "Setiap hari pukul 08.00 (zona waktu workflow Asia/Jakarta)."),
        node("Jalankan Manual", "n8n-nodes-base.manualTrigger", 1, (0, 320), {}, "Tombol Execute workflow di n8n (T-23)."),
        webhook("Terima Jalankan", (0, 480), "POST", "pengingat", env, "Tombol Jalankan pengingat di Dashboard."),
        baca_sheet("Baca Sheet Pengingat", (220, 320), env, sheets),
        r.tambah("Proses Pengingat", (440, 320), [
            langkah("Olah Sheet Pengingat", kode_olah(sheets), masukan="input"),
            langkah("Tandai Pengingat", gabung("n8n/code/sheet_tulis.js", "n8n/code/wf04/tandai_pengingat.js")),
        ], "Terlewat / Jatuh tempo hari ini terhadap TANGGAL_SIMULASI; hanya sel yang berubah."),
        if_benar("Ada Perubahan?", (660, 320), "={{ $json.sel_berubah > 0 }}", "Tanpa perubahan: tidak menulis."),
        tulis_sheet("Tulis Pengingat", (880, 200), env, "SATU batchUpdate atomik untuk kolom pengingat."),
        if_benar("Dari Webhook?", (1100, 320), dari_webhook, "Hanya pemicu webhook yang butuh respons HTTP."),
        respond("Kirim Hasil Pengingat", (1320, 320), 200,
                "={{ JSON.stringify({ status: 'ok', tanggal_simulasi: " + hasil + ".tanggal_simulasi, ditandai: "
                + hasil + ".ditandai, sel_berubah: " + hasil + ".sel_berubah }) }}", "Daftar prospek yang ditandai."),
    ]
    gn, gk, catat = jalur_gagal(r, env, 440, 700, "WF-04 Pengingat harian", "Terima Jalankan", "Olah Sheet Pengingat",
                                kirim_respons=False)
    nodes += gn + [
        if_benar("Gagal Dari Webhook?", (880, 700), dari_webhook, "Hanya pemicu webhook yang butuh respons HTTP."),
        respond("Kirim Respons Gagal", (1100, 700), 502, BODY_GAGAL, "G5: kegagalan dilaporkan jujur."),
    ]
    r.selesaikan(nodes)
    koneksi = [
        ("Jadwal 08.00", 0, "Baca Sheet Pengingat"), ("Jalankan Manual", 0, "Baca Sheet Pengingat"),
        ("Terima Jalankan", 0, "Baca Sheet Pengingat"), ("Baca Sheet Pengingat", 0, "Proses Pengingat"),
        ("Proses Pengingat", 0, "Ada Perubahan?"), ("Ada Perubahan?", 0, "Tulis Pengingat"),
        ("Ada Perubahan?", 1, "Dari Webhook?"), ("Tulis Pengingat", 0, "Dari Webhook?"),
        ("Dari Webhook?", 0, "Kirim Hasil Pengingat"),
        *[(n, 1, catat) for n in ("Baca Sheet Pengingat", "Proses Pengingat", "Tulis Pengingat")],
        *gk, ("Tulis Log Error", 0, "Gagal Dari Webhook?"), ("Gagal Dari Webhook?", 0, "Kirim Respons Gagal"),
    ]
    wf = workflow_dasar("WF-04 Pengingat harian", nodes, koneksi)
    wf["settings"]["timezone"] = "Asia/Jakarta"
    return wf


# ---------- WF-05 ----------

def bangun_wf05(env) -> dict:
    """Error workflow: Terima Error > Baca Log Error > Catat Gagal > Tulis Log Error."""
    _AWALAN_ID[0] = "WF-05"
    r = Rakitan()
    sid = env["GOOGLE_SHEET_ID"]
    susun = isi_penanda(gabung("n8n/code/log_error.js", "n8n/code/susun_baris_log.js"), {"NODE_SUMBER": "Siapkan Log Error"})
    url_append = (SHEETS_API + sid + "/values/" + urllib.parse.quote("Log_Error!A1")
                  + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS")
    nodes = [
        node("Terima Error", "n8n-nodes-base.errorTrigger", 1, (0, 300), {},
             "Dijalankan n8n saat workflow yang memasang WF-05 sebagai error workflow gagal."),
        http("Baca Log Error", (220, 300), "GET", SHEETS_API + sid + "/values/" + urllib.parse.quote("Log_Error!A:F"),
             "Nomor id_error berikutnya.", kredensial="googleSheetsOAuth2Api", on_error="continueRegularOutput"),
        r.tambah("Catat Gagal", (440, 300), [
            langkah("Siapkan Log Error", teks("n8n/code/wf05/siapkan_log_wf05.js"), masukan="Terima Error"),
            langkah("Susun Baris Log", susun, masukan="input"),
        ], "FR-16. Jaring pengaman untuk kegagalan yang tidak tertangkap jalur gagal.", on_error="continueRegularOutput"),
        http("Tulis Log Error", (660, 300), "POST", url_append, "Menambah satu baris ke sheet Log_Error.",
             kredensial="googleSheetsOAuth2Api", body_expr="={{ JSON.stringify($json.body_append) }}",
             on_error="continueRegularOutput"),
    ]
    r.selesaikan(nodes)
    return workflow_dasar("WF-05 Penanganan error", nodes,
                          [("Terima Error", 0, "Baca Log Error"), ("Baca Log Error", 0, "Catat Gagal"),
                           ("Catat Gagal", 0, "Tulis Log Error")], error_wf=False)


# ---------- WF-90 (utilitas uji) ----------

def bangun_wf90(env) -> dict:
    """Utilitas uji (Header Auth X-Reset-Token): POST /reset-seed, POST /uji/konfigurasi, GET /uji/data."""
    _AWALAN_ID[0] = "WF-90"
    r = Rakitan()
    sid = env["GOOGLE_SHEET_ID"]
    url_meta = SHEETS_API + sid + "?" + urllib.parse.urlencode({"fields": "sheets.properties(sheetId,title)"})
    nodes = [
        webhook("Terima Reset", (0, 300), "POST", "reset-seed", env,
                "Utilitas uji (Section 13). Wajib header X-Reset-Token.", header_auth=True),
        http("Baca Daftar Sheet", (220, 300), "GET", url_meta, "sheetId setiap sheet.", kredensial="googleSheetsOAuth2Api"),
        code_node("Susun Reset", (440, 300), isi_penanda(teks("n8n/code/wf90/susun_reset.js"), {"SEED": baca_seed()}),
                  "Isi seed/ ditanam saat build. Satu batchUpdate atomik untuk 8 sheet."),
        tulis_sheet("Tulis Seed", (660, 300), env, "Menulis ulang semua sheet."),
        respond("Kirim Hasil Reset", (880, 300), 200,
                "={{ JSON.stringify({ status: 'ok', baris_data: $('Susun Reset').first().json.ringkasan }) }}",
                "Jumlah baris data per sheet."),
        respond("Kirim Respons Gagal Reset", (660, 500), 502,
                "={{ JSON.stringify({ status: 'gagal', pesan: 'Reset seed gagal; data tidak berubah.' }) }}",
                "Batch atomik: bila gagal, tidak ada yang berubah."),
    ]
    koneksi = [("Terima Reset", 0, "Baca Daftar Sheet"), ("Baca Daftar Sheet", 0, "Susun Reset"),
               ("Baca Daftar Sheet", 1, "Kirim Respons Gagal Reset"), ("Susun Reset", 0, "Tulis Seed"),
               ("Susun Reset", 1, "Kirim Respons Gagal Reset"), ("Tulis Seed", 0, "Kirim Hasil Reset"),
               ("Tulis Seed", 1, "Kirim Respons Gagal Reset")]
    sk = ["Konfigurasi", "Log_Error"]
    n2, k2 = endpoint(r, env, y=900, akhiran="Konfigurasi Uji", workflow="WF-90 Reset seed", metode="POST",
                      path="uji/konfigurasi", sheets=sk, tulis=True, header_auth=True, ls=[
        langkah("Validasi Konfigurasi Uji", teks("n8n/code/wf90/validasi_konfigurasi.js"),
                masukan="Terima Konfigurasi Uji", berhenti=TOLAK_VALID),
        langkah("Olah Sheet Konfigurasi Uji", kode_olah(sk), masukan="input"),
        langkah("Proses Konfigurasi Uji", gabung("n8n/code/sheet_tulis.js", "n8n/code/wf90/proses_konfigurasi.js"),
                berhenti=TOLAK_BOLEH),
    ])
    kode_data = teks("n8n/code/wf90/data_uji.js")
    n3, k3 = endpoint(r, env, y=1500, akhiran="Data Uji", workflow="WF-90 Reset seed", metode="GET", path="uji/data",
                      sheets=list(SHEET_SEED), tulis=False, header_auth=True, ls=[
        langkah("Validasi Data Uji", isi_penanda(kode_data, {"BAGIAN": "validasi"}), masukan="Terima Data Uji"),
        langkah("Olah Sheet Data Uji", kode_olah(SHEET_SEED), masukan="input"),
        langkah("Susun Data Uji", isi_penanda(kode_data, {"BAGIAN": "susun"})),
    ])
    r.selesaikan(nodes + n2 + n3)
    return workflow_dasar("WF-90 Reset seed", nodes + n2 + n3, koneksi + k2 + k3)


def main() -> None:
    env = baca_env()
    for nama_file, pembangun in (
        ("WF-01_agent_chat.json", bangun_wf01), ("WF-02_data_panel.json", bangun_wf02),
        ("WF-03_keputusan_status.json", bangun_wf03), ("WF-04_pengingat_harian.json", bangun_wf04),
        ("WF-05_penanganan_error.json", bangun_wf05), ("WF-90_reset_seed.json", bangun_wf90),
    ):
        wf = pembangun(env)
        nama = {n["name"] for n in wf["nodes"]}
        rusak = [(a, t["node"]) for a, c in wf["connections"].items() for o in c["main"] for t in o
                 if a not in nama or t["node"] not in nama]
        if rusak or len(nama) != len(wf["nodes"]):
            sys.exit(f"{nama_file}: koneksi rusak {rusak} atau nama node dobel.")
        (ROOT / "n8n/workflows" / nama_file).write_text(json.dumps(wf, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Ditulis: n8n/workflows/{nama_file} ({len(wf['nodes'])} node)")


if __name__ == "__main__":
    main()
