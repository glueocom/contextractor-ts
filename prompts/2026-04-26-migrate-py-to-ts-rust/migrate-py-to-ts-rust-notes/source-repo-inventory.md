# Source repo inventory — `/Users/miroslavsekera/r/contextractor/`

Snapshot taken 2026-04-26. Use this as the propagation source list. Source language is Python everywhere unless noted; the migration converts each surface as documented in the per-step prompts.

## apps/

- `apps/contextractor-apify/` — Python Apify Actor.
  - `.actor/{actor.json, input_schema.json, output_schema.json, dataset_schema.json}` — canonical schemas. `actor.json.description` references PyPI/npm — strip in the propagated copy.
  - `src/{__main__.py, main.py, handler.py, extraction.py, config.py}` — entry, request handler, extraction adapters, config builder. Use `crawlee[playwright]` `PlaywrightCrawler` and `apify.Actor`.
  - `Dockerfile` — based on `apify/actor-python-playwright:3.14-1.57.0`. Replace with Node + Playwright base in the TS port.
- `apps/contextractor-standalone/` — Python CLI.
  - `src/contextractor_cli/{main.py, crawler.py, config.py}` — typer CLI, crawlee-based crawler, JSON/YAML config loader.
  - `pyproject.toml` declares console script `contextractor = contextractor_cli.main:app`.
  - `entry.py`, `build.py`, `contextractor-darwin-arm64.spec`, `npm/` — PyInstaller / npm packaging — drop in the TS port; Apify-only target.
  - `FORMAT_EXTENSIONS` in `crawler.py` includes `xml` and `xmltei` — drop both per `entry-qa-xml-formats.md`.

## packages/

- `packages/contextractor_engine/` — Python lib wrapping Trafilatura.
  - Public API: `ContentExtractor`, `TrafilaturaConfig`, methods `.extract()`, `.extract_metadata()`, `.extract_all_formats()`.
  - Result objects expose `content`, plus metadata fields `title / author / date / description / sitename / language`.
  - `tests/test_extractor.py` — pytest unit tests against fixtures.
  - Default formats: `txt`, `markdown`, `json`, `xml` — drop `xml` from the default list during port.

## tools/

- `tools/platform-test-runner/` — Python test orchestrator (target already has the TS version under the same path, do not regress).
- `tools/generated-unit-tests/` — pytest + `fixtures/` HTML files. Port pytest cases to vitest; copy fixtures verbatim per `entry-qa-unit-tests.md`.

## docs/

- `docs/{spec, troubleshooting, unit-test-cases, notes}` — propagate.
- `docs/pypi-trusted-publishing.md` — DO NOT propagate. Target ships only to Apify.

## Root

- `README.md` — propagate but rewrite all "PyPI / npm / Docker / pip install" references. Keep playground link.
- `LICENSE`, `NOTICE` — already present in target; check for drift.
- `pyproject.toml`, `uv.lock` — replaced by `package.json` + `pnpm-lock.yaml` workspace in target.
- `Dockerfile` at repo root — drop; per-app Dockerfiles only.
