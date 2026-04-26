# Source repo inventory — `/Users/miroslavsekera/r/contextractor/`

Snapshot 2026-04-26. Source repo is read-only for this migration.

## apps/

- `apps/contextractor-apify/` — Python Apify Actor.
  - `.actor/{actor.json, input_schema.json, output_schema.json, dataset_schema.json}` — canonical schemas. Current `actor.json.description` references PyPI/npm and must be stripped in the propagated copy.
  - `src/{__main__.py, main.py, handler.py, extraction.py, config.py, __init__.py, py.typed}` — entry, request handler, extraction adapters, config builder. Uses `crawlee[playwright]` `PlaywrightCrawler` and `apify.Actor`.
  - `Dockerfile` — based on `apify/actor-python-playwright:3.14-1.57.0`. Replace with Node + Playwright base.
  - `input_schema.json` already lists `xml` / `xmltei` save flags AND mentions `pruneXpath`, `teiValidation`, `withMetadata` in the `trafilaturaConfig` description — strip XML/TEI everywhere; strip `pruneXpath` from the description (see `entry-qa-config-field-scope.md`).
- `apps/contextractor-standalone/` — Python CLI.
  - `src/contextractor_cli/{main.py, crawler.py, config.py}` — typer CLI, crawlee-based crawler, JSON/YAML config loader.
  - `crawler.py` declares `FORMAT_EXTENSIONS = { 'txt', 'markdown', 'json', 'xml', 'xmltei' }` — drop the last two when porting.
  - `pyproject.toml` console script: `contextractor = contextractor_cli.main:app`.
  - `entry.py`, `build.py`, `contextractor-darwin-arm64.spec`, `npm/` — PyInstaller / npm packaging artifacts. Drop in the TS port; Apify-only target.

## packages/

- `packages/contextractor_engine/` — Python lib wrapping Trafilatura.
  - Public API: `ContentExtractor`, `TrafilaturaConfig`, `ExtractionResult`, `MetadataResult`, `get_default_config`, `normalize_config_keys`.
  - `TrafilaturaConfig` fields (Python dataclass): `fast`, `favor_precision`, `favor_recall`, `include_comments`, `include_tables`, `include_images`, `include_formatting`, `include_links`, `deduplicate`, `target_language`, `with_metadata`, `only_with_metadata`, `tei_validation`, `prune_xpath`, `url_blacklist`, `author_blacklist`, `date_extraction_params`.
  - `MetadataResult` fields: `title / author / date / description / sitename / language`.
  - `ExtractionResult.output_format` accepts `txt`, `json`, `markdown`, `xml`, `xmltei` — drop the last two when porting.
  - `tests/test_extractor.py` — pytest unit tests against fixtures.

## tools/

- `tools/platform-test-runner/` — Python test orchestrator. Target already has the TS version under the same path; do not regress.
- `tools/generated-unit-tests/` — pytest + `fixtures/` HTML files. Port pytest cases to vitest; copy fixtures verbatim.

## docs/

- `docs/{spec, troubleshooting, unit-test-cases, notes}` — propagate.
- `docs/pypi-trusted-publishing.md` — DO NOT propagate. Target ships only to Apify.

## Root

- `README.md` — propagate; rewrite all "PyPI / npm / Docker / pip install" references. Keep playground link. Add the "built on rs-trafilatura and Crawlee" line.
- `LICENSE`, `NOTICE` — already present in target; check for drift.
- `pyproject.toml`, `uv.lock` — replaced by `package.json` + `pnpm-lock.yaml` workspace in target.
- `Dockerfile` at repo root — drop; per-app Dockerfiles only.
