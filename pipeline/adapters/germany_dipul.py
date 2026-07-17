"""Official DIPUL WMS rendering and viewport-bounded WFS export configuration."""
from __future__ import annotations

import httpx

from .base import FetchResult


class GermanyDipulAdapter:
    country_code = "DE"
    source_page = "https://dipul.bund.de/homepage/en/information/geographical-zones/"
    wms_endpoint = "https://uas-betrieb.de/geoservices/dipul/wms"
    wfs_endpoint = "https://uas-betrieb.de/geoservices/dipul/wfs"
    endpoint = wfs_endpoint
    capabilities_url = f"{wms_endpoint}?service=WMS&version=1.3.0&request=GetCapabilities"
    attribution = "Quelle Geodaten: DFS, BKG 2026 · WFS CC BY-ND 4.0"
    layer_names = (
        "bahnanlagen", "behoerden", "binnenwasserstrassen", "bundesautobahnen",
        "bundesstrassen", "diplomatische_vertretungen", "ffh-gebiete",
        "flugbeschraenkungsgebiete", "flughaefen", "flugplaetze", "freibaeder",
        "industrieanlagen", "internationale_organisationen",
        "justizvollzugsanstalten", "kontrollzonen", "kraftwerke", "krankenhaeuser",
        "labore", "militaerische_anlagen", "nationalparks",
        "naturschutzgebiete", "polizei", "schifffahrtsanlagen", "seewasserstrassen",
        "sicherheitsbehoerden", "stromleitungen", "temporaere_betriebseinschraenkungen",
        "umspannwerke", "vogelschutzgebiete", "windkraftanlagen", "wohngrundstuecke",
    )
    wms_only_layer_names = ("haengegleiter", "modellflugplaetze")

    def fetch(self) -> FetchResult:
        return FetchResult(
            [],
            [
                "Render the official WMS live and use fetch_bbox for exact WFS viewport geometry.",
                "WFS features must remain unmodified under CC BY-ND 4.0 and must not be treated as a cached national snapshot.",
            ],
        )

    def fetch_bbox(
        self,
        bbox: tuple[float, float, float, float],
        *,
        layers: tuple[str, ...] | None = None,
        count: int = 5000,
    ) -> FetchResult:
        west, south, east, north = bbox
        if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
            raise ValueError("Germany bbox must be a valid non-wrapping WGS84 envelope")
        selected = layers or self.layer_names
        unknown = sorted(set(selected) - set(self.layer_names))
        if unknown:
            raise ValueError(f"Unknown DIPUL layers: {', '.join(unknown)}")

        features: list[dict] = []
        warnings: list[str] = []
        headers = {"User-Agent": "AerisDroneMap/0.2 (+https://github.com/B1progame/drone-zone-map)"}
        with httpx.Client(headers=headers, timeout=60, follow_redirects=True) as client:
            for layer in selected:
                response = client.get(
                    self.wfs_endpoint,
                    params={
                        "service": "WFS",
                        "version": "2.0.0",
                        "request": "GetFeature",
                        "typeNames": f"dipul:{layer}",
                        "srsName": "EPSG:4326",
                        "bbox": f"{west},{south},{east},{north},EPSG:4326",
                        "outputFormat": "application/json",
                        "count": count,
                    },
                )
                response.raise_for_status()
                payload = response.json()
                batch = payload.get("features", [])
                if not isinstance(batch, list):
                    raise ValueError(f"DIPUL {layer} response does not contain a GeoJSON feature list")
                if len(batch) >= count:
                    warnings.append(f"DIPUL {layer} reached its {count}-feature viewport limit.")
                for feature in batch:
                    properties = feature.setdefault("properties", {})
                    properties.setdefault("_aerisSource", "DIPUL WFS")
                    properties.setdefault("_aerisLayer", layer)
                features.extend(batch)

        warnings.extend(
            [
                "Live official WFS viewport extract; geometry is retained without simplification under CC BY-ND 4.0.",
                "Confirm the current DIPUL map and temporary restrictions before flight.",
            ]
        )
        return FetchResult(features, warnings)
