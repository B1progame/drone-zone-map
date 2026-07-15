# Drone Zone Map

A privacy-friendly, static drone planning map built for GitHub Pages. It combines map exploration, honest official-source status, live weather context, saved locations, and an optional future AI explainer in a polished responsive interface.

> **Planning and situational awareness only.** This project is not an official aviation authority and does not grant permission to fly. Check the official national aviation source before takeoff.

## What works in this MVP

- Interactive MapLibre map with click-anywhere coordinate selection
- Coordinate search, browser geolocation, and animated map fly-to
- Current Open-Meteo flight conditions (wind, gusts, precipitation, cloud cover, temperature) with a conservative planning score
- Local-only saved places and preference notice
- Responsive glass UI: icon-first mobile dock and desktop labels
- Source registry and official links; no fake zones or derived legal claims
- Optional AI page is explicitly disabled until a secure user-provided or proxied provider is configured
- GitHub Pages deployment and a safe metadata-validation workflow

## Official-source coverage

| Country | Source | Status | Offline/vector claim |
|---|---|---|---|
| Germany | DIPUL | WMS configuration status | No vector/offline zone claim |
| Spain | ENAIRE Drones | Endpoint discovery required | None |
| France | Géoportail | Official-link-only fallback | None |
| Luxembourg | DAC Geoportal | Endpoint discovery required | None |

The current MVP deliberately bundles **no drone-zone geometry**. An absent zone is never permission. The source registry lives at `public/data/sources/countries.json` and is designed to become the single traceable record of verified public services, freshness, attribution, capability, warnings, and terms notes.

### Expanded coverage directory

The registry now links to official planners or aviation authorities for 38 countries: Germany, Spain, France, Ireland, the UK, Benelux, the Nordics, central/eastern/southern Europe, plus the United States, Canada, Australia, New Zealand, Japan, Brazil, India, Singapore, and South Africa. Only Germany is currently marked `wms_only`; every other entry remains `official_link_only` or `needs_endpoint_discovery` until its public endpoint, licence, update model, and caching permissions have been verified.

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

The scheduled workflow currently validates metadata only, so it cannot accidentally scrape or publish unverified data. Add a verified adapter and exporter before enabling retrieval.

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
