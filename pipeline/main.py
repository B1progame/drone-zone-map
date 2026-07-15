"""Safe source-registry updater.

This MVP deliberately exports registry metadata only. Country adapters must verify
official public endpoint terms and schema before fetching or publishing geometry.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "public" / "data" / "sources" / "countries.json"

def main() -> None:
    countries = json.loads(REGISTRY.read_text(encoding="utf-8"))
    print(f"Validated {len(countries)} country source records; no network fetching configured.")

if __name__ == "__main__":
    main()
