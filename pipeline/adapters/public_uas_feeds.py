"""Verified public national UAS feeds that can be refreshed without scraping."""
from __future__ import annotations

from datetime import datetime
from html.parser import HTMLParser
from io import BytesIO
import json
import re
from urllib.parse import urljoin
from zipfile import ZipFile

import httpx

from .base import FetchResult
from .ed269 import normalize_ed269

HEADERS = {
    "User-Agent": "DroneZoneMapUpdater/0.2 (+https://github.com/B1progame/drone-zone-map)",
    "Accept": "application/geo+json,application/json,text/html,application/zip,*/*",
}


def _get(url: str, *, referer: str | None = None) -> httpx.Response:
    headers = {**HEADERS, **({"Referer": referer} if referer else {})}
    response = httpx.get(url, headers=headers, follow_redirects=True, timeout=90)
    response.raise_for_status()
    return response


class FinlandTraficomAdapter:
    country_code = "FI"
    source_page = "https://www.traficom.fi/fi/miehittamaton-ilmailu/uas-ilmatilavyohykkeet-koneluettavassa-muodossa"
    endpoint = "https://eservices.traficom.fi/Ilmatilasovellus/api/uas-reservations/json?lang=fi"
    attribution = "Source: Finnish Transport and Communications Agency Traficom; modified to GeoJSON; CC BY 4.0"

    def fetch(self) -> FetchResult:
        payload = _get(self.endpoint, referer=self.source_page).json()
        return FetchResult(
            normalize_ed269(payload, attribution=self.attribution, source_url=self.source_page),
            [
                "Machine-readable Traficom UAS zones; check the official map, temporary restrictions and NOTAMs before flight.",
                "Source: Finnish Transport and Communications Agency Traficom; modified to GeoJSON under CC BY 4.0.",
                "A bundled copy may be older than the official service; generatedAt records its refresh time.",
            ],
        )


class NetherlandsIenwAdapter:
    country_code = "NL"
    source_page = "https://www.rijksoverheid.nl/vraag-en-antwoord/drone/waar-mag-ik-vliegen-met-een-drone"
    endpoint = "https://www.nieuwsienw.nl/api/documents/downloadfile?fileid=1650029&forcedownload=true&sectionid=178144"
    attribution = "Ministerie van Infrastructuur en Waterstaat"

    def fetch(self) -> FetchResult:
        payload = _get(self.endpoint, referer=self.source_page).json()
        return FetchResult(
            normalize_ed269(payload, attribution=self.attribution, source_url=self.source_page),
            [
                "Official ED-269 geozones published by the Dutch government; check Aeret and current NOTAMs before flight.",
                "The former PDOK Drone No-Fly Zones services were retired on 1 July 2026 and are not used.",
            ],
        )


class EstoniaEansAdapter:
    country_code = "EE"
    source_page = "https://transpordiamet.ee/en/aviation-and-aviation-safety/flying-drones-estonia/geographical-zones"
    endpoint = "https://utm.eans.ee/avm/utm/uas.geojson"
    attribution = "Estonian Transport Administration / EANS"

    def fetch(self) -> FetchResult:
        payload = _get(self.endpoint, referer=self.source_page).json()
        if payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
            raise ValueError("EANS response is not a GeoJSON FeatureCollection")
        features = []
        for feature in payload["features"]:
            if feature.get("type") != "Feature" or not feature.get("geometry"):
                raise ValueError("EANS response contains an invalid GeoJSON feature")
            normalized = dict(feature)
            properties = dict(feature.get("properties") or {})
            volume = properties.pop("geometry", {})
            if isinstance(volume, dict):
                properties.update(
                    {key: value for key, value in volume.items() if key != "horizontalProjection"}
                )
                properties["sourceGeometryType"] = (
                    (volume.get("horizontalProjection") or {}).get("type")
                )
            authority = (properties.get("zoneAuthority") or [{}])[0]
            if isinstance(authority, dict):
                properties.update(
                    {
                        "authorityName": authority.get("name"),
                        "authorityService": authority.get("service"),
                        "authorityEmail": authority.get("email"),
                        "authorityPhone": authority.get("phone"),
                    }
                )
            properties["attribution"] = self.attribution
            properties["sourceUrl"] = self.source_page
            normalized["properties"] = properties
            features.append(normalized)
        return FetchResult(
            features,
            [
                "Official EANS/Transport Administration GeoJSON snapshot; check the live map and current temporary restrictions before flight.",
                "A bundled copy may be older than the official service; generatedAt records its refresh time.",
            ],
        )


class _LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self.links.append(href)


def _bulgaria_link_score(url: str) -> tuple[int, int, int, str]:
    match = re.search(r"(?<!\d)(\d{2})(\d{2})(\d{4})(?!\d)", url)
    if match:
        day, month, year = map(int, match.groups())
        try:
            datetime(year, month, day)
            return year, month, day, url
        except ValueError:
            pass
    path_date = re.search(r"/(\d{4})-(\d{2})/", url)
    if path_date:
        return int(path_date.group(1)), int(path_date.group(2)), 0, url
    return 0, 0, 0, url


class BulgariaCaaAdapter:
    country_code = "BG"
    source_page = "https://www.caa.bg/bg/category/633/7062"
    attribution = "Bulgarian Civil Aviation Administration"

    def latest_endpoint(self) -> str:
        response = _get(self.source_page)
        parser = _LinkParser()
        parser.feed(response.text)
        candidates = [
            urljoin(self.source_page, href)
            for href in parser.links
            if "bgr_zones" in href.lower() and ".zip" in href.lower()
        ]
        if not candidates:
            raise ValueError("Bulgarian CAA page contains no BGR_ZONES ZIP link")
        return max(candidates, key=_bulgaria_link_score)

    def fetch(self) -> FetchResult:
        endpoint = self.latest_endpoint()
        archive = _get(endpoint, referer=self.source_page).content
        with ZipFile(BytesIO(archive)) as zipped:
            json_names = [name for name in zipped.namelist() if name.lower().endswith(".json")]
            if len(json_names) != 1:
                raise ValueError(f"Expected one JSON file in Bulgarian CAA ZIP; found {len(json_names)}")
            payload = json.loads(zipped.read(json_names[0]).decode("utf-8-sig"))
        features = normalize_ed269(
            payload,
            attribution=self.attribution,
            source_url=self.source_page,
        )
        return FetchResult(
            features,
            [
                f"Official Bulgarian CAA ED-269 package: {endpoint}",
                "Check B-FLIP and active/temporary restrictions before flight; the downloaded geozones are not operational clearance.",
                "Do not redistribute this export until Bulgarian CAA public-sector reuse permission is confirmed.",
            ],
        )
