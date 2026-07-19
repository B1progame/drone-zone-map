# Provider architecture

Existing adapters remain in `pipeline/adapters/`. `pipeline/world.py` is an orchestration and reporting layer; it does not replace working providers.

Each generated manifest records authority URLs, official map URLs, structured source URLs, source type, authentication, cache/redistribution/automation decisions, update dates, attribution, and warnings. The generated ISO registry marks each country or territory with one of the requested completeness states.

Live providers stay viewport-bounded. Redistributable static providers write under `public/data/zones/`. Personal authenticated exports write under ignored `private-data/`. Unknown and licence-restricted providers remain `official-reference-only` or `not-yet-processed`.
