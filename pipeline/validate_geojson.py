"""Small geometry sanity checker used by country adapters and CI diagnostics."""
from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path
import argparse
import json


def coordinate_pairs(value: object) -> Iterable[tuple[float, float]]:
    if isinstance(value, list) and len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
        yield float(value[0]), float(value[1])
    elif isinstance(value, list):
        for item in value:
            yield from coordinate_pairs(item)


def feature_span(feature: dict) -> tuple[float, float]:
    pairs = list(coordinate_pairs((feature.get("geometry") or {}).get("coordinates")))
    if not pairs:
        return 0.0, 0.0
    xs, ys = zip(*pairs)
    return max(xs) - min(xs), max(ys) - min(ys)

def renderer_includes(path: Path, feature: dict) -> bool:
    """Mirror the LFV filters in MapCanvas without altering source geometry."""
    properties = feature.get("properties", {})
    if path.stem == "mais-RSTA":
        return properties.get("LOWER") in {"GND", "SFC"}
    if path.stem == "mais-DNGA":
        return properties.get("LOWER") == "GND"
    if path.stem == "DAIM_TOPO-SUP":
        return properties.get("LOWER") in {"GND", "SFC"}
    if path.stem == "dynais-NOTAM":
        try:
            lower = float(properties.get("LOWER", 999999))
        except (TypeError, ValueError):
            return False
        return (
            lower <= 500
            and str(properties.get("CODE23", ""))[:1] in {"R", "W"}
            and properties.get("CODE45") != "TT"
        )
    return True


def audit(path: Path) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    features = payload.get("features", [])
    ranked = sorted(((max(feature_span(item)), item) for item in features), key=lambda row: row[0], reverse=True)
    print(f"{path.name}: {len(features)} features; maximum coordinate span {ranked[0][0]:.3f}°" if ranked else f"{path.name}: empty")
    visible = [feature for feature in features if renderer_includes(path, feature)]
    visible_span = max((max(feature_span(feature)) for feature in visible), default=0.0)
    if len(visible) != len(features):
        print(f"  renderer: {len(visible)} visible; maximum visible span {visible_span:.3f}°")
    for span, feature in ranked[:3]:
        properties = feature.get("properties", {})
        keys = ("NAME", "LOCATION", "LOWER", "LOW_UOM", "CODE23", "CODE45", "RADIUS", "STARTVALIDITY", "ENDVALIDITY")
        summary = {key: properties.get(key) for key in keys if key in properties}
        print(f"  {span:.3f}° {summary}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()
    for pattern in args.paths:
        matches = sorted(pattern.parent.glob(pattern.name))
        for path in matches:
            audit(path)


if __name__ == "__main__":
    main()
