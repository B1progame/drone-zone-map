"""Normalize EUROCAE ED-269-style UAS zone JSON to displayable GeoJSON.

The common format stores one or more vertical volumes in ``feature.geometry``.
Each volume contains a GeoJSON polygon or a metric circle under
``horizontalProjection``.  GeoJSON has no circle geometry, so circles are
approximated with geodesic polygons while the original radius and center remain
available in the feature properties.
"""
from __future__ import annotations

from copy import deepcopy
from math import asin, atan2, cos, pi, radians, sin
from typing import Any

EARTH_RADIUS_METRES = 6_371_008.8


def circle_polygon(center: list[float], radius_metres: float, segments: int = 96) -> dict:
    if len(center) < 2 or not all(isinstance(value, (int, float)) for value in center[:2]):
        raise ValueError("Circle center must contain numeric longitude and latitude")
    if not isinstance(radius_metres, (int, float)) or radius_metres <= 0:
        raise ValueError("Circle radius must be a positive number")
    if segments < 24:
        raise ValueError("Circle approximation needs at least 24 segments")

    longitude, latitude = map(radians, center[:2])
    angular_distance = float(radius_metres) / EARTH_RADIUS_METRES
    ring: list[list[float]] = []
    for index in range(segments):
        bearing = 2 * pi * index / segments
        target_latitude = asin(
            sin(latitude) * cos(angular_distance)
            + cos(latitude) * sin(angular_distance) * cos(bearing)
        )
        target_longitude = longitude + atan2(
            sin(bearing) * sin(angular_distance) * cos(latitude),
            cos(angular_distance) - sin(latitude) * sin(target_latitude),
        )
        lng = (target_longitude * 180 / pi + 540) % 360 - 180
        ring.append([round(lng, 8), round(target_latitude * 180 / pi, 8)])
    ring.append(ring[0])
    return {"type": "Polygon", "coordinates": [ring]}


def _projection(volume: dict[str, Any]) -> tuple[dict, dict]:
    projection = volume.get("horizontalProjection")
    if not isinstance(projection, dict):
        raise ValueError("ED-269 volume has no horizontalProjection")
    geometry_type = projection.get("type")
    if geometry_type in {"Polygon", "MultiPolygon"}:
        if not projection.get("coordinates"):
            raise ValueError(f"{geometry_type} projection has no coordinates")
        return deepcopy(projection), {"sourceGeometryType": geometry_type}
    if geometry_type == "Circle":
        center, radius = projection.get("center"), projection.get("radius")
        geometry = circle_polygon(center, radius)
        return geometry, {
            "sourceGeometryType": "Circle",
            "circleCenter": center,
            "circleRadiusMetres": radius,
        }
    raise ValueError(f"Unsupported ED-269 horizontal projection: {geometry_type!r}")


def normalize_ed269(payload: dict, *, attribution: str, source_url: str) -> list[dict]:
    zones = payload.get("features")
    if not isinstance(zones, list):
        raise ValueError("ED-269 response has no features array")

    features: list[dict] = []
    for zone_index, zone in enumerate(zones):
        if not isinstance(zone, dict):
            raise ValueError(f"ED-269 feature {zone_index} is not an object")
        volumes = zone.get("geometry")
        if isinstance(volumes, dict):
            volumes = [volumes]
        if not isinstance(volumes, list):
            raise ValueError(f"ED-269 feature {zone_index} has no geometry volumes")

        shared = {key: deepcopy(value) for key, value in zone.items() if key != "geometry"}
        authority = (zone.get("zoneAuthority") or [{}])[0]
        if not isinstance(authority, dict):
            authority = {}
        for volume_index, volume in enumerate(volumes):
            if not isinstance(volume, dict):
                raise ValueError(f"ED-269 feature {zone_index} volume {volume_index} is invalid")
            geometry, projection_metadata = _projection(volume)
            properties = {
                **shared,
                **{key: deepcopy(value) for key, value in volume.items() if key != "horizontalProjection"},
                **projection_metadata,
                "volumeIndex": volume_index,
                "authorityName": authority.get("name"),
                "authorityService": authority.get("service"),
                "authorityEmail": authority.get("email"),
                "authorityPhone": authority.get("phone"),
                "attribution": attribution,
                "sourceUrl": source_url,
            }
            identifier = zone.get("identifier") or f"zone-{zone_index}"
            features.append(
                {
                    "type": "Feature",
                    "id": f"{identifier}-{volume_index}",
                    "properties": properties,
                    "geometry": geometry,
                }
            )
    return features
