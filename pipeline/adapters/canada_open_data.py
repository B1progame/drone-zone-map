"""Fetch only redistributable Government of Canada drone-planning context.

The NRC Drone Site Selection Tool states that its NAV CANADA-derived database
may not be redistributed. This adapter therefore does not inspect private
application calls or reproduce those protected shapes. It downloads the two
official Open Government layers Aeris is allowed to reuse:

* Transport Canada airports with air-navigation services
* NRCan national parks and national park reserves
"""
from __future__ import annotations

import json
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .base import FetchResult


class CanadaOpenDataAdapter:
    country_code = "CA"
    AIRPORTS = "https://maps-cartes.services.geo.ca/server_serveur/rest/services/TC/canadian_airports_w_air_navigation_services_en/MapServer/0"
    PARKS = "https://proxyinternet.nrcan-rncan.gc.ca/arcgis/rest/services/CLSS-SATC/CLSS_Administrative_Boundaries/MapServer/1"
    USER_AGENT = "AerisDroneMap/1.0 (+https://github.com/B1progame/drone-zone-map)"

    @classmethod
    def _page(cls, endpoint: str, offset: int, count: int) -> dict:
        params = urlencode(
            {
                "where": "1=1",
                "outFields": "*",
                "returnGeometry": "true",
                "outSR": "4326",
                "resultOffset": str(offset),
                "resultRecordCount": str(count),
                "f": "geojson",
            }
        )
        request = Request(f"{endpoint}/query?{params}", headers={"User-Agent": cls.USER_AGENT})
        with urlopen(request, timeout=60) as response:
            payload = json.load(response)
        if payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
            raise RuntimeError(f"Official ArcGIS endpoint returned invalid GeoJSON: {endpoint}")
        return payload

    @classmethod
    def _all(cls, endpoint: str, source_id: str, page_size: int = 1000) -> list[dict]:
        features: list[dict] = []
        offset = 0
        while True:
            page = cls._page(endpoint, offset, page_size)
            batch = page["features"]
            for feature in batch:
                properties = feature.setdefault("properties", {})
                properties["_aeris_source"] = source_id
                properties["_aeris_licence"] = "Open Government Licence - Canada"
            features.extend(batch)
            if len(batch) < page_size and not page.get("properties", {}).get("exceededTransferLimit"):
                break
            offset += len(batch)
            if not batch:
                break
            time.sleep(0.35)
        return features

    def fetch(self) -> FetchResult:
        airports = self._all(self.AIRPORTS, "transport-canada-airports")
        parks = self._all(self.PARKS, "nrcan-national-parks", page_size=200)
        return FetchResult(
            features=[*airports, *parks],
            warnings=[
                "This export contains open federal airports and national-park boundaries only.",
                "It is not the complete NRC Drone Site Selection Tool database.",
                "NAV CANADA-derived shapes are intentionally excluded because the NRC prohibits redistribution.",
            ],
        )
