# Deployment

GitHub Pages deploys from `main` through `.github/workflows/deploy.yml`. Vite uses `/drone-zone-map/` under GitHub Actions and `/` locally. The manifest and service-worker URLs are relative so the repository base path and standalone PWA scope remain correct.

Before deployment run:

```bash
npm ci
python -m pip install ./pipeline
npm test
npm run world:continue
npm run typecheck
npm run build
```

Only `public/data/` generated assets are deployed. `private-data/`, `private/`, `exports/`, test output, and local browser artifacts are ignored.
