"""Discover public zone feeds and build independent, inspectable local maps.

Examples:
 python pipeline/zone_map_tool.py scan https://example.org/zones --output private-data/scan.json
 python pipeline/zone_map_tool.py refresh-swiss
 python pipeline/zone_map_tool.py germany --bbox 8.9 47.45 9.9 47.85 --layers kontrollzonen naturschutzgebiete
 python pipeline/zone_map_tool.py build zones.json --country AT --output private-data/at
"""
from __future__ import annotations
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import httpx
try:
    from .adapters.ed269 import normalize_ed269
    from .adapters.germany_dipul import GermanyDipulAdapter
    from .discovery.public_endpoint_discovery import discover, report_as_dict, _robots_allowed
except ImportError:
    from adapters.ed269 import normalize_ed269
    from adapters.germany_dipul import GermanyDipulAdapter
    from discovery.public_endpoint_discovery import discover, report_as_dict, _robots_allowed

ROOT = Path(__file__).resolve().parents[1]
SWISS_URL = 'https://data.geo.admin.ch/ch.bazl.einschraenkungen-drohnen/einschraenkungen-drohnen/einschraenkungen-drohnen_4326.geojson'

def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(path)


def validate(data):
    if data.get('type') != 'FeatureCollection' or not isinstance(data.get('features'), list) or not data['features']:
        raise ValueError('A nonempty FeatureCollection is required')
    def coordinates(node):
        if not isinstance(node, list) or not node:
            return False
        if isinstance(node[0], (float, int)):
            import math
            return len(node) >= 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in node) and -180 <= node[0] <= 180 and -90 <= node[1] <= 90
        return all(coordinates(child) for child in node)
    for feature in data['features']:
        geometry = feature.get('geometry') or {}
        if geometry.get('type') not in ('Polygon', 'MultiPolygon') or not coordinates(geometry.get('coordinates')):
            raise ValueError('Every zone must have valid WGS84 Polygon/MultiPolygon coordinates')
    return data


def build(payload, output, country, source):
    if isinstance(payload, dict) and payload.get('type') == 'FeatureCollection' and all(isinstance(f.get('geometry'), dict) and f['geometry'].get('type') for f in payload.get('features', [])):
        data = payload
    else:
        data = {'type': 'FeatureCollection', 'features': normalize_ed269(payload, attribution=country, source_url=source)}
    validate(data)
    output = Path(output)
    write_json(output / 'zones.geojson', data)
    write_json(output / 'manifest.json', {'country': country, 'source': source, 'builtAt': datetime.now(timezone.utc).isoformat(), 'count': len(data['features']), 'sha256': hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest(), 'notice': 'Local planning map. Source completeness and current temporary restrictions require verification.'})
    # Embed JSON as data, never executable source text. Source strings render via textContent.
    embedded = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    html = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>My zone map</title><link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css"><style>body{margin:0;background:#0a2019;color:white;font:16px system-ui}#map{height:100dvh}aside{position:absolute;top:12px;left:12px;padding:14px;max-width:calc(100vw - 100px);max-height:65dvh;overflow:auto;background:#102c23ed;border-radius:14px}h1{font-size:18px;margin:0}p{overflow-wrap:anywhere}button{min-height:44px}</style><div id="map"></div><aside><h1>My zone map</h1><p id="info">Tap a zone for its source description. This file contains your own local dataset; basemap tiles need internet.</p></aside><script src="https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js"></script><script type="application/json" id="zones">__DATA__</script><script>
const data=JSON.parse(document.getElementById('zones').textContent),map=new maplibregl.Map({container:'map',style:{version:8,sources:{base:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'base',type:'raster',source:'base'}]},center:[9.5,47.6],zoom:8});map.addControl(new maplibregl.NavigationControl());map.on('load',()=>{map.addSource('zones',{type:'geojson',data});map.addLayer({id:'zones',type:'fill',source:'zones',paint:{'fill-color':['match',['get','restriction'],'PROHIBITED','#ff405d','REQ_AUTHORISATION','#ff9e43','REQ_AUTHORIZATION','#ff9e43','#ffd45d'],'fill-opacity':.3}});map.addLayer({id:'outline',type:'line',source:'zones',paint:{'line-color':'#ffbd7d','line-width':2}});const bounds=new maplibregl.LngLatBounds();function visit(c){if(typeof c[0]==='number')bounds.extend(c.slice(0,2));else c.forEach(visit)}data.features.forEach(f=>visit(f.geometry.coordinates));if(!bounds.isEmpty())map.fitBounds(bounds,{padding:60,maxZoom:12});});map.on('click','zones',e=>{const p=e.features[0].properties;document.getElementById('info').textContent=[p.name,p.restriction,p.reason,p.restrictionConditions,p.message,p.description,p.authorityName,p.email,p.phone].filter(Boolean).join(' · ')});
</script></html>'''.replace('__DATA__', embedded)
    (output / 'map.html').write_text(html, encoding='utf-8')
    return {'output': str(output), 'features': len(data['features'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    scan = sub.add_parser('scan');scan.add_argument('url');scan.add_argument('--output', type=Path, default=ROOT/'private-data/discovery.json')
    sub.add_parser('refresh-swiss')
    download = sub.add_parser('from-url');download.add_argument('url');download.add_argument('--country',required=True);download.add_argument('--output',type=Path,required=True)
    germany = sub.add_parser('germany');germany.add_argument('--bbox', nargs=4, type=float, required=True);germany.add_argument('--layers', nargs='+');germany.add_argument('--output', type=Path, default=ROOT/'private-data/de')
    generate = sub.add_parser('build');generate.add_argument('input', type=Path);generate.add_argument('--country', required=True);generate.add_argument('--source', default='User-supplied zone file');generate.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.command == 'scan':
        result = report_as_dict(discover(args.url));write_json(args.output, result)
    elif args.command == 'from-url':
        with httpx.Client(timeout=90,follow_redirects=True,headers={'User-Agent':'AerisZoneMapBuilder/1.0'}) as client:
            if not _robots_allowed(client,args.url):
                raise ValueError('robots.txt does not permit this fetch, or could not be checked. Download a permitted file manually and use build.')
            with client.stream('GET',args.url) as response:
                response.raise_for_status(); chunks=[]; total=0
                for chunk in response.iter_bytes():
                    total+=len(chunk)
                    if total>50*1024*1024:raise ValueError('Zone feed exceeds 50 MB; use a smaller extract.')
                    chunks.append(chunk)
            payload=json.loads(b''.join(chunks).decode('utf-8-sig'))
        result=build(payload,args.output,args.country.upper(),args.url)
    elif args.command == 'refresh-swiss':
        response = httpx.get(SWISS_URL, timeout=90, follow_redirects=True);response.raise_for_status()
        data = validate(response.json())
        # Preserve the federal file bytes and geometry; metadata is separate.
        target = ROOT/'public/data/zones/CH.geojson';temporary=target.with_suffix('.tmp');temporary.write_bytes(response.content);temporary.replace(target)
        result = {'source': SWISS_URL, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'features': len(data['features']), 'sha256': hashlib.sha256(response.content).hexdigest(), 'attribution': 'FOCA / geo.admin.ch'}
        write_json(ROOT/'public/data/zones/CH.meta.json', result)
    elif args.command == 'germany':
        extract = GermanyDipulAdapter().fetch_bbox(tuple(args.bbox), layers=tuple(args.layers) if args.layers else None)
        if any('viewport limit' in warning for warning in extract.warnings):
            raise ValueError('A layer was truncated. Use a smaller bbox; refusing to build incomplete map.')
        result = build({'type': 'FeatureCollection', 'features': extract.features}, args.output, 'DE', GermanyDipulAdapter.source_page)
        result['warnings'] = extract.warnings
    else:
        result = build(json.loads(args.input.read_text(encoding='utf-8-sig')), args.output, args.country.upper(), args.source)
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
