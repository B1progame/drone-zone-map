"""Fetch LFV Dronechart's documented public WFS layers without altering geometry."""
from __future__ import annotations

from pathlib import Path
import json
import time

import httpx


class SwedenLfvAdapter:
    country_code = "SE"
    endpoint = "https://daim.lfv.se/geoserver/wfs"
    documentation = "https://daim.lfv.se/echarts/dronechart/API/"
    layers = (
        "mais:TIZ",
        "mais:RSTA",
        "mais:DNGA",
        "mais:CTR",
        "mais:ATZ",
        "mais:ARP",
        "dynais:NOTAM",
        "DAIM_TOPO:SUP",
        "DAIM_TOPO:RWY5K",
        "DAIM_TOPO:HKP1K",
    )

    def update(self, target: Path, delay_seconds: float = 0.6) -> dict[str, int]:
        target.mkdir(parents=True, exist_ok=True)
        counts: dict[str, int] = {}
        headers = {"User-Agent": "AerisAirspace-NonCommercial/1.0", "Accept": "application/json"}
        with httpx.Client(headers=headers, follow_redirects=True, timeout=90) as client:
            for index, layer in enumerate(self.layers):
                response = client.get(
                    self.endpoint,
                    params={
                        "service": "WFS",
                        "version": "1.1.0",
                        "request": "GetFeature",
                        "typename": layer,
                        "outputFormat": "application/json",
                        "srsname": "EPSG:4326",
                    },
                )
                response.raise_for_status()
                payload = response.json()
                if payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
                    raise ValueError(f"LFV layer {layer} is not a GeoJSON FeatureCollection")
                filename = layer.replace(":", "-") + ".geojson"
                # Preserve the official response bytes. Display filtering happens in MapLibre.
                (target / filename).write_bytes(response.content)
                counts[layer] = len(payload["features"])
                if index + 1 < len(self.layers):
                    time.sleep(max(0.5, delay_seconds))
        return counts
