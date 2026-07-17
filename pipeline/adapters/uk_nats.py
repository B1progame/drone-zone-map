"""Fetch and normalize NATS' official UK UAS restriction visualization KML."""
from __future__ import annotations

from html import unescape
from io import BytesIO
import re
from zipfile import ZipFile
import xml.etree.ElementTree as ET

import httpx

from .base import FetchResult


class UkNatsAdapter:
    country_code = "GB"
    source_page = "https://nats-uk.ead-it.com/cms-nats/opencms/en/uas-restriction-zones/"
    endpoint = (
        "https://nats-uk.ead-it.com/cms-nats/export/sites/default/en/Publications/"
        "digital-datasets/UAS_AREA_1/EG_UAS_FR_DS_AREA1_FULL_20260709_KML.zip"
    )
    effective_date = "2026-07-09"
    namespace = {"kml": "http://www.opengis.net/kml/2.2"}

    @staticmethod
    def _plain_text(value: str) -> str:
        text = unescape(value or "")
        text = re.sub(r"<br\s*/?>", " · ", text, flags=re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    @staticmethod
    def _ring(value: str) -> list[list[float]]:
        ring = []
        for item in value.split():
            parts = item.split(",")
            if len(parts) >= 2:
                ring.append([float(parts[0]), float(parts[1])])
        return ring

    def _polygon(self, element: ET.Element) -> list[list[list[float]]] | None:
        outer = element.find(
            ".//kml:outerBoundaryIs/kml:LinearRing/kml:coordinates", self.namespace
        )
        if outer is None or not (outer.text or "").strip():
            return None
        rings = [self._ring(outer.text or "")]
        for inner in element.findall(
            ".//kml:innerBoundaryIs/kml:LinearRing/kml:coordinates", self.namespace
        ):
            if (inner.text or "").strip():
                rings.append(self._ring(inner.text or ""))
        return rings

    def _features(self, root: ET.Element) -> list[dict]:
        features: list[dict] = []

        def visit(element: ET.Element, folders: list[str]) -> None:
            for child in element:
                tag = child.tag.rsplit("}", 1)[-1]
                if tag == "Folder":
                    name = child.findtext("kml:name", default="", namespaces=self.namespace)
                    visit(child, [*folders, name])
                elif tag == "Placemark":
                    polygons = [
                        polygon
                        for node in child.findall(".//kml:Polygon", self.namespace)
                        if (polygon := self._polygon(node))
                    ]
                    if not polygons:
                        continue
                    description = self._plain_text(
                        child.findtext("kml:description", default="", namespaces=self.namespace)
                    )
                    name = child.findtext("kml:name", default="UK UAS restriction", namespaces=self.namespace)
                    limits = re.search(
                        r"Upper limit:\s*(.*?)\s*Lower limit:\s*(.*?)\s*(?:Class:|·)",
                        description,
                        flags=re.IGNORECASE,
                    )
                    geometry = (
                        {"type": "Polygon", "coordinates": polygons[0]}
                        if len(polygons) == 1
                        else {"type": "MultiPolygon", "coordinates": polygons}
                    )
                    features.append(
                        {
                            "type": "Feature",
                            "properties": {
                                "identifier": name.split()[0],
                                "name": name,
                                "category": folders[-1] if folders else "UAS restriction",
                                "description": description,
                                "upper": limits.group(1).strip() if limits else None,
                                "lower": limits.group(2).strip() if limits else None,
                                "effective": self.effective_date,
                                "source": "NATS UK AIS",
                            },
                            "geometry": geometry,
                        }
                    )
                else:
                    visit(child, folders)

        visit(root, [])
        return features

    def fetch(self) -> FetchResult:
        response = httpx.get(
            self.endpoint,
            headers={"User-Agent": "Aeris source updater", "Referer": self.source_page},
            follow_redirects=True,
            timeout=60,
        )
        response.raise_for_status()
        with ZipFile(BytesIO(response.content)) as outer_zip:
            kmz_name = next(name for name in outer_zip.namelist() if name.lower().endswith(".kmz"))
            with ZipFile(BytesIO(outer_zip.read(kmz_name))) as kmz:
                kml_name = next(name for name in kmz.namelist() if name.lower().endswith(".kml"))
                root = ET.fromstring(kmz.read(kml_name))
        features = self._features(root)
        if not features:
            raise ValueError("NATS KML contained no polygon features")
        return FetchResult(
            features,
            [
                "NATS visualization only; consult the UK AIP and current NOTAMs.",
                f"Dataset effective {self.effective_date}.",
            ],
        )
