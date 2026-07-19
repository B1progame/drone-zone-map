# Adding a country

1. Identify the aviation authority and official drone map.
2. Inventory every visible and disabled official layer.
3. Record authentication, licence, caching, redistribution, automation, attribution, and live-data limits.
4. Add a source-registry record. Do not enable vector or offline claims without a verified structured source and reuse basis.
5. Add a bounded adapter under `pipeline/adapters/`; preserve all original properties and reject empty output.
6. Add sanitized parser, geometry, metadata, and location fixtures.
7. Run `npm run data:discover`, `npm run data:validate`, `npm run data:test-locations`, and `npm run data:report`.
8. Verify the map and official handoff in a browser.

Never trace screenshots, bypass access controls, publish personal exports, or substitute generic airport circles for an official national zone map.
