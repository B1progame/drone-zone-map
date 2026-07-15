# Aeris map, weather, location, and geodata guide

## Using the website

1. Open **Map** in the bottom navigation.
2. Search for a real place such as `Mannheim`, or enter coordinates such as
   `49.4891, 8.46694`, then press **Check**.
3. Press the crosshair button at the far right of the search field to request
   your device location. The browser must be allowed to share location.
4. Click **Weather** in the bottom navigation for the detailed 36-hour view.
   On the map, enable the Weather control and move the `Now` to `+8` slider.
5. Official zones currently render for Germany, Spain, and Luxembourg. Spain
   loads vector zones after zoom level 7 to avoid the unusable national pink
   blanket and excessive downloads.

If old controls remain after an update, refresh once with `Ctrl+F5`. Aeris also
updates its offline service-worker cache automatically.

## Clickable Windows geodata tool

Double-click [`tools/geodata-menu.bat`](../tools/geodata-menu.bat). It offers:

- bounded Spanish ENAIRE GeoJSON downloads;
- Luxembourg CC0 refresh;
- safe endpoint discovery for an official public page;
- WMS capabilities inspection;
- registry validation and website build testing.

Outputs are written to `exports/`. The tool deliberately does not scrape map
screenshots, bypass authentication, or claim that an official link contains a
reusable dataset. GPU processing is unnecessary for official vector APIs;
bounded server queries and geometry precision reduction are faster and retain
the real legal attributes.

## Adding another country

First run endpoint discovery on the official aviation-authority page. Review
the report and the source's reuse terms manually. If it exposes documented
GeoJSON, ED-318, WFS, OGC API, or ArcGIS Query, implement a country adapter in
`pipeline/adapters/`. Keep countries as `official_link_only` until both the
technical endpoint and reuse conditions are verified.
