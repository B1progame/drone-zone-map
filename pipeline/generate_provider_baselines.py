"""Capture reproducible Germany and France provider baselines before changes.

The report deliberately separates national WFS hit counts from the geometry
checksum. DIPUL's CC BY-ND service is queried for counts nationally, while the
geometry checksum is limited to small representative viewports and no national
snapshot is written.
"""
from __future__ import annotations

from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path
import re

import httpx

from adapters.france_geoportail import FranceGeoportailAdapter
from adapters.germany_dipul import GermanyDipulAdapter


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "reports" / "PROVIDER_BASELINE.json"
USER_AGENT = "AerisDroneMap/0.2 (+https://github.com/B1progame/drone-zone-map)"
GERMANY_POINTS = (
    {"name": "Berlin Brandenburg Airport", "lat": 52.3667, "lng": 13.5033},
    {"name": "Berlin government district", "lat": 52.5208, "lng": 13.3697},
    {"name": "Cologne city centre", "lat": 50.9375, "lng": 6.9603},
    {"name": "Munich city centre", "lat": 48.1372, "lng": 11.5756},
)
GERMANY_GEOMETRY_LAYERS = (
    "behoerden",
    "flugbeschraenkungsgebiete",
    "flughaefen",
    "flugplaetze",
    "kontrollzonen",
    "militaerische_anlagen",
    "naturschutzgebiete",
    "temporaere_betriebseinschraenkungen",
)
FRANCE_VIEWPORTS = (
    {"name": "Paris", "bbox": (2.28, 48.82, 2.42, 48.90)},
    {"name": "Lyon", "bbox": (4.77, 45.71, 4.91, 45.81)},
    {"name": "Réunion", "bbox": (55.43, -21.18, 55.58, -20.87)},
)


def _atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def _canonical_geometry_checksum(features: list[dict]) -> str:
    geometries = [
        json.dumps(feature.get("geometry"), sort_keys=True, separators=(",", ":"))
        for feature in features
    ]
    return hashlib.sha256("\n".join(sorted(geometries)).encode("utf-8")).hexdigest()


def _coverage(features: list[dict], aliases: dict[str, tuple[str, ...]]) -> dict:
    total = len(features)
    coverage: dict[str, dict[str, int | float]] = {}
    for label, keys in aliases.items():
        present = 0
        for feature in features:
            properties = feature.get("properties") or {}
            if (not keys and bool(properties)) or any(
                properties.get(key) not in (None, "", [], {}) for key in keys
            ):
                present += 1
        coverage[label] = {
            "present": present,
            "total": total,
            "percent": round(present * 100 / total, 2) if total else 0,
        }
    return coverage


def _dipul_hits(client: httpx.Client, adapter: GermanyDipulAdapter) -> dict[str, int | None]:
    counts: dict[str, int | None] = {}
    for layer in adapter.layer_names:
        response = client.get(
            adapter.wfs_endpoint,
            params={
                "service": "WFS",
                "version": "2.0.0",
                "request": "GetFeature",
                "typeNames": f"dipul:{layer}",
                "srsName": "EPSG:4326",
                "bbox": "5.5,47,15.5,55.2,EPSG:4326",
                "outputFormat": "application/json",
                "count": "1",
            },
        )
        response.raise_for_status()
        payload = response.json()
        value = payload.get("numberMatched", payload.get("totalFeatures"))
        counts[layer] = int(value) if value not in (None, "unknown") else None
    return counts


def _parse_feature_info(text: str) -> list[dict[str, str]]:
    parsed: list[dict[str, str]] = []
    for block in re.split(r"Results for FeatureType", text)[1:]:
        layer_match = re.search(r"'[^:']+:([^']+)'", block)
        attributes = {}
        for line in block.splitlines():
            match = re.match(r"^([^=]+) = (.*)$", line)
            if match:
                attributes[match.group(1).strip()] = match.group(2).strip()
        parsed.append(
            {
                "layer": layer_match.group(1) if layer_match else "zone",
                **attributes,
            }
        )
    return parsed


def _dipul_point(
    client: httpx.Client,
    adapter: GermanyDipulAdapter,
    point: dict[str, float | str],
) -> dict:
    delta = 0.035
    lat = float(point["lat"])
    lng = float(point["lng"])
    layers = (*adapter.layer_names, *adapter.wms_only_layer_names)
    response = client.get(
        adapter.wms_endpoint,
        params={
            "SERVICE": "WMS",
            "VERSION": "1.1.1",
            "REQUEST": "GetFeatureInfo",
            "LAYERS": ",".join(f"dipul:{layer}" for layer in layers),
            "QUERY_LAYERS": ",".join(f"dipul:{layer}" for layer in layers),
            "STYLES": "",
            "SRS": "EPSG:4326",
            "BBOX": f"{lng-delta},{lat-delta},{lng+delta},{lat+delta}",
            "WIDTH": "256",
            "HEIGHT": "256",
            "X": "128",
            "Y": "128",
            "INFO_FORMAT": "text/plain",
            "FEATURE_COUNT": "100",
        },
    )
    response.raise_for_status()
    matches = _parse_feature_info(response.text)
    return {
        **point,
        "matchCount": len(matches),
        "matches": [
            {
                "layer": match.get("layer"),
                "id": match.get("external_reference") or match.get("id"),
                "name": (
                    match.get("generated_name_EN")
                    or match.get("generated_name_DE")
                    or match.get("name")
                ),
                "type": match.get("type_code"),
                "description": match.get("message") or match.get("description"),
                "lower": " ".join(
                    filter(
                        None,
                        (
                            match.get("lower_limit_altitude"),
                            match.get("lower_limit_unit"),
                            match.get("lower_limit_alt_ref"),
                        ),
                    )
                )
                or None,
                "upper": " ".join(
                    filter(
                        None,
                        (
                            match.get("upper_limit_altitude"),
                            match.get("upper_limit_unit"),
                            match.get("upper_limit_alt_ref"),
                        ),
                    )
                )
                or None,
                "legalReference": match.get("legal_ref"),
                "originalProperties": match,
            }
            for match in matches
        ],
    }


def germany_baseline(client: httpx.Client) -> dict:
    adapter = GermanyDipulAdapter()
    counts = _dipul_hits(client, adapter)
    representative_features: list[dict] = []
    viewport_results: list[dict] = []
    for point in GERMANY_POINTS:
        delta = 0.035
        bbox = (
            float(point["lng"]) - delta,
            float(point["lat"]) - delta,
            float(point["lng"]) + delta,
            float(point["lat"]) + delta,
        )
        result = adapter.fetch_bbox(bbox, layers=GERMANY_GEOMETRY_LAYERS)
        representative_features.extend(result.features)
        viewport_results.append(
            {
                "name": point["name"],
                "bbox": bbox,
                "featureCount": len(result.features),
            }
        )
    point_results = [_dipul_point(client, adapter, point) for point in GERMANY_POINTS]
    known_counts = [count for count in counts.values() if count is not None]
    return {
        "classification": "working-needs-metadata",
        "configuredLayerCount": len(adapter.layer_names) + len(adapter.wms_only_layer_names),
        "configuredWfsLayers": list(adapter.layer_names),
        "configuredWmsOnlyLayers": list(adapter.wms_only_layer_names),
        "nationalWfsFeatureCount": sum(known_counts),
        "nationalWfsFeatureCountsByLayer": counts,
        "nationalCountScope": (
            "WFS numberMatched from a Germany-bounded count=1 query; "
            "no national geometry snapshot downloaded"
        ),
        "representativeGeometryFeatureCount": len(representative_features),
        "representativeGeometryChecksum": _canonical_geometry_checksum(representative_features),
        "geometryChecksumScope": {
            "layers": list(GERMANY_GEOMETRY_LAYERS),
            "viewports": viewport_results,
        },
        "sourceUrls": {
            "authority": adapter.source_page,
            "wms": adapter.wms_endpoint,
            "wfs": adapter.wfs_endpoint,
        },
        "metadataCoverage": _coverage(
            representative_features,
            {
                "officialName": ("generated_name_EN", "generated_name_DE", "name"),
                "officialFeatureId": ("external_reference", "id"),
                "category": ("type_code", "_aerisLayer"),
                "description": ("message", "description"),
                "lowerAltitude": ("lower_limit_altitude",),
                "upperAltitude": ("upper_limit_altitude",),
                "legalReference": ("legal_ref",),
                "originalProperties": tuple(),
            },
        ),
        "representativePointQueries": point_results,
    }


def france_baseline() -> dict:
    adapter = FranceGeoportailAdapter()
    features: list[dict] = []
    viewports: list[dict] = []
    for viewport in FRANCE_VIEWPORTS:
        result = adapter.fetch_bbox(viewport["bbox"])
        features.extend(result.features)
        viewports.append(
            {
                "name": viewport["name"],
                "bbox": viewport["bbox"],
                "featureCount": len(result.features),
                "warnings": result.warnings,
            }
        )
    return {
        "classification": "working-needs-metadata",
        "configuredLayerCount": 1,
        "representativeFeatureCount": len(features),
        "representativeGeometryChecksum": _canonical_geometry_checksum(features),
        "geometryChecksumScope": viewports,
        "sourceUrls": {
            "authority": adapter.source_page,
            "wfs": adapter.endpoint,
        },
        "metadataCoverage": _coverage(
            features,
            {
                "officialName": ("nom", "name", "limite"),
                "category": ("type", "limite", "_aerisLayer"),
                "description": ("remarque", "description"),
                "altitude": ("plafond", "altitude", "hauteur"),
                "officialFeatureId": ("id", "objectid", "gid"),
                "originalProperties": tuple(),
            },
        ),
        "publishedOverseasProbe": next(
            item for item in viewports if item["name"] == "Réunion"
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    with httpx.Client(
        headers={"User-Agent": USER_AGENT},
        timeout=60,
        follow_redirects=True,
    ) as client:
        report = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "purpose": "Pre-change regression baseline for working Germany and France providers",
            "germany": germany_baseline(client),
            "france": france_baseline(),
        }
    _atomic_json(args.output, report)
    print(
        f"Wrote provider baseline to {args.output}: "
        f"DE {report['germany']['nationalWfsFeatureCount']} national WFS hits, "
        f"FR {report['france']['representativeFeatureCount']} representative features"
    )


if __name__ == "__main__":
    main()
