# Source discovery pipeline

The pipeline inventories public geospatial endpoints for personal research. It does not bypass authentication, bot protection, robots.txt, or terms, and it never converts screenshots or coloured pixels into legal zones.

```powershell
python pipeline/main.py
python pipeline/main.py discover "https://dipul.bund.de/homepage/en/information/geographical-zones/web-map-service-wms/" --output pipeline/reports/germany.json
python pipeline/main.py inspect-wms "https://uas-betrieb.de/geoservices/dipul/wms" --output pipeline/reports/germany-wms.json
```

Discovery extracts public WMS, WFS, WMTS, OGC API, ArcGIS service, GeoJSON, and ED-318 candidates from official HTML. WMS candidates receive a conservative `GetCapabilities` check and layer inventory. Every report still requires manual confirmation of licensing, attribution, caching, and update rules before its data can be added to the public app.

If an official page blocks crawling but publicly documents a service URL, use `inspect-wms` with that known endpoint. It performs only `GetCapabilities`; it does not crawl the site or bypass the robots policy.

DIPUL explicitly documents personal/internal use and limited non-commercial application use with current DFS/BKG attribution. Its official WMS is rendered directly by the frontend; the pipeline does not pretend raster pixels are vector restrictions.
