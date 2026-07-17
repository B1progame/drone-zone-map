"""Validate and summarize the complete national-source registry."""
from __future__ import annotations

from collections import Counter
from datetime import date
from pathlib import Path
import argparse
import json
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "public" / "data" / "sources" / "countries.json"
STATUS_DISPOSITIONS = {
    "active": "integrated",
    "vector_supported": "integrated_with_provider_limits",
    "official_link_only": "official_handoff",
}
PLACEHOLDER_WARNINGS = (
    "verification pending",
    "national guidance link only",
    "national source link only",
)


def audit(records: list[dict], *, as_of: str) -> dict:
    errors: list[str] = []
    seen: set[str] = set()
    audited: list[dict] = []
    for index, record in enumerate(records):
        code = record.get("countryCode", "")
        label = code or f"record {index}"
        if len(code) != 2 or code.upper() != code:
            errors.append(f"{label}: countryCode must be two uppercase letters")
        if code in seen:
            errors.append(f"{label}: duplicate countryCode")
        seen.add(code)
        status = record.get("status")
        if status not in STATUS_DISPOSITIONS:
            errors.append(f"{label}: unsupported status {status!r}")
        official_url = record.get("officialMapUrl", "")
        if urlparse(official_url).scheme != "https":
            errors.append(f"{label}: officialMapUrl must be HTTPS")
        warnings = record.get("warnings")
        if not isinstance(warnings, list) or not warnings:
            errors.append(f"{label}: at least one source-specific warning is required")
            warnings = []
        lowered_warnings = " ".join(str(item).lower() for item in warnings)
        for placeholder in PLACEHOLDER_WARNINGS:
            if placeholder in lowered_warnings:
                errors.append(f"{label}: unresolved placeholder warning: {placeholder}")
        if status == "official_link_only" and any(
            record.get(field)
            for field in ("supportsVector", "supportsWms", "supportsFeatureInfo", "supportsOffline")
        ):
            errors.append(f"{label}: link-only source claims an unsupported integration capability")
        audited.append(
            {
                "countryCode": code,
                "countryName": record.get("countryName"),
                "disposition": STATUS_DISPOSITIONS.get(status, "invalid"),
                "sourceType": record.get("sourceType"),
                "officialMapUrl": official_url,
                **({"endpointUrl": record["endpointUrl"]} if record.get("endpointUrl") else {}),
                "supports": {
                    "vector": bool(record.get("supportsVector")),
                    "raster": bool(record.get("supportsWms")),
                    "pointQuery": bool(record.get("supportsFeatureInfo")),
                    "offline": bool(record.get("supportsOffline")),
                },
                "decision": warnings,
            }
        )
    if errors:
        raise ValueError("\n".join(errors))
    counts = Counter(item["disposition"] for item in audited)
    return {
        "auditedAt": as_of,
        "scope": "Every country currently exposed by the Aeris source registry",
        "countryCount": len(audited),
        "dispositionCounts": dict(sorted(counts.items())),
        "records": audited,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", default=date.today().isoformat())
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = audit(json.loads(REGISTRY.read_text(encoding="utf-8")), as_of=args.as_of)
    output = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
        print(f"Wrote {report['countryCount']}-country audit to {args.output}")
    else:
        print(output, end="")


if __name__ == "__main__":
    main()
