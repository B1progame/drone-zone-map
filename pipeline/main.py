"""Safe source-registry updater.

This MVP deliberately exports registry metadata only. Country adapters must verify
official public endpoint terms and schema before fetching or publishing geometry.
"""
from pathlib import Path
import argparse
from datetime import datetime, timezone
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "public" / "data" / "sources" / "countries.json"

def validate_registry() -> None:
    countries = json.loads(REGISTRY.read_text(encoding="utf-8"))
    print(f"Validated {len(countries)} country source records; no network fetching configured.")

def write_zone_file(country_code: str, result, *, source_page: str, endpoint: str | None = None) -> Path:
    target = ROOT / "public" / "data" / "zones" / f"{country_code}.geojson"
    target.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "sourcePage": source_page,
                **({"endpoint": endpoint} if endpoint else {}),
                "warnings": result.warnings,
                "features": result.features,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    return target

def main() -> None:
    parser = argparse.ArgumentParser(description="Drone Zone Map source pipeline")
    subparsers = parser.add_subparsers(dest="command")
    discovery = subparsers.add_parser("discover", help="Inspect a public official page for geospatial endpoint candidates")
    discovery.add_argument("url", help="Official public page URL")
    discovery.add_argument("--output", type=Path, help="Write JSON report to this path")
    discovery.add_argument("--delay", type=float, default=1.0, help="Delay between public requests (default: 1 second)")
    wms = subparsers.add_parser("inspect-wms", help="Inspect a documented public WMS endpoint supplied explicitly")
    wms.add_argument("url", help="Known public WMS service URL")
    wms.add_argument("--output", type=Path, help="Write JSON report to this path")
    subparsers.add_parser("update-luxembourg", help="Fetch and normalize Luxembourg's official CC0 UAS zones")
    subparsers.add_parser("update-ireland", help="Fetch Ireland's official published UAS GeoJSON")
    subparsers.add_parser("update-uk", help="Fetch and normalize NATS' official UK UAS KML")
    canada=subparsers.add_parser("update-canada-open", help="Fetch redistributable Canadian federal airport and national-park GeoJSON")
    canada.add_argument("--output",type=Path,required=True,help="Output .geojson path; protected NAV CANADA shapes are never included")
    subparsers.add_parser("publish-sweden", help="Publish previously downloaded, unmodified LFV Dronechart GeoJSON layers")
    subparsers.add_parser("update-sweden", help="Fetch all documented LFV Dronechart WFS layers without modifying geometry")
    subparsers.add_parser("update-finland", help="Fetch and normalize Traficom's official machine-readable UAS zones")
    subparsers.add_parser("update-netherlands", help="Fetch and normalize the Dutch government's official ED-269 zones")
    subparsers.add_parser("update-estonia", help="Export EANS' official live UAS GeoJSON for local inspection")
    subparsers.add_parser("update-bulgaria", help="Export the latest Bulgarian CAA UAS ZIP for local inspection")
    slovakia = subparsers.add_parser("inspect-slovakia", help="Inventory the latest Slovak Transport Authority KML package")
    slovakia.add_argument("--output", type=Path, help="Write the structured package inventory to JSON")
    subparsers.add_parser("update-public-geozones", help="Refresh redistributable Finland and Netherlands snapshots")
    spain=subparsers.add_parser("fetch-spain-bbox",help="Download official ENAIRE GeoJSON for a small WGS84 viewport")
    spain.add_argument("--bbox",required=True,help="west,south,east,north within Spain service extent")
    spain.add_argument("--output",type=Path,required=True,help="Output .geojson path")
    args = parser.parse_args()
    if args.command == "discover":
        from discovery.public_endpoint_discovery import discover, report_as_dict
        report = report_as_dict(discover(args.url, delay_seconds=max(0.5, args.delay)))
        output = json.dumps(report, indent=2, ensure_ascii=False)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(output + "\n", encoding="utf-8")
            print(f"Wrote discovery report to {args.output}")
        else:
            print(output)
        return
    if args.command == "inspect-wms":
        from dataclasses import asdict
        from discovery.public_endpoint_discovery import inspect_known_wms
        output = json.dumps(asdict(inspect_known_wms(args.url)), indent=2, ensure_ascii=False)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(output + "\n", encoding="utf-8")
            print(f"Wrote WMS inspection report to {args.output}")
        else:
            print(output)
        return
    if args.command == "update-luxembourg":
        from adapters.luxembourg_geojson import LuxembourgGeojsonAdapter
        result=LuxembourgGeojsonAdapter().fetch()
        target=ROOT / "public" / "data" / "zones" / "LU.geojson"
        target.write_text(json.dumps({"type":"FeatureCollection","features":result.features,"warnings":result.warnings},ensure_ascii=False,separators=(",",":")),encoding="utf-8")
        print(f"Wrote {len(result.features)} Luxembourg zone volumes to {target}")
        return
    if args.command == "update-ireland":
        from adapters.ireland_iaa import IrelandIaaAdapter
        result = IrelandIaaAdapter().fetch()
        target = ROOT / "public" / "data" / "zones" / "IE.geojson"
        target.write_text(
            json.dumps(
                {"type": "FeatureCollection", "features": result.features, "warnings": result.warnings},
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            encoding="utf-8",
        )
        print(f"Wrote {len(result.features)} official IAA zones to {target}")
        return
    if args.command == "update-uk":
        from adapters.uk_nats import UkNatsAdapter
        result = UkNatsAdapter().fetch()
        target = ROOT / "public" / "data" / "zones" / "GB.geojson"
        target.write_text(
            json.dumps(
                {"type": "FeatureCollection", "features": result.features, "warnings": result.warnings},
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            encoding="utf-8",
        )
        print(f"Wrote {len(result.features)} official NATS UK zones to {target}")
        return
    if args.command == "inspect-slovakia":
        from adapters.public_uas_feeds import SlovakiaTransportAuthorityInspector
        report = SlovakiaTransportAuthorityInspector().inspect()
        output = json.dumps(report, indent=2, ensure_ascii=False)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(output + "\n", encoding="utf-8")
            print(f"Wrote Slovak KML package inventory to {args.output}")
        else:
            print(output)
        return
    if args.command == "update-canada-open":
        from adapters.canada_open_data import CanadaOpenDataAdapter
        result=CanadaOpenDataAdapter().fetch()
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(
            json.dumps(
                {
                    "type":"FeatureCollection",
                    "features":result.features,
                    "warnings":result.warnings,
                    "officialMap":"https://nrc.canada.ca/en/drone-tool-2/map.html",
                },
                ensure_ascii=False,
                separators=(",",":"),
            ),
            encoding="utf-8",
        )
        print(f"Wrote {len(result.features)} redistributable Canadian open-data features to {args.output}")
        print("Protected NAV CANADA-derived shapes were not requested or exported.")
        return
    if args.command == "publish-sweden":
        source = ROOT / "exports" / "requested" / "sweden"
        target = ROOT / "public" / "data" / "zones" / "sweden"
        files = sorted(source.glob("*.geojson"))
        if len(files) != 10:
            raise SystemExit(f"Expected 10 official LFV layers in {source}; found {len(files)}")
        target.mkdir(parents=True, exist_ok=True)
        for item in files:
            # Keep LFV output unmodified; its published terms prohibit derivatives.
            shutil.copyfile(item, target / item.name)
        print(f"Published {len(files)} unmodified LFV layers to {target}")
        return
    if args.command == "update-sweden":
        from adapters.sweden_lfv import SwedenLfvAdapter
        target = ROOT / "public" / "data" / "zones" / "sweden"
        counts = SwedenLfvAdapter().update(target)
        print(f"Wrote {sum(counts.values())} features across {len(counts)} official LFV layers to {target}")
        return
    if args.command in {"update-finland", "update-netherlands", "update-estonia", "update-bulgaria", "update-public-geozones"}:
        from adapters.public_uas_feeds import (
            BulgariaCaaAdapter,
            EstoniaEansAdapter,
            FinlandTraficomAdapter,
            NetherlandsIenwAdapter,
        )
        adapters = {
            "update-finland": [FinlandTraficomAdapter()],
            "update-netherlands": [NetherlandsIenwAdapter()],
            "update-estonia": [EstoniaEansAdapter()],
            "update-bulgaria": [BulgariaCaaAdapter()],
            "update-public-geozones": [
                FinlandTraficomAdapter(),
                NetherlandsIenwAdapter(),
            ],
        }[args.command]
        for adapter in adapters:
            endpoint = getattr(adapter, "endpoint", None)
            result = adapter.fetch()
            if adapter.country_code in {"EE", "BG"}:
                target = ROOT / "exports" / "requested" / adapter.country_code.lower() / f"{adapter.country_code}.geojson"
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(
                    json.dumps(
                        {
                            "type": "FeatureCollection",
                            "generatedAt": datetime.now(timezone.utc).isoformat(),
                            "sourcePage": adapter.source_page,
                            "warnings": result.warnings,
                            "features": result.features,
                        },
                        ensure_ascii=False,
                        separators=(",", ":"),
                    ),
                    encoding="utf-8",
                )
            else:
                target = write_zone_file(
                    adapter.country_code,
                    result,
                    source_page=adapter.source_page,
                    endpoint=endpoint,
                )
            print(f"Wrote {len(result.features)} official {adapter.country_code} zone volumes to {target}")
        return
    if args.command == "fetch-spain-bbox":
        from adapters.spain_enaire import SpainEnaireAdapter
        bbox=tuple(float(value) for value in args.bbox.split(","))
        if len(bbox)!=4: raise SystemExit("--bbox needs west,south,east,north")
        result=SpainEnaireAdapter().fetch_bbox(bbox)
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps({"type":"FeatureCollection","features":result.features,"warnings":result.warnings},ensure_ascii=False,separators=(",",":")),encoding="utf-8")
        print(f"Wrote {len(result.features)} official ENAIRE features to {args.output}")
        return
    validate_registry()

if __name__ == "__main__":
    main()
