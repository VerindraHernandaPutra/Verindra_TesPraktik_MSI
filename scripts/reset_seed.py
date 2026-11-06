"""Mengembalikan Google Spreadsheet demo ke data seed bersih (SIMULASI MSI, Section 13).

PERINGATAN: semua sheet ditulis ulang dari folder seed/. Data uji di Prospek, Percakapan,
Antrean_Staf, Draf, Histori, dan Log_Error HILANG. Hanya untuk spreadsheet demo berisi data dummy.

Pemakaian (dari akar repo):
    python scripts/reset_seed.py          # meminta konfirmasi dengan mengetik RESET
    python scripts/reset_seed.py --ya     # tanpa tanya (dipakai run_tests.py)

Butuh: WF-90 Reset seed ter-publish di n8n (deploy_workflows.py) dan RESET_TOKEN di .env.
Penulisan dilakukan n8n dalam satu batchUpdate atomik: bila gagal, tidak ada yang berubah.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "http://localhost:5678/webhook/reset-seed"


def baca_token() -> str:
    path = ROOT / ".env"
    if path.exists():
        for baris in path.read_text(encoding="utf-8").splitlines():
            if baris.strip().startswith("RESET_TOKEN="):
                token = baris.split("=", 1)[1].strip()
                if token:
                    return token
    sys.exit("RESET_TOKEN belum diisi di .env.")


def reset(token: str) -> dict:
    req = urllib.request.Request(URL, data=b"{}", method="POST",
                                 headers={"Content-Type": "application/json", "X-Reset-Token": token})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            sys.exit("Token ditolak n8n. Pastikan RESET_TOKEN di .env sama dengan kredensial 'Reset seed token (demo)'.")
        sys.exit(f"Reset gagal: HTTP {e.code} {e.read().decode(errors='replace')[:300]}")
    except urllib.error.URLError as e:
        sys.exit(f"Tidak dapat menghubungi n8n: {e.reason}. Apakah n8n berjalan dan WF-90 sudah di-publish?")


def main() -> None:
    token = baca_token()
    if "--ya" not in sys.argv:
        print("Semua sheet akan ditulis ulang dari seed/. Data uji akan HILANG.")
        if input("Ketik RESET untuk melanjutkan: ").strip() != "RESET":
            sys.exit("Dibatalkan; tidak ada yang berubah.")
    hasil = reset(token)
    if hasil.get("status") != "ok":
        sys.exit(f"Reset gagal: {hasil}")
    print("Reset selesai. Baris data per sheet:")
    for sheet, n in hasil["baris_data"].items():
        print(f"  {sheet:13} {n}")


if __name__ == "__main__":
    main()
