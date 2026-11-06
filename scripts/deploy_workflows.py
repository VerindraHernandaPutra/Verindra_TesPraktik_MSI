"""Memasang workflow hasil build ke n8n lokal lewat n8n Public API (SIMULASI MSI).

Alur: build dulu (python scripts/build_workflows.py), lalu:
    python scripts/deploy_workflows.py            # semua file di n8n/workflows/
    python scripts/deploy_workflows.py WF-01      # hanya file yang namanya diawali WF-01

- Workflow dicari berdasarkan nama ("WF-01 Agent chat", dst.).
- Kredensial yang sudah dipasang di n8n disalin ke node bernama sama, jadi tidak perlu dipilih ulang.
- Jika workflow sudah di-publish, n8n otomatis mem-publish versi baru (perilaku PUT /workflows/{id}).
- Workflow baru dibuat dalam keadaan belum di-publish; pasang kredensialnya di n8n lalu publish.

Butuh N8N_API_KEY di .env (n8n: Settings > n8n API > Create an API key). Key tidak pernah dicetak.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TIPE_BUTUH_KREDENSIAL = {"n8n-nodes-base.googleSheets"}


def baca_env() -> dict[str, str]:
    env: dict[str, str] = {}
    path = ROOT / ".env"
    if path.exists():
        for baris in path.read_text(encoding="utf-8").splitlines():
            baris = baris.strip()
            if baris and not baris.startswith("#") and "=" in baris:
                k, v = baris.split("=", 1)
                env[k.strip()] = v.strip()
    if not env.get("N8N_API_KEY"):
        sys.exit("N8N_API_KEY belum diisi di .env (n8n: Settings > n8n API > Create an API key).")
    return env


class N8n:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.key = key

    def panggil(self, metode: str, path: str, body: dict | None = None) -> dict:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.url + path, data=data, method=metode)
        req.add_header("X-N8N-API-KEY", self.key)
        req.add_header("Accept", "application/json")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                isi = r.read()
                return json.loads(isi) if isi else {}
        except urllib.error.HTTPError as e:
            pesan = e.read().decode(errors="replace")[:500]
            sys.exit(f"n8n API {metode} {path} gagal: HTTP {e.code} {pesan}")
        except urllib.error.URLError as e:
            sys.exit(f"Tidak dapat menghubungi n8n di {self.url}: {e.reason}. Apakah n8n berjalan?")

    def cari_workflow(self, nama: str) -> dict | None:
        cocok, kursor = [], None
        while True:
            q = {"limit": "100"}
            if kursor:
                q["cursor"] = kursor
            hasil = self.panggil("GET", "/workflows?" + urllib.parse.urlencode(q))
            cocok += [w for w in hasil.get("data", []) if w.get("name") == nama and not w.get("isArchived")]
            kursor = hasil.get("nextCursor")
            if not kursor:
                break
        if len(cocok) > 1:
            sys.exit(f'Ada {len(cocok)} workflow bernama "{nama}" di n8n. Arsipkan duplikatnya dulu.')
        return self.panggil("GET", f"/workflows/{cocok[0]['id']}") if cocok else None


def butuh_kredensial(node: dict) -> bool:
    p = node.get("parameters", {})
    return node["type"] in TIPE_BUTUH_KREDENSIAL or p.get("authentication") == "predefinedCredentialType"


def deploy(api: N8n, file: Path) -> None:
    baru = json.loads(file.read_text(encoding="utf-8"))
    nama = baru["name"]
    body = {k: baru[k] for k in ("name", "nodes", "connections", "settings")}
    lama = api.cari_workflow(nama)

    if lama is None:
        dibuat = api.panggil("POST", "/workflows", body)
        print(f'[{nama}] dibuat (id {dibuat["id"]}), belum di-publish.')
        perlu = [n["name"] for n in baru["nodes"] if butuh_kredensial(n)]
        if perlu:
            print("  Pasang kredensial di n8n untuk node: " + ", ".join(perlu) + "; lalu klik Publish.")
        return

    kredensial_lama = {n["name"]: n["credentials"] for n in lama["nodes"] if n.get("credentials")}
    tanpa = []
    for n in body["nodes"]:
        if n["name"] in kredensial_lama:
            n["credentials"] = kredensial_lama[n["name"]]
        elif butuh_kredensial(n):
            tanpa.append(n["name"])

    hasil = api.panggil("PUT", f"/workflows/{lama['id']}", body)
    terbit = bool(hasil.get("activeVersionId")) and hasil.get("activeVersionId") == hasil.get("versionId")
    status = "versi baru sudah di-publish" if terbit else "disimpan sebagai draf (workflow belum di-publish)"
    print(f"[{nama}] diperbarui (id {lama['id']}): {status}; kredensial dipertahankan di {len(kredensial_lama)} node.")
    if tanpa:
        print("  Node baru tanpa kredensial, pasang di n8n: " + ", ".join(tanpa))


def main() -> None:
    env = baca_env()
    api = N8n(env.get("N8N_API_URL", "http://localhost:5678/api/v1"), env["N8N_API_KEY"])
    awalan = sys.argv[1:] or [""]
    files = sorted(f for f in (ROOT / "n8n/workflows").glob("*.json") if any(f.name.startswith(a) for a in awalan))
    if not files:
        sys.exit("Tidak ada file workflow yang cocok di n8n/workflows/. Jalankan build_workflows.py dulu.")
    for f in files:
        deploy(api, f)


if __name__ == "__main__":
    main()
