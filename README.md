# Drone Zone Map

A privacy-friendly, static drone planning map built for GitHub Pages. It combines map exploration, honest official-source status, live weather context, saved locations, and an optional future AI explainer in a polished responsive interface.

> **Planning and situational awareness only.** This project is not an official aviation authority and does not grant permission to fly. Check the official national aviation source before takeoff.

## What works in this MVP

- Interactive MapLibre globe/map with click, touch, pinch zoom, and 100 km+ country-scale overlays
- Coordinate search, browser geolocation, and animated map fly-to
- Current Open-Meteo conditions plus a cached viewport field for cloud, rain, and wind-flow rendering
- Local-only saved places and preference notice
- Responsive liquid-glass UI with adjustable transparency, reduced motion, and overlay-detail budgets
- Source registry and official links; no fake zones or derived legal claims
- Optional AI page is explicitly disabled until a secure user-provided or proxied provider is configured
- GitHub Pages deployment and a safe metadata-validation workflow

## Official-source coverage

| Country | Source | Status | Offline/vector claim |
|---|---|---|---|
| Germany | DIPUL | Live official WMS and point identify | No vector/offline zone claim |
| Spain | ENAIRE servAIS / ED-318 | Live viewport vectors and point identify | Urban coverage appears only at useful local zoom |
| France | IGN / Géoportail | Live official UAS-restriction WMTS | No vector/offline zone claim |
| United Kingdom | NATS UK AIS | AIRAC KML visualization and local point checks | Permanent restrictions; check NOTAMs |
| United States | FAA UAS Facility Maps | Live viewport grids and point checks | Authorization ceilings, not complete clearance |
| Canada | Government of Canada Open Data | Open airports, 5.6 km advisory rings, and national parks | Partial open-data view; NAV CANADA database is not redistributed |
| Switzerland | FOCA / geo.admin.ch | Complete live official GeoJSON and point checks | Federal zones; cantonal rules may also apply |
| Austria | Austro Control Dronespace | Location-aware official planner handoff | Official-link-only until a reusable feed is verified |
| Denmark | Trafikstyrelsen Dronezoner | Live official GeoJSON and point lookup | Loaded on demand; not cached |
| Luxembourg | DAC Geoportal | Normalized official CC0 vector zones | Offline pack supported |
| Ireland | Irish Aviation Authority | Published official GeoJSON | Bundled reference copy |
| Sweden | LFV Dronechart | Published official WFS | Bundled unmodified layers |

Germany loads every active layer advertised by DIPUL, separating country-scale safety layers from dense local infrastructure so the national view remains readable. France uses its bounded live raster source. Spain loads current ENAIRE vectors by viewport and colors `PROHIBITED`, `REQ_AUTHORIZATION`, `CONDITIONAL`, and `NO_RESTRICTION` distinctly; urban coverage is purple and appears only at useful zoom instead of creating an opaque red blanket. The UK uses NATS' AIRAC visualization KML, and US FAA facility grids load only near the viewed area. Denmark's stable official GeoJSON URLs load only when Denmark enters the viewport. Ireland, Luxembourg, and Sweden use verified vector files; Sweden's raw files remain unmodified and the frontend applies LFV's ground-level display filters. An absent zone is never permission. The source registry lives at `public/data/sources/countries.json` and records verified services, freshness, attribution, capabilities, warnings, and terms notes.

Norway resolves to its official source but does not display copied geometry because Avinor prohibits presenting its service data in another application. Italy was removed from the map and source directory. Canada renders openly licensed federal airports, clearly labelled 5.6 km advisory rings, and national-park boundaries; NRC explicitly states that its NAV CANADA-derived database cannot be redistributed, so the complete official map remains a direct handoff.

### Expanded coverage directory

The registry links to official planners or aviation authorities for 37 countries: Germany, Spain, France, Ireland, the UK, Benelux, the Nordics, central/eastern/southern Europe, plus the United States, Canada, Australia, New Zealand, Japan, Brazil, India, Singapore, and South Africa. Entries are marked active only after their endpoint, licence, update model, attribution, and caching behavior have been verified.

## Run locally

```bash
npm install
npm run dev
```

Build with `npm run build`. The Vite base is `/drone-zone-map/` in GitHub Actions and `/` locally.

## Deploy to GitHub Pages

Push `main`, then in the repository settings choose **Pages → GitHub Actions** as the source. The included workflow builds and publishes `dist`. The site will be available at:

`https://USERNAME.github.io/drone-zone-map/`

If you name the repository differently, update `base` in `vite.config.ts`.

## Data pipeline and adding a country

`pipeline/` is intentionally conservative. Before an adapter fetches any service:

1. Confirm the source is official and public.
2. Check robots, licensing, rate limits, caching and attribution requirements.
3. Prefer documented GeoJSON, OGC API, WFS, ED-318, or WMS/WMTS capabilities.
4. Normalize verified features into the project zone schema with source URL, timestamp, warnings, and attribution.
5. Never infer polygons from pixels, bypass access controls, or silently replace missing data.

The scheduled workflow validates metadata and refreshes Luxembourg's CC0 feed. Add a verified adapter and exporter before enabling retrieval for another country.

### Personal Spanish GeoJSON snapshot

Download a small ENAIRE viewport as official, paged GeoJSON:

```bash
python pipeline/main.py fetch-spain-bbox --bbox=-3.75,40.38,-3.65,40.46 --output madrid.geojson
```

The downloader bounds every query, requests simplified coordinate precision, and
paginates official features. It does not trace screenshots or bulk-copy the
national service.

## Limitations

- Weather is forecast context, not a go/no-go decision; temporary restrictions can change.
- Cross-origin map tiles may block screenshot canvas export. A production export must retain required attribution.
- Offline packs are UI architecture only until each source’s caching terms and data format are verified.
- AI is disabled by default. Do not expose API keys in browser code; use a user-owned key or a secure proxy.
- Translations expose an extensible settings surface; production translation catalogs are the next implementation step.

## Privacy

The basic app has no analytics. Saved places and the acknowledgement are stored in browser localStorage; clearing browser site data removes them. The app only calls Open-Meteo after you select a point.

## License

MIT.
