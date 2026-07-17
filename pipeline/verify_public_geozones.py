"""Compare checked-in public geozones with fresh official adapter output."""
from __future__ import annotations

from collections import Counter
from pathlib import Path
import argparse
import json

from adapters.public_uas_feeds import (
    FinlandTraficomAdapter,
    NetherlandsIenwAdapter,
)

ROOT = Path(__file__).resolve().parents[1]


def signature(features: list[dict]) -> tuple:
    return tuple(
        sorted(
            (
                str(feature.get("id") or (feature.get("properties") or {}).get("identifier")),
                (feature.get("properties") or {}).get("restriction"),
                (feature.get("properties") or {}).get("sourceGeometryType")
                or (feature.get("geometry") or {}).get("type"),
            )
            for feature in features
        )
    )


def verify(adapter) -> None:
    path = ROOT / "public" / "data" / "zones" / f"{adapter.country_code}.geojson"
    local = json.loads(path.read_text(encoding="utf-8")).get("features", [])
    official = adapter.fetch().features
    local_restrictions = Counter((feature.get("properties") or {}).get("restriction") for feature in local)
    official_restrictions = Counter((feature.get("properties") or {}).get("restriction") for feature in official)
    if signature(local) != signature(official):
        raise ValueError(
            f"{adapter.country_code}: local snapshot differs from the current official feed "
            f"({len(local)} local / {len(official)} official)"
        )
    if local_restrictions != official_restrictions:
        raise ValueError(f"{adapter.country_code}: restriction category counts differ")
    print(f"{adapter.country_code}: {len(local)} features match official identifiers, geometry types and restrictions")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--country", choices=["FI", "NL"], action="append")
    args = parser.parse_args()
    adapters = [FinlandTraficomAdapter(), NetherlandsIenwAdapter()]
    selected = set(args.country or [])
    for adapter in adapters:
        if not selected or adapter.country_code in selected:
            verify(adapter)


if __name__ == "__main__":
    main()
