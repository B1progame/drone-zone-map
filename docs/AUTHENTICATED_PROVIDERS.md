# Authenticated providers

Authentication never implies redistribution permission. Credentials, cookies, tokens, private responses, and personal exports must not enter source control, logs, reports, or GitHub Pages assets.

Italy is implemented as a manual export workflow:

```bash
npm run data:update -- --country=IT --input=/path/to/d-flight-export.json
```

The command does not log in. It validates and normalizes the user-obtained ED-269/GeoJSON file, preserves original properties, and writes `private-data/it/zones.geojson`. That directory is ignored and excluded by `.npmignore`.

No username/password variables are needed. If d-flight later publishes a documented API and reusable licence, add a separate reviewed provider rather than scraping the web application.
