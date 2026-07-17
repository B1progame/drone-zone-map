"""Viewport-bounded access to IGN's official French UAS WMTS/WFS services."""
from __future__ import annotations

import httpx

from .base import FetchResult


class FranceGeoportailAdapter:
    country_code = "FR"
    source_page = (
        "https://www.geoportail.gouv.fr/donnees/"
        "restrictions-uas-categorie-ouverte-et-aeromodelisme"
    )
    endpoint = "https://data.geopf.fr/wfs/ows"
    type_name = "TRANSPORTS.DRONES.RESTRICTIONS:carte_restriction_drones_lf"
    attribution = "Restrictions UAS © IGN / Géoportail"

    def fetch(self) -> FetchResult:
        return FetchResult(
            [],
            [
                "Use fetch_bbox for an exact live WFS viewport extract; the app does not bundle or simplify this dataset.",
                "The published layer excludes temporary restrictions; consult SIA and current NOTAMs before flight.",
            ],
        )

    def fetch_bbox(
        self,
        bbox: tuple[float, float, float, float],
        *,
        page_size: int = 2500,
        max_pages: int = 4,
    ) -> FetchResult:
        west, south, east, north = bbox
        if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
            raise ValueError("France bbox must be a valid non-wrapping WGS84 envelope")
        if page_size < 1 or page_size > 7500:
            raise ValueError("page_size must be between 1 and 7500")

        features: list[dict] = []
        warnings: list[str] = []
        headers = {"User-Agent": "AerisDroneMap/0.2 (+https://github.com/B1progame/drone-zone-map)"}
        with httpx.Client(headers=headers, timeout=60, follow_redirects=True) as client:
            for page in range(max_pages):
                response = client.get(
                    self.endpoint,
                    params={
                        "service": "WFS",
                        "version": "2.0.0",
                        "request": "GetFeature",
                        "typeNames": self.type_name,
                        "srsName": "EPSG:4326",
                        "bbox": f"{west},{south},{east},{north},EPSG:4326",
                        "outputFormat": "application/json",
                        "count": page_size,
                        "startIndex": page * page_size,
                    },
                )
                response.raise_for_status()
                payload = response.json()
                batch = payload.get("features", [])
                if not isinstance(batch, list):
                    raise ValueError("IGN WFS response does not contain a GeoJSON feature list")
                for feature in batch:
                    properties = feature.setdefault("properties", {})
                    properties.setdefault("_aerisSource", "IGN / Géoportail WFS")
                    properties.setdefault("_aerisLayer", self.type_name)
                features.extend(batch)
                if len(batch) < page_size:
                    break
            else:
                warnings.append(
                    f"Stopped after {max_pages * page_size} features; use a smaller viewport if the WFS reports more."
                )

        warnings.extend(
            [
                "Live official viewport extract; geometry is retained without simplification.",
                "Temporary restrictions are not included in the published layer; check SIA and current NOTAMs.",
            ]
        )
        return FetchResult(features, warnings)
