"""Common schema for private, non-redistributable national map imports.

This module is intentionally dependency-free so scans can be inspected and
validated before any browser automation is started.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import math
import re
from typing import Any, Iterable

SCHEMA_VERSION = "1.0"
SEMANTIC_COLORS = {
    "prohibited": "#ff405b",
    "authorization_required": "#ff9e43",
    "conditional": "#ffd45d",
    "information": "#69bff5",
    "permitted": "#56d78d",
    "unknown": "#8b96a7",
}
VALID_GEOMETRIES = {"Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon"}
ALTITUDE_UNITS = {"M", "FT", "FL"}
ALTITUDE_REFERENCES = {"AGL", "AMSL", "MSL", "SFC", "GND", "UNL"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def classify_category(value: str | None, mapping: dict[str, str] | None = None) -> str:
    """Classify by legal/source text, never by source display colour."""
    raw = (value or "").strip()
    if mapping:
        direct = mapping.get(raw) or mapping.get(raw.casefold())
        if direct in SEMANTIC_COLORS:
            return direct
    text = re.sub(r"[_\W]+", " ", raw.casefold())
    rules = (
        ("prohibited", ("prohibit", "forbidden", "no fly", "excluded")),
        ("authorization_required", ("authoris", "authoriz", "permission required", "approval required")),
        ("conditional", ("conditional", "caution", "restricted", "limitation", "danger")),
        ("permitted", ("explicitly permitted", "no specific restriction", "allowed zone")),
        ("information", ("information", "advisory", "notice")),
    )
    for category, needles in rules:
        if any(needle in text for needle in needles):
            return category
    return "unknown"


def _coordinates(geometry: dict[str, Any] | None) -> Iterable[list[float]]:
    if not geometry:
        return
    coordinates = geometry.get("coordinates")
    if geometry.get("type") == "Point":
        yield coordinates
        return
    stack = [coordinates]
    while stack:
        current = stack.pop()
        if isinstance(current, list) and len(current) >= 2 and all(isinstance(x, (int, float)) for x in current[:2]):
            yield current
        elif isinstance(current, list):
            stack.extend(reversed(current))


def _geometry_fingerprint(geometry: dict[str, Any] | None) -> str:
    canonical = json.dumps(geometry, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:20]


def normalize_feature(
    feature: dict[str, Any],
    *,
    country: str,
    authority: str,
    source_url: str,
    layer_name: str,
    field_map: dict[str, str] | None = None,
    category_map: dict[str, str] | None = None,
    imported_at: str | None = None,
) -> dict[str, Any]:
    """Normalize a captured GeoJSON feature while preserving every source field."""
    field_map = field_map or {}
    original = deepcopy(feature.get("properties") or {})

    def get(name: str, *fallbacks: str) -> Any:
        keys = [field_map.get(name), name, *fallbacks]
        for key in keys:
            if key and original.get(key) not in (None, "", "Nulo"):
                return original[key]
        return None

    source_id = feature.get("id") or get("sourceFeatureId", "OBJECTID", "objectid", "identifier", "id")
    raw_category = str(get("originalCategory", "restriction", "category", "type", "type_code") or "")
    category = classify_category(raw_category, category_map)
    geometry = deepcopy(feature.get("geometry"))
    stable = str(source_id) if source_id is not None else _geometry_fingerprint(geometry)
    props = {
        "schemaVersion": SCHEMA_VERSION,
        "localPrivateImport": True,
        "sourceFeatureId": stable,
        "country": country.upper(),
        "authority": authority,
        "layerName": layer_name,
        "category": category,
        "semanticColor": SEMANTIC_COLORS[category],
        "originalCategory": raw_category or None,
        "originalColor": get("originalColor", "color", "fill", "stroke"),
        "title": get("title", "name", "generated_name_EN", "label") or f"{layer_name} {stable}",
        "description": get("description", "message", "text"),
        "reason": get("reason", "reasons", "purpose"),
        "permittedOperations": get("permittedOperations", "allowedOperations"),
        "prohibitedOperations": get("prohibitedOperations", "forbiddenOperations"),
        "altitudeFloor": get("altitudeFloor", "lower", "lower_limit_altitude"),
        "altitudeCeiling": get("altitudeCeiling", "upper", "upper_limit_altitude"),
        "altitudeUnit": get("altitudeUnit", "uom", "unit", "lower_limit_unit"),
        "altitudeReference": get("altitudeReference", "lowerReference", "lower_limit_alt_ref"),
        "startsAt": get("startsAt", "startDate", "validFrom"),
        "endsAt": get("endsAt", "endDate", "validTo"),
        "schedule": get("schedule", "dailySchedule", "times"),
        "authorizationRequirements": get("authorizationRequirements", "authorization", "permission"),
        "contact": get("contact", "email", "phone"),
        "officialSourceUrl": source_url,
        "popupText": get("popupText", "popup", "message", "description"),
        "warnings": get("warnings", "disclaimer"),
        "sourceUpdatedAt": get("sourceUpdatedAt", "updateDateTime", "updated"),
        "importedAt": imported_at or utc_now(),
        "originalProperties": original,
    }
    return {"type": "Feature", "id": f"{country.upper()}:{layer_name}:{stable}", "geometry": geometry, "properties": props}


def deduplicate_features(features: Iterable[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    unique: list[dict[str, Any]] = []
    duplicates: list[dict[str, Any]] = []
    seen: dict[str, str] = {}
    for feature in features:
        props = feature.get("properties") or {}
        key = "|".join(
            (
                str(props.get("country", "")),
                str(props.get("layerName", "")),
                str(props.get("sourceFeatureId") or _geometry_fingerprint(feature.get("geometry"))),
            )
        )
        if key in seen:
            duplicates.append({"key": key, "kept": seen[key], "discarded": feature.get("id")})
            continue
        seen[key] = str(feature.get("id", key))
        unique.append(feature)
    return unique, duplicates


def _validate_ring(ring: Any) -> str | None:
    if not isinstance(ring, list) or len(ring) < 4:
        return "polygon ring has fewer than four positions"
    if ring[0] != ring[-1]:
        return "polygon ring is not closed"
    return None


def validate_dataset(collection: dict[str, Any]) -> dict[str, Any]:
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    features = collection.get("features")
    if collection.get("type") != "FeatureCollection" or not isinstance(features, list):
        return {"valid": False, "errors": [{"feature": None, "message": "expected a GeoJSON FeatureCollection"}], "warnings": []}
    ids: set[str] = set()
    geometry_keys: set[str] = set()
    for index, feature in enumerate(features):
        fid = str(feature.get("id", index))
        props = feature.get("properties") or {}
        geometry = feature.get("geometry")
        if fid in ids:
            errors.append({"feature": fid, "message": "duplicate feature id"})
        ids.add(fid)
        if not geometry or geometry.get("type") not in VALID_GEOMETRIES:
            errors.append({"feature": fid, "message": "missing or unsupported geometry"})
            continue
        for coordinate in _coordinates(geometry):
            if len(coordinate) < 2 or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in coordinate[:2]):
                errors.append({"feature": fid, "message": "broken coordinate"})
                break
            if not (-180 <= coordinate[0] <= 180 and -90 <= coordinate[1] <= 90):
                errors.append({"feature": fid, "message": "coordinate outside WGS84 bounds"})
                break
        polygons = geometry.get("coordinates", []) if geometry.get("type") == "Polygon" else (
            [ring for polygon in geometry.get("coordinates", []) for ring in polygon] if geometry.get("type") == "MultiPolygon" else []
        )
        for ring in polygons:
            problem = _validate_ring(ring)
            if problem:
                errors.append({"feature": fid, "message": problem})
        geometry_key = _geometry_fingerprint(geometry)
        if geometry_key in geometry_keys:
            warnings.append({"feature": fid, "message": "geometry duplicates another layer or feature"})
        geometry_keys.add(geometry_key)
        for required in ("country", "authority", "layerName", "category", "officialSourceUrl", "importedAt", "originalProperties"):
            if props.get(required) in (None, ""):
                errors.append({"feature": fid, "message": f"missing metadata: {required}"})
        unit = str(props.get("altitudeUnit") or "").upper()
        if unit and unit not in ALTITUDE_UNITS:
            warnings.append({"feature": fid, "message": f"unrecognized altitude unit: {unit}"})
        reference = str(props.get("altitudeReference") or "").upper()
        if reference and reference not in ALTITUDE_REFERENCES:
            warnings.append({"feature": fid, "message": f"unrecognized altitude reference: {reference}"})
        schedule = props.get("schedule")
        if isinstance(schedule, str) and schedule.count(":") % 2:
            warnings.append({"feature": fid, "message": "schedule may be malformed"})
    return {"valid": not errors, "errors": errors, "warnings": warnings}


def repair_safe_geometry(feature: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Only close otherwise usable polygon rings; retain the original geometry."""
    repaired = deepcopy(feature)
    geometry = repaired.get("geometry")
    repairs: list[dict[str, Any]] = []
    if not geometry or geometry.get("type") not in {"Polygon", "MultiPolygon"}:
        return repaired, repairs
    original = deepcopy(geometry)
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    for polygon_index, polygon in enumerate(polygons):
        for ring_index, ring in enumerate(polygon):
            if isinstance(ring, list) and len(ring) >= 3 and ring[0] != ring[-1]:
                ring.append(deepcopy(ring[0]))
                repairs.append({"type": "close-ring", "polygon": polygon_index, "ring": ring_index})
    if repairs:
        props = repaired.setdefault("properties", {})
        props["originalGeometry"] = original
        props["geometryRepairs"] = repairs
    return repaired, repairs
