# Source discovery pipeline

The pipeline inventories public geospatial endpoints for personal research. It does not bypass authentication, bot protection, robots.txt, or terms, and it never converts screenshots or coloured pixels into legal zones.

```powershell
python pipeline/main.py
python pipeline/audit_registry.py --output pipeline/reports/source-coverage-audit.json
python pipeline/main.py discover "https://dipul.bund.de/homepage/en/information/geographical-zones/web-map-service-wms/" --output pipeline/reports/germany.json
python pipeline/main.py inspect-wms "https://uas-betrieb.de/geoservices/dipul/wms" --output pipeline/reports/germany-wms.json
python pipeline/main.py update-ireland
python pipeline/main.py update-uk
python pipeline/main.py update-sweden
python pipeline/main.py update-public-geozones
python pipeline/main.py inspect-slovakia --output pipeline/reports/slovakia-kml-package.json
python pipeline/main.py update-canada-open --output pipeline/reports/canada-open-data.geojson
python pipeline/discovery/arcgis_webmap_inventory.py 25ba69037c264c5faa5381174f76f861 --output pipeline/reports/slovenia-arcgis-webmap.json
python pipeline/validate_geojson.py "public/data/zones/*.geojson" "public/data/zones/sweden/*.geojson"
```

Discovery extracts public WMS, WFS, WMTS, OGC API, ArcGIS service, GeoJSON, and ED-318 candidates from official HTML. WMS candidates receive a conservative `GetCapabilities` check and layer inventory. Every report still requires manual confirmation of licensing, attribution, caching, and update rules before its data can be added to the public app.

`audit_registry.py` fails on duplicate countries, unsupported status values, insecure official links, missing source-specific decisions, placeholder research notes, or impossible link-only capability claims. Its JSON report records the disposition and supported capabilities of every country shown by the app.

If an official page blocks crawling but publicly documents a service URL, use `inspect-wms` with that known endpoint. It performs only `GetCapabilities`; it does not crawl the site or bypass the robots policy.

DIPUL explicitly documents personal/internal use and limited non-commercial application use with current DFS/BKG attribution. Its official WMS is rendered directly by the frontend; the pipeline does not pretend raster pixels are vector restrictions.

Ireland is downloaded only from the GeoJSON link explicitly published by the Irish Aviation Authority. The adapter validates the FeatureCollection before replacing the public file. IAA marks the data as reference-only and requires pilots to check current TRAs, NOTAMs, and the official file.

Sweden is downloaded from LFV's documented WFS endpoint under CC BY-NC-ND 4.0. The ten responses are stored as separate layers without simplifying or rewriting their geometry. LFV's documented altitude and NOTAM display rules are applied only as frontend filters. Norway remains an official link: Avinor's current terms prohibit scraping, copying, and redistribution of its service data.

France is rendered directly from IGN's public `TRANSPORTS.DRONES.RESTRICTIONS` WMTS layer. Spain uses ENAIRE's current V1 viewport queries with separate infrastructure, aeronautical, and urban styling. Urban coverage is hidden below zoom 10 because its province-scale polygons create a misleading opaque pink patchwork when the raw service renderer is tiled nationally.

The UK adapter downloads NATS' official AIRAC KML visualization and retains its effective date and warnings. The KML is a visualization aid; the UK AIP and current NOTAMs remain authoritative.

Denmark's stable GeoJSON URLs are loaded directly from Trafikstyrelsen only when the viewport reaches Denmark. They are not copied by the pipeline. US FAA Facility Map grids load live by viewport. Italy is intentionally absent from the country renderer.

`update-public-geozones` refreshes the two redistributable machine-readable snapshots: Finland's Traficom feed under CC BY 4.0 and the Dutch government's current ED-269 download under the Rijksoverheid CC0 open-data terms. The shared normalizer retains the original restriction, reason, applicability, authority and vertical-volume fields. ED-269 circles become 96-segment geodesic polygons because GeoJSON has no native circle type; their exact center and radius remain in properties. The Traficom attribution explicitly records this modification.

The former Dutch PDOK Drone No-Fly Zone services are not used because PDOK retired them on 1 July 2026. Estonia loads its public EANS GeoJSON live rather than bundling it. Its `EERZout` record is a deliberate global polygon with Estonia as a hole and is excluded from rendering so it cannot cover the globe.

Portugal's ANAC page explicitly offers ED-269/ED-318 downloads for pre-flight use. The frontend reads the CORS-enabled official directory, selects the newest dated `UASZoneVersion` JSON file, and converts its volumes in memory. This avoids both filename staleness and redistribution of a copied snapshot.

`update-estonia` and `update-bulgaria` are inspection exports written below ignored `exports/requested/` paths. The Bulgarian tool discovers the newest CAA `BGR_ZONES` link and normalizes its contents, but that geometry must not be published until the CAA's public-sector reuse process grants or clearly establishes reuse permission.

`inspect-slovakia` discovers the newest dated ZIP on the Slovak Transport Authority's official geozone page and inventories every KML placemark, geometry type, style reference and inline colour. It does not publish the geometry while the site's reuse terms remain unstated.

For public ArcGIS maps without stated reuse terms, `arcgis_webmap_inventory.py` records the public item, operational-layer URLs, popups, opacity, renderer symbols and label definitions without downloading geometry or tracing pixels. The checked-in Slovenia report demonstrates this audit path and keeps the official map link-only until reuse terms are clear.

`update-canada-open` downloads the official Transport Canada airport layer and NRCan national-park boundaries under the Open Government Licence. It deliberately does not inspect or export the NRC tool's NAV CANADA-derived shapes: the NRC FAQ says the licence prohibits redistribution. The live app combines those lawful open layers with a handoff to the complete official NRC tool.
