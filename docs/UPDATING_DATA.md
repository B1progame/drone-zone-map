# Updating data

Run:

```bash
npm run data:update -- --country=DE
npm run data:update -- --country=FR
npm run data:update-all
npm run world:continue
```

`data:update-all` continues after one country fails and reports each outcome. Public adapters validate structured responses before publication. `world:continue` regenerates manifests, translations, validation, representative location checks, reports, and resumable state at `pipeline/state/world-progress.json`.

The scheduled GitHub Action installs the declared Python package, refreshes only providers already approved for automation, validates datasets, runs tests/type checking/build, and commits only after all checks pass.
