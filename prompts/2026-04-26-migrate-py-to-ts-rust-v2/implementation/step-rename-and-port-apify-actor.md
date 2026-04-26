# Step rename-and-port-apify-actor

## TLDR

`git mv apps/contextractor apps/contextractor-apify`. Replace Python sources with TypeScript using the `apify` SDK + `crawlee` (TS) `PlaywrightCrawler`. Propagate `.actor/{actor.json, input_schema.json, output_schema.json, dataset_schema.json}` from the source repo with PyPI/npm references stripped, XML/XML-TEI enums dropped, and `pruneXpath`/`dateExtractionParams` removed from descriptions. Multi-stage Dockerfile using `pnpm --filter @contextractor/apify --prod deploy /deploy`. `actor.json.name` = `contextractor-test`.

## Skills and Agents

- Skills: `apify-actor-development`, `apify-actorization`, `apify-schemas`, `apify-ops`.
- Agents: `ts-pro` (port), `code-reviewer` (diff).

## Reference reading

- `../migrate-py-to-ts-rust-v2-notes/source-repo-inventory.md` (apify section).
- `../migrate-py-to-ts-rust-v2-notes/apify-monorepo-deploy.md` (Dockerfile, `dockerContextDir`, `pnpm deploy`).
- `../migrate-py-to-ts-rust-v2-notes/v1-lessons-codified.md` (production-actor protection).
- `../user-entry-log/entry-qa-config-field-scope.md` (no-op fields to strip from input schema description).
- `../user-entry-log/entry-initial-prompt.md` (Crawlee + rs-trafilatura wording rule).
- Source: `/r/contextractor/apps/contextractor-apify/{src/*, .actor/*, Dockerfile}`.

## Actions

### Rename and reset

- `git mv apps/contextractor apps/contextractor-apify`.
- Delete every Python source under `apps/contextractor-apify/`: `pyproject.toml`, `Dockerfile`, `src/{__main__.py, main.py, handler.py, extraction.py, config.py, __init__.py, py.typed}`.

### TypeScript sources

- `apps/contextractor-apify/package.json`:
  - `"name": "@contextractor/apify"`, `"private": true`.
  - Deps: `"apify": "^3"`, `"crawlee": "^3"` (`@crawlee/playwright` if Crawlee 4 splits packages — verify against `crawlee.dev/docs`), `"playwright"`, `"@contextractor/engine": "workspace:*"`.
  - Dev deps: `"typescript"`, `"@types/node"`, `"vitest"`, `"@biomejs/biome"`.
  - Scripts: `build` = `tsc -p tsconfig.json`; `start` = `node dist/main.js`; `start:prod` = `node dist/main.js`; `start:dev` = `tsx src/main.ts`; `test` = `vitest run --passWithNoTests` (per `v1-lessons-codified.md`); `lint` = `biome check .`.
- `apps/contextractor-apify/tsconfig.json` extends the root config; `outDir: "dist"`, `rootDir: "src"`.
- `apps/contextractor-apify/src/main.ts` mirroring `main.py`:
  - `await Actor.init()`.
  - `const input = await Actor.getInput<...>()`.
  - Build crawl config via `config.ts`.
  - Construct `PlaywrightCrawler` with proxy + browser launch options.
  - Wire request handler from `handler.ts`.
  - Run crawler; `await Actor.exit()`.
- `apps/contextractor-apify/src/handler.ts`, `extraction.ts`, `config.ts` mirroring the Python equivalents. Call `@contextractor/engine` for extraction.
- Delete every leftover `vendor/` reference if any survives. Verify `apps/contextractor-apify/vendor/` does not exist.

### `.actor/` propagation

For each of `actor.json`, `input_schema.json`, `output_schema.json`, `dataset_schema.json`:

- Copy from `/r/contextractor/apps/contextractor-apify/.actor/<file>`.
- `actor.json` adjustments:
  - `"name": "contextractor-test"` (NOT `"contextractor"` — see `v1-lessons-codified.md` Production-actor protection).
  - `"description": "Crawls websites and extracts main-content text. Built on rs-trafilatura and Crawlee."` (drop the PyPI/npm reference).
  - `"meta": { "templateId": "node-playwright" }` (drop the Python templateId).
  - Add `"dockerContextDir": "../../.."`.
  - `"dockerfile": "./Dockerfile"`.
- `input_schema.json` adjustments:
  - Remove `"saveExtractedXmlToKeyValueStore"` and `"saveExtractedXmlTeiToKeyValueStore"` properties entirely.
  - Update `"trafilaturaConfig"` description: drop the substring `pruneXpath` and `dateExtractionParams`. Keep `teiValidation` and `withMetadata` references (they're forward-compat).
  - Scan every `"enum"` array; remove `"xml"` and `"xmltei"` entries everywhere.
- `output_schema.json`, `dataset_schema.json`: scan every `"enum"` array; remove `"xml"` and `"xmltei"`.

### Multi-stage Dockerfile

- Replace `apps/contextractor-apify/Dockerfile` with a multi-stage Node + Playwright Dockerfile per `../migrate-py-to-ts-rust-v2-notes/apify-monorepo-deploy.md`:
  - Builder stage: `apify/actor-node-playwright-chrome:22 AS builder`. Copy `pnpm-workspace.yaml`, `pnpm-lock.yaml`, root `package.json`, then `packages/`, then `apps/contextractor-apify/`. `corepack enable && pnpm install --frozen-lockfile`. `pnpm --filter @contextractor/apify build`. `pnpm --filter @contextractor/apify --prod deploy /deploy`.
  - Runtime stage: `apify/actor-node-playwright-chrome:22`. `WORKDIR /usr/src/app`. `COPY --from=builder /deploy ./`. `CMD ["node", "dist/main.js"]`.
- Document the chosen base image in `apps/contextractor-apify/README.md` (created in `step-update-docs-and-readmes`).

### Local smoke

- `pnpm -F @contextractor/apify build` succeeds.
- `pnpm -F @contextractor/apify start:dev` (or `apify run` from `apps/contextractor-apify/`) crawls a single URL and writes a dataset entry. Use `https://blog.apify.com/what-is-web-scraping/` (the existing `prefill`).

## Constraints

- Use Crawlee for **TypeScript**, not Crawlee for Python. Confirm against `crawlee.dev/llms.txt`.
- No `browserforge` import — Crawlee TS has equivalent fingerprinting via its own modules.
- Do **not** push to `glueo/contextractor-test` here — `step-local-and-platform-tests` does that.
- Do **not** reintroduce `xml` / `xmltei` anywhere in `.actor/` or `src/`.
- Do **not** reintroduce `vendor/`.
- `actor.json.name` must be `contextractor-test`. Verify with `jq -r '.name' apps/contextractor-apify/.actor/actor.json` before declaring the step done.

## Done when

- `apps/contextractor` no longer exists; `apps/contextractor-apify` has TS sources, `.actor/`, multi-stage Dockerfile, no `vendor/`.
- `jq -r '.name' apps/contextractor-apify/.actor/actor.json` returns `contextractor-test`.
- `jq -r '.dockerContextDir' apps/contextractor-apify/.actor/actor.json` returns `../../..`.
- `jq -r '.description' apps/contextractor-apify/.actor/actor.json` mentions both `rs-trafilatura` and `Crawlee`, no PyPI / npm.
- `pnpm -F @contextractor/apify build` succeeds.
- `apify run` performs a tiny smoke crawl using the local engine.
- `grep -ri 'pypi\|pip install\|browserforge\|trafilatura>=' apps/contextractor-apify/` returns nothing.
- `grep -ri 'xml\|xmltei' apps/contextractor-apify/.actor/` returns nothing.
- `grep -ri 'pruneXpath\|dateExtractionParams' apps/contextractor-apify/.actor/` returns nothing.
- The matching `../tests/step-test-rename-and-port-apify-actor.md` passes.
