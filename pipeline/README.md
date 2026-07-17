# Source discovery pipeline

The pipeline inventories public geospatial endpoints for personal research. It does not bypass authentication, bot protection, robots.txt, or terms, and it never converts screenshots or coloured pixels into legal zones.

```powershell
python pipeline/main.py
python pipeline/main.py discover "https://dipul.bund.de/homepage/en/information/geographical-zones/web-map-service-wms/" --output pipeline/reports/germany.json
python pipeline/main.py inspect-wms "https://uas-betrieb.de/geoservices/dipul/wms" --output pipeline/reports/germany-wms.json
python pipeline/main.py update-ireland
python pipeline/main.py update-uk
python pipeline/main.py update-sweden
python pipeline/validate_geojson.py "public/data/zones/*.geojson" "public/data/zones/sweden/*.geojson"
```

Discovery extracts public WMS, WFS, WMTS, OGC API, ArcGIS service, GeoJSON, and ED-318 candidates from official HTML. WMS candidates receive a conservative `GetCapabilities` check and layer inventory. Every report still requires manual confirmation of licensing, attribution, caching, and update rules before its data can be added to the public app.

If an official page blocks crawling but publicly documents a service URL, use `inspect-wms` with that known endpoint. It performs only `GetCapabilities`; it does not crawl the site or bypass the robots policy.

DIPUL explicitly documents personal/internal use and limited non-commercial application use with current DFS/BKG attribution. Its official WMS is rendered directly by the frontend; the pipeline does not pretend raster pixels are vector restrictions.

Ireland is downloaded only from the GeoJSON link explicitly published by the Irish Aviation Authority. The adapter validates the FeatureCollection before replacing the public file. IAA marks the data as reference-only and requires pilots to check current TRAs, NOTAMs, and the official file.

Sweden is downloaded from LFV's documented WFS endpoint under CC BY-NC-ND 4.0. The ten responses are stored as separate layers without simplifying or rewriting their geometry. LFV's documented altitude and NOTAM display rules are applied only as frontend filters. Norway remains an official link: Avinor's current terms prohibit scraping, copying, and redistribution of its service data.

France is rendered directly from IGN's public `TRANSPORTS.DRONES.RESTRICTIONS` WMTS layer. Spain uses ENAIRE's current V1 viewport queries with separate infrastructure, aeronautical, and urban styling. Urban coverage is hidden below zoom 10 because its province-scale polygons create a misleading opaque pink patchwork when the raw service renderer is tiled nationally.

The UK adapter downloads NATS' official AIRAC KML visualization and retains its effective date and warnings. The KML is a visualization aid; the UK AIP and current NOTAMs remain authoritative.

Denmark's stable GeoJSON URLs are loaded directly from Trafikstyrelsen only when the viewport reaches Denmark. They are not copied by the pipeline. US FAA Facility Map grids load live by viewport. Italy remains an official link because D-Flight restricts ED-269 downloads to subscribed operators. Canada uses the official NRC-hosted map in an iframe so NAV CANADA's underlying database is rendered without being copied.
