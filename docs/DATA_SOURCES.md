# Data sources

The machine-readable source registry is `public/data/sources/countries.json`; generated provider manifests are in `public/data/manifests/providers.json`.

Germany uses DIPUL's documented WMS for live rendering, WMS GetFeatureInfo for point explanations, and bounded WFS queries for exact unmodified geometry. National geometry is not copied because the WFS attribution is CC BY-ND 4.0. `reports/PROVIDER_BASELINE.json` records the active layer count, WFS hit counts, representative point results, metadata coverage, and a scoped geometry checksum.

France preserves the existing IGN/Géoportail `TRANSPORTS.DRONES.RESTRICTIONS` WMTS/WFS provider. Bounded WFS queries cover metropolitan and published overseas areas. The layer excludes temporary restrictions, so SIA and current NOTAM checks remain mandatory.

Italy uses ENAC's required d-flight operational map. ENAC documents an ED-269 JSON download for registered operators. d-flight's terms reserve site content and allow local personal storage, not public redistribution without written consent; therefore the public app is a link handoff and the optional importer writes only to ignored `private-data/it/`.

Every other provider's exact source, access decision, warning, cache flag, and official map are recorded in the source registry and `reports/SOURCE_LICENSES.md`.
