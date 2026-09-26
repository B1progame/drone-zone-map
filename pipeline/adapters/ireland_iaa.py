"""Download Ireland's official, explicitly published UAS GeoJSON file."""
from __future__ import annotations

import httpx
import json
import shutil
import subprocess
import re
from html import unescape
from datetime import date
from urllib.parse import urljoin

from .base import FetchResult


class IrelandIaaAdapter:
    country_code = "IE"
    source_page = "https://www.iaa.ie/general-aviation/drones/uas-geographic-zones"
    filename_pattern = re.compile(r"(\d{8}_uas_zones_ireland_v1\.geojson(?:\?[^\"'<>\s]*)?)", re.I)

    def _current_endpoint(self, headers: dict[str, str]) -> str:
        page = httpx.get(self.source_page, headers=headers, follow_redirects=True, timeout=60)
        page.raise_for_status()
        candidates = self.filename_pattern.findall(page.text)
        dated = []
        for candidate in candidates:
            candidate = unescape(candidate)
            match = re.match(r"(\d{8})_", candidate)
            if match:
                effective = date(int(match[1][:4]), int(match[1][4:6]), int(match[1][6:8]))
                if effective <= date.today():
                    dated.append((effective, candidate))
        if not dated:
            raise ValueError("IAA official page has no current dated GeoJSON download")
        return urljoin(self.source_page, "/docs/default-source/default-document-library/uas/" + max(dated)[1])

    def fetch(self) -> FetchResult:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
            "Accept": "application/geo+json,application/json,text/plain,*/*",
            "Referer": self.source_page,
        }
        try:
            endpoint = self._current_endpoint(headers)
            response = httpx.get(endpoint, headers=headers, follow_redirects=True, timeout=60)
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPStatusError as error:
            # IAA's CDN currently rejects common HTTP-library TLS fingerprints with
            # 403 while serving the same public download to browsers. Curl provides
            # a standards-compliant fallback; arguments are fixed and never use a shell.
            if error.response.status_code != 403:
                raise
            curl = shutil.which("curl") or shutil.which("curl.exe")
            if not curl:
                raise RuntimeError("IAA returned 403 and curl is not installed") from error
            completed = subprocess.run(
                [
                    curl,
                    "--fail",
                    "--location",
                    "--compressed",
                    "--silent",
                    "--show-error",
                    "--user-agent",
                    headers["User-Agent"],
                    "--header",
                    f"Accept: {headers['Accept']}",
                    "--header",
                    f"Referer: {headers['Referer']}",
                    endpoint,
                ],
                check=True,
                stdout=subprocess.PIPE,
            )
            payload = json.loads(completed.stdout.decode("utf-8-sig"))
        if payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
            raise ValueError("IAA response is not a GeoJSON FeatureCollection")
        features = payload["features"]
        for feature in features:
            if not isinstance(feature, dict) or feature.get("type") != "Feature" or not feature.get("geometry"):
                raise ValueError("IAA response contains an invalid GeoJSON feature")
        return FetchResult(
            features,
            [
                "IAA: reference only, not to be used for navigation.",
                "Always check current TRAs, NOTAMs and the official IAA file before flight.",
            ],
        )
