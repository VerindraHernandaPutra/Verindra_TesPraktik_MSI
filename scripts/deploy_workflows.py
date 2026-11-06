"""Memasang workflow hasil build ke n8n lokal lewat n8n Public API (SIMULASI MSI).

Alur: build dulu (python scripts/build_workflows.py), lalu:
    python scripts/deploy_workflows.py            # semua file di n8n/workflows/
    python scripts/deploy_workflows.py WF-01      # hanya file yang namanya diawali WF-01

- Workflow dicari berdasarkan nama ("WF-01 Agent chat", dst.).
- Kredensial yang sudah dipasang di n8n disalin ke node bernama sama. Node baru memakai rujukan
  kredensial sejenis yang sudah dipakai workflow mana pun di n8n (isi kredensial tidak pernah dibaca).
- Rujukan "@WF:<nama workflow>" diganti dengan ID workflow tersebut; file tanpa rujukan dipasang lebih dulu.
- Jika workflow sudah di-publish, n8n otomatis mem-publish versi baru (perilaku PUT /workflows/{id}).
- Workflow yang semua kredensialnya terpasang langsung di-publish (n8n hanya terbuka di localhost).

Butuh N8N_API_KEY di .env (n8n: Settings > n8n API > Create an API key). Key tidak pernah dicetak.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POLA_RUJUKAN = re.compile(r"@WF:([^\"]+)")


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
            pesan = e.read().decode(errors="replace")[:600]
            sys.exit(f"n8n API {metode} {path} gagal: HTTP {e.code} {pesan}")
        except urllib.error.URLError as e:
            sys.exit(f"Tidak dapat menghubungi n8n di {self.url}: {e.reason}. Apakah n8n berjalan?")

    def semua_workflow(self) -> list[dict]:
        hasil, kursor = [], None
        while True:
            q = {"limit": "100"}
            if kursor:
                q["cursor"] = kursor
            res = self.panggil("GET", "/workflows?" + urllib.parse.urlencode(q))
            hasil += [w for w in res.get("data", []) if not w.get("isArchived")]
            kursor = res.get("nextCursor")
            if not kursor:
                return hasil


def jenis_kredensial(node: dict, tersedia: dict[str, dict]) -> str | None:
    p = node.get("parameters", {})
    if p.get("authentication") == "predefinedCredentialType":
        calon = [p.get("nodeCredentialType")]
    elif node["type"] == "n8n-nodes-base.googleSheets":
        calon = ["googleSheetsOAuth2Api", "googleApi"]
    else:
        return None
    return next((c for c in calon if c in tersedia), calon[0] if calon else None)


class Pemasang:
    def __init__(self, api: N8n) -> None:
        self.api = api
        self.workflow = {w["name"]: w for w in api.semua_workflow()}
        # Rujukan kredensial per jenis dari seluruh workflow (hanya {id, name}, bukan isi kredensial).
        self.per_jenis: dict[str, dict] = {}
        for w in self.workflow.values():
            for n in w.get("nodes", []):
                for jenis, rujukan in (n.get("credentials") or {}).items():
                    self.per_jenis.setdefault(jenis, rujukan)

    def ganti_rujukan(self, body: dict) -> dict:
        teks = json.dumps(body, ensure_ascii=False)

        def ke_id(m: re.Match) -> str:
            nama = m.group(1)
            if nama not in self.workflow:
                sys.exit(f'Rujukan @WF:{nama} tidak ditemukan di n8n. Pasang workflow "{nama}" lebih dulu.')
            return self.workflow[nama]["id"]

        return json.loads(POLA_RUJUKAN.sub(ke_id, teks))

    def pasang_kredensial(self, nodes: list[dict], lama: dict | None) -> tuple[list[str], list[str]]:
        kred_lama = {n["name"]: n["credentials"] for n in (lama or {}).get("nodes", []) if n.get("credentials")}
        diwarisi, tanpa = [], []
        for n in nodes:
            if n["name"] in kred_lama:
                n["credentials"] = kred_lama[n["name"]]
                continue
            jenis = jenis_kredensial(n, self.per_jenis)
            if jenis is None:
                continue
            if jenis in self.per_jenis:
                n["credentials"] = {jenis: self.per_jenis[jenis]}
                diwarisi.append(n["name"])
            else:
                tanpa.append(n["name"])
        return diwarisi, tanpa

    def deploy(self, file: Path) -> None:
        baru = json.loads(file.read_text(encoding="utf-8"))
        nama = baru["name"]
        body = self.ganti_rujukan({k: baru[k] for k in ("name", "nodes", "connections", "settings")})
        ringkas = self.workflow.get(nama)
        lama = self.api.panggil("GET", f"/workflows/{ringkas['id']}") if ringkas else None
        diwarisi, tanpa = self.pasang_kredensial(body["nodes"], lama)

        if lama is None:
            hasil = self.api.panggil("POST", "/workflows", body)
            print(f'[{nama}] dibuat (id {hasil["id"]}).')
        else:
            hasil = self.api.panggil("PUT", f"/workflows/{lama['id']}", body)
            print(f"[{nama}] diperbarui (id {lama['id']}).")
        self.workflow[nama] = hasil

        terbit = bool(hasil.get("activeVersionId")) and hasil.get("activeVersionId") == hasil.get("versionId")
        # Workflow dengan semua kredensial terpasang langsung di-publish agar webhook dan error workflow aktif.
        # Aman karena n8n hanya terbuka di localhost (S-02, docker-compose 127.0.0.1:5678).
        if not terbit and not tanpa:
            self.api.panggil("POST", f"/workflows/{hasil['id']}/publish", {})
            terbit = True
        print("  Status: " + ("versi terbaru sudah di-publish." if terbit else "belum di-publish; klik Publish di n8n bila sudah siap."))
        if diwarisi:
            print("  Kredensial sejenis dipasang otomatis untuk node: " + ", ".join(diwarisi))
        if tanpa:
            print("  Node tanpa kredensial, pasang manual di n8n: " + ", ".join(tanpa))


def main() -> None:
    env = baca_env()
    api = N8n(env.get("N8N_API_URL", "http://localhost:5678/api/v1"), env["N8N_API_KEY"])
    awalan = sys.argv[1:] or [""]
    files = [f for f in (ROOT / "n8n/workflows").glob("*.json") if any(f.name.startswith(a) for a in awalan)]
    if not files:
        sys.exit("Tidak ada file workflow yang cocok di n8n/workflows/. Jalankan build_workflows.py dulu.")
    # File yang dirujuk workflow lain dipasang lebih dulu.
    files.sort(key=lambda f: (bool(POLA_RUJUKAN.search(f.read_text(encoding="utf-8"))), f.name))
    pemasang = Pemasang(api)
    for f in files:
        pemasang.deploy(f)


if __name__ == "__main__":
    main()
