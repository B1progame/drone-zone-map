"""Polite discovery of public geospatial endpoints.

This module does not bypass authentication, bot protection, robots.txt, or terms.
It inventories public URLs for manual review and validates WMS capabilities when
available. A discovered URL is not automatically approved for redistribution.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from html.parser import HTMLParser
import re
import time
from typing import Iterable
from urllib.parse import parse_qs, urljoin, urlparse, urlunparse
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET

import httpx

USER_AGENT = "DroneZoneMapSourceDiscovery/0.1 (+personal research; polite public endpoint inventory)"
GEO_HINTS = ("wms", "wfs", "wmts", "ogc", "geojson", "featureserver", "mapserver", "ed-318", "ed318")
URL_PATTERN = re.compile(r"https?://[^\s\"'<>\\]+", re.IGNORECASE)


class _LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() not in {"a", "link", "script", "iframe"}:
            return
        values = dict(attrs)
        target = values.get("href") or values.get("src")
        if target:
            self.links.append(target)


@dataclass
class Candidate:
    url: str
    kind: str
    status: str = "discovered"
    layers: list[dict[str, str]] = field(default_factory=list)
    note: str = "Manual licence and terms review required."


@dataclass
class DiscoveryReport:
    start_url: str
    fetched_at: str
    robots_allowed: bool
    candidates: list[Candidate]
    warnings: list[str]


def _robots_allowed(client: httpx.Client, url: str) -> bool:
    parsed = urlparse(url)
    robots_url = urlunparse((parsed.scheme, parsed.netloc, "/robots.txt", "", "", ""))
    parser = RobotFileParser(robots_url)
    try:
        response = client.get(robots_url)
        if response.status_code >= 400:
            return True
        parser.parse(response.text.splitlines())
        return parser.can_fetch(USER_AGENT, url)
    except httpx.HTTPError:
        return False


def _kind(url: str) -> str | None:
    lowered = url.lower()
    if "service=wms" in lowered or "/wms" in lowered:
        return "wms"
    if "service=wfs" in lowered or "/wfs" in lowered:
        return "wfs"
    if "wmts" in lowered:
        return "wmts"
    if "featureserver" in lowered:
        return "arcgis_featureserver"
    if "mapserver" in lowered:
        return "arcgis_mapserver"
    if "geojson" in lowered or lowered.endswith((".json", ".geojson")):
        return "json_or_geojson"
    if "ogc" in lowered or "/collections" in lowered:
        return "ogc_api"
    if "ed318" in lowered or "ed-318" in lowered:
        return "ed318"
    return None


def _wms_capabilities_url(url: str) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    query.update({"service": ["WMS"], "request": ["GetCapabilities"]})
    encoded = "&".join(f"{key}={value[0]}" for key, value in query.items())
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, encoded, ""))


def _parse_wms_layers(xml: str) -> list[dict[str, str]]:
    root = ET.fromstring(xml)
    layers: list[dict[str, str]] = []
    for layer in root.findall(".//{*}Layer"):
        name = layer.findtext("{*}Name")
        title = layer.findtext("{*}Title")
        if name:
            layers.append({"name": name, "title": title or name})
    return layers


def discover(start_url: str, *, delay_seconds: float = 1.0, timeout_seconds: float = 20.0) -> DiscoveryReport:
    warnings: list[str] = []
    candidates: dict[str, Candidate] = {}
    with httpx.Client(headers={"User-Agent": USER_AGENT}, follow_redirects=True, timeout=timeout_seconds) as client:
        allowed = _robots_allowed(client, start_url)
        if not allowed:
            return DiscoveryReport(start_url, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), False, [], ["robots.txt does not allow this fetch, or could not be checked safely."])
        response = client.get(start_url)
        response.raise_for_status()
        time.sleep(max(0.0, delay_seconds))
        parser = _LinkParser()
        parser.feed(response.text)
        discovered: Iterable[str] = [urljoin(str(response.url), link) for link in parser.links]
        discovered = list(discovered) + URL_PATTERN.findall(response.text)
        for raw_url in discovered:
            clean_url = raw_url.rstrip(".,);]")
            kind = _kind(clean_url)
            if kind and clean_url not in candidates:
                candidates[clean_url] = Candidate(clean_url, kind)
        for candidate in list(candidates.values())[:20]:
            if candidate.kind != "wms":
                continue
            try:
                capabilities = client.get(_wms_capabilities_url(candidate.url))
                capabilities.raise_for_status()
                candidate.layers = _parse_wms_layers(capabilities.text)
                candidate.status = "capabilities_verified"
                candidate.note = "Public WMS responds. Review licence, attribution, and caching terms before use."
                time.sleep(max(0.0, delay_seconds))
            except (httpx.HTTPError, ET.ParseError) as exc:
                candidate.status = "capabilities_failed"
                candidate.note = f"Candidate found but capabilities validation failed: {type(exc).__name__}"
        if not candidates:
            warnings.append("No obvious geospatial endpoint was present in the public HTML. Inspect documented subpages or a manually supplied public endpoint next.")
    return DiscoveryReport(start_url, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), True, list(candidates.values()), warnings)


def report_as_dict(report: DiscoveryReport) -> dict:
    return asdict(report)


def inspect_known_wms(endpoint_url: str, *, timeout_seconds: float = 20.0) -> Candidate:
    """Inspect a documented WMS endpoint supplied explicitly by the user.

    This is endpoint inspection, not site crawling. Use it only for a public WMS
    whose provider documentation permits access.
    """
    with httpx.Client(headers={"User-Agent": USER_AGENT}, follow_redirects=True, timeout=timeout_seconds) as client:
        response = client.get(_wms_capabilities_url(endpoint_url))
        response.raise_for_status()
        layers = _parse_wms_layers(response.text)
    return Candidate(
        url=endpoint_url,
        kind="wms",
        status="capabilities_verified",
        layers=layers,
        note="Known public WMS responds. Confirm its provider documentation, licence, attribution, and caching terms."
    )
