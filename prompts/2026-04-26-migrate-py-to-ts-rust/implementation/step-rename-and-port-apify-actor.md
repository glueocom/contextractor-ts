# Step rename-and-port-apify-actor

## TLDR

Rename `apps/contextractor/` → `apps/contextractor-apify/`. Replace Python sources with a TypeScript Apify Actor using `apify` SDK + `crawlee` (TS) `PlaywrightCrawler`. Propagate `.actor/{actor.json, input_schema.json, output_schema.json, dataset_schema.json}` from `/r/contextractor/apps/contextractor-apify/.actor/` after stripping PyPI / npm references and removing `xml` / `xmltei` enum values. Replace the Python Dockerfile with a Node + Playwright base.

## Skills and agents

- `apify-actor-development`, `apify-actorization`, `apify-schemas`, `apify-ops`.
- Agent: `ts-pro`, `code-reviewer`.

## Inputs

- Read `../migrate-py-to-ts-rust-notes/source-repo-inventory.md` (apify section).
- Read all four `entry-qa-*.md` files (esp. `entry-qa-test-actor.md`, `entry-qa-xml-formats.md`).
- Read source files: `/r/contextractor/apps/contextractor-apify/src/{main.py, handler.py, extraction.py, config.py}`.

## Actions

- `git mv apps/contextractor apps/contextractor-apify`.
- Delete Python sources: `pyproject.toml`, `src/__main__.py`, `src/main.py`, `src/handler.py`, `src/extraction.py`, `src/config.py`, `src/__init__.py`, `src/py.typed`, `Dockerfile`.
- Add `apps/contextractor-apify/package.json` with `apify`, `crawlee`, `playwright`, `@contextractor/engine` (workspace), TS dev deps.
- Add `apps/contextractor-apify/tsconfig.json` extending the root config.
- Implement `apps/contextractor-apify/src/main.ts` mirroring `main.py`:
  - `Actor.init()` / `Actor.exit()`.
  - Input parsing via `Actor.getInput()`.
  - Build crawl config via `config.ts`.
  - Construct `PlaywrightCrawler` with proxy + browser launch options.
  - Wire request handler from `handler.ts`.
  - Run crawler; finalize.
- Implement `handler.ts` and `extraction.ts` mirroring the Python equivalents — call `@contextractor/engine` for extraction.
- Implement `config.ts` mirroring `build_crawl_config` / `build_browser_*_options`.
- Propagate `.actor/` from source repo to `apps/contextractor-apify/.actor/`:
  - `actor.json`: drop `"Also available as PyPI ... and npm packages"` from description; set `meta.templateId` to `"node-playwright"` (or remove); update `dockerfile` path.
  - `input_schema.json`, `output_schema.json`, `dataset_schema.json`: scan every `enum` array and remove `"xml"` and `"xmltei"`; remove any properties tied to xml-only behavior.
- Replace the Dockerfile: base on `apify/actor-node-playwright-chrome:22` (or current) — install `pnpm`, copy workspace files, run `pnpm install --frozen-lockfile`, build the napi-rs `.node` for `linux-x64-gnu` (or pull the prebuild), copy app, run `node dist/main.js`. Document the chosen base image.

## Constraints

- Use Crawlee for TypeScript, not Crawlee for Python.
- No `browserforge` — Crawlee TS has equivalent fingerprinting via its own modules.
- Do not push to `glueo/contextractor-test` in this step — `step-local-and-platform-tests` does that.
- Do not reintroduce `xml` / `xmltei` anywhere in `.actor/` or in `src/`.

## Done when

- `apps/contextractor` no longer exists; `apps/contextractor-apify` has TS sources, `.actor/`, Node Dockerfile.
- `pnpm -F @contextractor/apify build` succeeds.
- `apify run` from `apps/contextractor-apify/` performs a tiny smoke crawl using the local engine.
- `grep -ri 'pypi\|pip install\|browserforge\|trafilatura>=' apps/contextractor-apify/` returns nothing.
- `grep -ri 'xml\|xmltei' apps/contextractor-apify/.actor/` returns nothing.
- The matching `tests/step-test-rename-and-port-apify-actor.md` passes.
