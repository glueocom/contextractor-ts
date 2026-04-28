# Test step add-standalone-cli

## TLDR

Reviews `../implementation/step-add-standalone-cli.md`. Verifies the TS CLI port, the dropped XML/XMLTEI formats, no PyInstaller / npm artifacts, and a smoke run produces a non-empty markdown file.

## Inputs

- `../implementation/step-add-standalone-cli.md`.
- `../migrate-py-to-ts-rust-v2-notes/source-repo-inventory.md`.
- `.claude/rules/json-config-only.md`.

## Verification

- `apps/contextractor-standalone/{package.json, tsconfig.json, src/{cli.ts, crawler.ts, config.ts, cli.test.ts}}` all exist.
- `package.json` declares `"@contextractor/engine": "workspace:*"`, `crawlee`, `playwright`, `commander` (or `yargs`), and a `bin` entry pointing to `dist/cli.js`.
- `npm run build -w @contextractor/standalone` succeeds.
- `npm run test -w @contextractor/standalone` passes (the CLI has at least one test).
- A smoke run `node apps/contextractor-standalone/dist/cli.js --start-url https://blog.apify.com/what-is-web-scraping/ --format markdown --output-dir /tmp/contextractor-smoke` writes a non-empty markdown file.
- `FORMAT_EXTENSIONS` in `crawler.ts` is exactly `{ txt, markdown, json, html }` — no `xml`, no `xmltei`.
- CLI help string for `--config` says "Path to JSON config file" only; YAML support stays in code (silent).
- `grep -rni 'xml\|xmltei' apps/contextractor-standalone/src/` returns nothing.
- `grep -rni 'pyinstaller\|.spec\b\|build\.py\|entry\.py\|^npm/' apps/contextractor-standalone/` returns nothing.

## Auto-fix examples

- CLI help mentions YAML — rewrite to "JSON config file" only.
- `FORMAT_EXTENSIONS` includes `xml` — drop the entry.
- Help text references PyPI install — strip.

## Done when

CLI builds, tests, and produces output for the smoke run.
