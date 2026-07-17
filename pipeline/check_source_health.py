"""Reachability audit for every official page and endpoint in the source registry.

This is deliberately a shallow, polite check. It reads only an initial response
chunk, follows normal redirects, and never attempts to bypass authentication or
bot protection. A protected response is reported as such, not treated as proof
that the underlying national service is invalid.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
import argparse
import json

import httpx


ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "public" / "data" / "sources" / "countries.json"
USER_AGENT = "AerisSourceAudit/0.2 (+https://github.com/B1progame/drone-zone-map)"


def classify(status_code: int | None, error: str | None = None) -> str:
    if error:
        return "network_error"
    if status_code is None:
        return "network_error"
    if 200 <= status_code < 400:
        return "reachable"
    if status_code in {401, 403, 429}:
        return "protected_or_rate_limited"
    return "unavailable_response"


def probe(url: str, *, timeout: float, request_url: str | None = None) -> dict:
    target = request_url or url
    try:
        with httpx.Client(
            headers={"User-Agent": USER_AGENT, "Range": "bytes=0-4095"},
            timeout=timeout,
            follow_redirects=True,
        ) as client:
            with client.stream("GET", target) as response:
                first_chunk = next(response.iter_bytes(), b"")
                status_code = response.status_code
                return {
                    "url": url,
                    **({"requestUrl": target} if target != url else {}),
                    "finalUrl": str(response.url),
                    "statusCode": status_code,
                    "health": classify(status_code),
                    "contentType": response.headers.get("content-type", "").split(";", 1)[0],
                    "sampleBytes": len(first_chunk),
                }
    except Exception as exc:  # the exact TLS/DNS/timeout failure belongs in the report
        message = f"{type(exc).__name__}: {exc}"
        return {
            "url": url,
            **({"requestUrl": target} if target != url else {}),
            "health": classify(None, message),
            "error": message,
        }


def audit_sources(records: list[dict], *, timeout: float, max_workers: int) -> dict:
    jobs: list[tuple[str, str, str, str | None]] = []
    for record in records:
        code = record["countryCode"]
        jobs.append((code, "officialMapUrl", record["officialMapUrl"], None))
        if record.get("endpointUrl"):
            endpoint = record["endpointUrl"]
            request_url = None
            if "WFS" in record.get("sourceType", ""):
                separator = "&" if "?" in endpoint else "?"
                request_url = (
                    f"{endpoint}{separator}service=WFS&request=GetCapabilities&version=2.0.0"
                )
            jobs.append((code, "endpointUrl", endpoint, request_url))

    results: dict[tuple[str, str], dict] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(probe, url, timeout=timeout, request_url=request_url): (code, kind)
            for code, kind, url, request_url in jobs
        }
        for future in as_completed(futures):
            results[futures[future]] = future.result()

    audited = []
    for record in records:
        code = record["countryCode"]
        checks = {"officialMapUrl": results[(code, "officialMapUrl")]}
        if record.get("endpointUrl"):
            checks["endpointUrl"] = results[(code, "endpointUrl")]
        audited.append(
            {
                "countryCode": code,
                "countryName": record["countryName"],
                "status": record["status"],
                "checks": checks,
            }
        )

    health_counts: dict[str, int] = {}
    for result in results.values():
        health = result["health"]
        health_counts[health] = health_counts.get(health, 0) + 1
    return {
        "auditedAt": datetime.now(timezone.utc).isoformat(),
        "scope": "Every official page and endpoint registered by Aeris",
        "countryCount": len(records),
        "requestCount": len(jobs),
        "healthCounts": dict(sorted(health_counts.items())),
        "interpretation": (
            "Reachability is a transport check, not legal approval or proof of data completeness. "
            "Protected services remain official handoffs and are not bypassed."
        ),
        "records": audited,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--timeout", type=float, default=20)
    parser.add_argument("--max-workers", type=int, default=6)
    args = parser.parse_args()
    records = json.loads(REGISTRY.read_text(encoding="utf-8"))
    report = audit_sources(
        records,
        timeout=max(2, args.timeout),
        max_workers=max(1, min(args.max_workers, 8)),
    )
    output = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
        print(
            f"Checked {report['requestCount']} URLs across {report['countryCount']} countries; "
            f"wrote {args.output}"
        )
    else:
        print(output, end="")


if __name__ == "__main__":
    main()
