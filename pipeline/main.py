"""Safe source-registry updater.

This MVP deliberately exports registry metadata only. Country adapters must verify
official public endpoint terms and schema before fetching or publishing geometry.
"""
from pathlib import Path
import argparse
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "public" / "data" / "sources" / "countries.json"

def validate_registry() -> None:
    countries = json.loads(REGISTRY.read_text(encoding="utf-8"))
    print(f"Validated {len(countries)} country source records; no network fetching configured.")

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
    subparsers.add_parser("publish-sweden", help="Publish previously downloaded, unmodified LFV Dronechart GeoJSON layers")
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
