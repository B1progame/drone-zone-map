"""Import an authority-provided personal export into ignored local storage.

No login is automated. The user first obtains a permitted JSON/GeoJSON export
from the authority, then passes its local path to this command. Output is always
written below ``private-data/`` and is never a public deployment asset.
"""
from __future__ import annotations

from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path

try:
    from .adapters.ed269 import normalize_ed269
    from .private_importer.core import deduplicate_features, normalize_feature, validate_dataset
except ImportError:  # Direct execution: python pipeline/import_private_export.py
    from adapters.ed269 import normalize_ed269
    from private_importer.core import deduplicate_features, normalize_feature, validate_dataset


ROOT = Path(__file__).resolve().parents[1]
SUPPORTED = {
    "IT": {
        "authority": "ENAC / d-flight",
        "sourceUrl": "https://www.d-flight.it/web-app/",
        "layerName": "d-flight ED-269 personal export",
    }
}


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    temporary.replace(path)


def import_export(country: str, source: Path, output: Path | None = None) -> dict:
    code = country.upper()
    if code not in SUPPORTED:
        raise ValueError(f"No private-export policy is configured for {code}")
    if not source.is_file():
        raise ValueError(f"Export file does not exist: {source}")
    raw = source.read_bytes()
    if not raw.strip():
        raise ValueError("Refusing to import an empty export")
    payload = json.loads(raw.decode("utf-8-sig"))
    config = SUPPORTED[code]
    if payload.get("type") == "FeatureCollection":
        input_features = payload.get("features")
        if not isinstance(input_features, list):
            raise ValueError("GeoJSON export has no features array")
    else:
        input_features = normalize_ed269(
            payload,
            attribution=config["authority"],
            source_url=config["sourceUrl"],
        )
    imported_at = datetime.now(timezone.utc).isoformat()
    normalized = [
        normalize_feature(
            feature,
            country=code,
            authority=config["authority"],
            source_url=config["sourceUrl"],
            layer_name=config["layerName"],
            imported_at=imported_at,
        )
        for feature in input_features
    ]
    unique, duplicates = deduplicate_features(normalized)
    collection = {
        "type": "FeatureCollection",
        "privatePersonalUseOnly": True,
        "countryCode": code,
        "authority": config["authority"],
        "sourceUrl": config["sourceUrl"],
        "sourceFileSha256": hashlib.sha256(raw).hexdigest(),
        "importedAt": imported_at,
        "duplicatesDiscarded": duplicates,
        "features": unique,
    }
    validation = validate_dataset(collection)
    if not validation["valid"]:
        raise ValueError(
            "Private export failed validation: "
            + "; ".join(item["message"] for item in validation["errors"][:5])
        )
    target = output or ROOT / "private-data" / code.lower() / "zones.geojson"
    try:
        target.relative_to(ROOT / "private-data")
    except ValueError as error:
        raise ValueError("Private exports must stay below private-data/") from error
    atomic_json(target, collection)
    return {
        "countryCode": code,
        "output": str(target),
        "featureCount": len(unique),
        "duplicateCount": len(duplicates),
        "warnings": validation["warnings"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country", required=True)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = import_export(args.country, args.input, args.output)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
