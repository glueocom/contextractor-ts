# Step add-standalone-cli

## TLDR

Port `/r/contextractor/apps/contextractor-standalone/` to TypeScript at `apps/contextractor-standalone/`. Use Crawlee TS for crawling and `@contextractor/engine` for extraction. Drop the PyInstaller / npm-of-Python packaging. Drop `xml` and `xmltei` from `FORMAT_EXTENSIONS`.

## Skills and Agents

- Skills: `apify-actorization` (CLI patterns; the standalone CLI is not an Actor but reuses the engine).
- Agents: `ts-pro` (port), `code-reviewer` (diff).

## Reference reading

- `../migrate-py-to-ts-rust-v2-notes/source-repo-inventory.md` (standalone section).
- `../user-entry-log/entry-initial-prompt.md` (drop xml/xmltei FORMAT_EXTENSIONS entries; Crawlee mention rule).
- Source: `/r/contextractor/apps/contextractor-standalone/src/contextractor_cli/{main.py, crawler.py, config.py}`.

## Actions

### Package skeleton

- `apps/contextractor-standalone/package.json`:
  - `"name": "@contextractor/standalone"`, `"private": true`.
  - `"bin": { "contextractor": "./dist/cli.js" }`.
  - Deps: `"crawlee"` (`@crawlee/playwright` family), `"playwright"`, `"commander"` (or `"yargs"` — pick the lighter one and stay consistent), `"@contextractor/engine": "workspace:*"`.
  - Dev deps: `"typescript"`, `"@types/node"`, `"vitest"`, `"tsx"`.
  - Scripts: `build` = `tsc -p tsconfig.json`; `start` = `tsx src/cli.ts`; `test` = `vitest run --passWithNoTests`; `lint` = `biome check .`.
- `apps/contextractor-standalone/tsconfig.json` extends the root config.

### TypeScript sources

- `apps/contextractor-standalone/src/cli.ts` mirrors `main.py`:
  - Parses CLI flags with kebab-case names: `--start-url <url>`, `--output-dir <dir>`, `--format <fmt>` (enum: `txt | markdown | json | html`), `--config <path>` (JSON config — JSON only in help text per `.claude/rules/json-config-only.md`), etc.
  - Loads JSON config (silently accepts YAML via the existing helper if present, but the help string says "Path to JSON config file" only — see `json-config-only.md`).
- `apps/contextractor-standalone/src/crawler.ts` mirrors `crawler.py`:
  - Uses Crawlee TS `PlaywrightCrawler`.
  - `FORMAT_EXTENSIONS = { txt: '.txt', markdown: '.md', json: '.json', html: '.html' }` — **no `xml` or `xmltei` entries**.
  - `_url_to_filename` ported as `urlToFilename`.
  - Browser launch / context options ported (`--disable-blink-features=AutomationControlled`, sandbox flag, ignore SSL errors, CSP bypass, cookies storage state).
- `apps/contextractor-standalone/src/config.ts` mirrors `config.py`:
  - Defines `CrawlConfig` interface and parser.
  - Validates input via zod (or a hand-rolled validator — pick zod if not adding much weight).

### Drop legacy packaging

- Do **not** port: `entry.py`, `build.py`, `contextractor-darwin-arm64.spec`, `npm/`. The Apify-only target removes all PyInstaller and npm-wrapper artifacts.

### Tests

- `apps/contextractor-standalone/src/cli.test.ts` (vitest) — invoke the CLI in-process with a mocked crawler that returns a fixture and asserts the file written matches the requested format. Use `--passWithNoTests` is **not** acceptable here — the CLI must have at least one test.

## Constraints

- Help text and README must reference JSON config only (per `.claude/rules/json-config-only.md`); silent YAML support stays in code.
- Use Crawlee for TypeScript — not Crawlee for Python.
- Do **not** export `xml` or `xmltei` formats anywhere in this app.

## Done when

- `pnpm -F @contextractor/standalone build` succeeds.
- `pnpm -F @contextractor/standalone test` passes.
- `node apps/contextractor-standalone/dist/cli.js --start-url https://blog.apify.com/what-is-web-scraping/ --format markdown --output-dir /tmp/contextractor-smoke` writes a non-empty markdown file.
- `grep -rni 'xml\|xmltei' apps/contextractor-standalone/src/` returns nothing.
- `grep -rni 'pyinstaller\|.spec\b\|build\.py' apps/contextractor-standalone/` returns nothing.
- The matching `../tests/step-test-add-standalone-cli.md` passes.
