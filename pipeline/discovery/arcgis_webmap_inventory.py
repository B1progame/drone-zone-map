"""Inventory a public ArcGIS web app/web map and its renderer metadata.

This intentionally reads ArcGIS' structured sharing API.  It does not trace map
pixels, bypass authentication, or download layer geometry.
"""
from __future__ import annotations

from pathlib import Path
import argparse
import json

import httpx

SHARING = "https://www.arcgis.com/sharing/rest/content/items"
HEADERS = {"User-Agent": "DroneZoneMapSourceAuditor/0.1"}


def _json(url: str) -> dict:
    response = httpx.get(url, params={"f": "json"}, headers=HEADERS, follow_redirects=True, timeout=60)
    response.raise_for_status()
    payload = response.json()
    if payload.get("error"):
        raise ValueError(payload["error"])
    return payload


def inventory(item_id: str) -> dict:
    item = _json(f"{SHARING}/{item_id}")
    data = _json(f"{SHARING}/{item_id}/data")
    webmap_id = (data.get("map") or {}).get("itemId") or item_id
    if webmap_id != item_id:
        webmap_item = _json(f"{SHARING}/{webmap_id}")
        webmap = _json(f"{SHARING}/{webmap_id}/data")
    else:
        webmap_item, webmap = item, data

    layers = []
    for position, layer in enumerate(webmap.get("operationalLayers") or []):
        drawing = layer.get("layerDefinition", {}).get("drawingInfo", {})
        layers.append(
            {
                "position": position,
                "id": layer.get("id"),
                "title": layer.get("title"),
                "url": layer.get("url"),
                "itemId": layer.get("itemId"),
                "visibility": layer.get("visibility", True),
                "opacity": layer.get("opacity", 1),
                "minScale": layer.get("minScale"),
                "maxScale": layer.get("maxScale"),
                "renderer": drawing.get("renderer"),
                "labelingInfo": drawing.get("labelingInfo"),
                "popupInfo": layer.get("popupInfo"),
            }
        )
    return {
        "auditedItem": {
            "id": item_id,
            "title": item.get("title"),
            "owner": item.get("owner"),
            "type": item.get("type"),
            "modified": item.get("modified"),
            "access": item.get("access"),
            "licenseInfo": item.get("licenseInfo"),
            "termsOfUse": item.get("termsOfUse"),
        },
        "webMap": {
            "id": webmap_id,
            "title": webmap_item.get("title"),
            "owner": webmap_item.get("owner"),
            "modified": webmap_item.get("modified"),
            "access": webmap_item.get("access"),
            "licenseInfo": webmap_item.get("licenseInfo"),
            "termsOfUse": webmap_item.get("termsOfUse"),
        },
        "layerCount": len(layers),
        "layers": layers,
        "notice": "Structured metadata inventory only; no geometry or map pixels were copied.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Inventory a public ArcGIS web app or web map")
    parser.add_argument("item_id", help="ArcGIS item ID")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    report = inventory(args.item_id)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {report['layerCount']} public layer definitions to {args.output}")


if __name__ == "__main__":
    main()
