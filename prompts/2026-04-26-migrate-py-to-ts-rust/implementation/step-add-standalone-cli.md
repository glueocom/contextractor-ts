# Step add-standalone-cli

## TLDR

Port `/r/contextractor/apps/contextractor-standalone/` to `apps/contextractor-standalone/` as a TypeScript CLI. Use a single-binary CLI framework (`commander` or `yargs`) and Crawlee for TypeScript. Drop PyInstaller, the `npm/` wrapper, and `xml` / `xmltei` format entries.

## Skills and agents

- Agent: `ts-pro`, `code-reviewer`.

## Inputs

- Read `../migrate-py-to-ts-rust-notes/source-repo-inventory.md` (standalone section).
- Read source files: `/r/contextractor/apps/contextractor-standalone/src/contextractor_cli/{main.py, crawler.py, config.py}`.
- Read `../user-entry-log/entry-qa-xml-formats.md`.

## Actions

- Create `apps/contextractor-standalone/{package.json, tsconfig.json, src/}`.
  - `package.json` declares `"bin": { "contextractor": "./dist/cli.js" }`, deps `commander` (or `yargs`), `crawlee`, `playwright`, `@contextractor/engine`.
- Implement `src/cli.ts` mirroring every flag from `main.py` (use the source's `extract` command flag inventory). Convert snake_case option names to kebab-case CLI flags.
- Implement `src/config.ts` mirroring `CrawlConfig` from Python — JSON config loader (no YAML in docs per `.claude/rules/json-config-only.md`; YAML loading may be silently retained per existing repo rule).
- Implement `src/crawler.ts` mirroring `crawler.py` — Crawlee TS `PlaywrightCrawler`, output writer, `FORMAT_EXTENSIONS = { txt: '.txt', markdown: '.md', json: '.json', html: '.html' }` (no `xml`, no `xmltei`).
- Do not propagate: `entry.py`, `build.py`, `contextractor-darwin-arm64.spec`, `npm/`. Apify-only target.
- Add a minimal vitest unit test for the JSON config loader and the URL-to-filename slug helper.

## Constraints

- One CLI command (`extract`) — keep parity with the Python CLI's main `extract` command. Do not invent extra subcommands.
- Output filenames must match the Python CLI's slug logic exactly so existing user scripts still locate output files.
- Drop `xml` / `xmltei` everywhere — flags, type unions, FORMAT_EXTENSIONS, help text.

## Done when

- `pnpm -F @contextractor/standalone build` succeeds.
- `node apps/contextractor-standalone/dist/cli.js https://example.com --max-pages 1 -o /tmp/ctx-smoke` produces output files using the local engine.
- `grep -ri 'xml\|xmltei\|pyinstaller\|typer\|browserforge' apps/contextractor-standalone/` returns nothing.
- The matching `tests/step-test-add-standalone-cli.md` passes.
