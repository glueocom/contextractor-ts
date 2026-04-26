# Test — add-standalone-cli

## TLDR

Review the diff from `implementation/step-add-standalone-cli.md`. Verify the standalone TS CLI builds, runs, mirrors the Python CLI's flag set, drops `xml`/`xmltei`, and writes correctly-named output files. Auto-fix any deviation.

## Inputs

- `../implementation/step-add-standalone-cli.md`
- `../user-entry-log/entry-qa-xml-formats.md`
- `/r/contextractor/apps/contextractor-standalone/src/contextractor_cli/main.py` (Python flag inventory)

## Review

- `apps/contextractor-standalone/{package.json, tsconfig.json, src/{cli.ts, crawler.ts, config.ts}}` exist.
- For each flag in the Python `extract` command, the TS CLI has the equivalent kebab-case flag with the same type, default, and help text.
- `FORMAT_EXTENSIONS` maps only `txt`, `markdown`, `json`, `html`.
- No `entry.py`, `build.py`, `*.spec`, or `npm/` directory propagated.
- Output filename slug helper produces the same string as the Python `_url_to_filename` for the same input.
- Agent: `ts-pro` for the CLI code, `code-reviewer` for diff hygiene.

## Verify

- `pnpm -F @contextractor/standalone build` exits 0.
- `pnpm -F @contextractor/standalone test` passes (config loader + slug helper).
- `node apps/contextractor-standalone/dist/cli.js https://example.com --max-pages 1 -o /tmp/ctx-smoke` writes at least one file under `/tmp/ctx-smoke`.
- `grep -ri 'xml\\|xmltei\\|pyinstaller\\|typer\\|browserforge' apps/contextractor-standalone/` returns nothing.

## Auto-fix

If a flag is missing or behaves differently from the Python original, add or correct it with a minimal patch. Rerun the suite.
