# Test — rename-and-port-apify-actor

## TLDR

Review the diff from `implementation/step-rename-and-port-apify-actor.md`. Verify the actor folder is renamed, sources are TypeScript, `.actor/` schemas are propagated and PyPI/xml-scrubbed, and the Dockerfile is Node-based. Auto-fix any deviation.

## Inputs

- `../implementation/step-rename-and-port-apify-actor.md`
- `../user-entry-log/entry-qa-xml-formats.md`
- `../user-entry-log/entry-qa-test-actor.md`
- `../migrate-py-to-ts-rust-notes/source-repo-inventory.md` (apify section)

## Review

- `apps/contextractor/` does not exist; `apps/contextractor-apify/` does.
- `apps/contextractor-apify/src/{main.ts, handler.ts, extraction.ts, config.ts}` exist; no `.py` files anywhere in `apps/contextractor-apify/`.
- `package.json` has deps `apify`, `crawlee`, `playwright`, `@contextractor/engine`.
- `.actor/actor.json` description does not mention PyPI or npm packages; `meta.templateId` reflects Node, not Python.
- `.actor/{input_schema, output_schema, dataset_schema}.json` enums do not contain `xml` or `xmltei`.
- Dockerfile base image is a Node + Playwright Apify base.
- Agent: `apify-actor-development` and `apify-schemas` skills active; delegate review to `ts-pro` for the TS code and `code-reviewer` for the schema diff.

## Verify

- `grep -ri 'pypi\\|pip install\\|browserforge\\|trafilatura>=' apps/contextractor-apify/` returns nothing.
- `grep -ri '\"xml\"\\|\"xmltei\"' apps/contextractor-apify/.actor/` returns nothing.
- `pnpm -F @contextractor/apify build` exits 0.
- From `apps/contextractor-apify/`: `apify run` against a single-URL test input completes and emits a dataset record.
- Schema validation: `apify validate` (or equivalent) passes.

## Auto-fix

If `apify run` fails, narrow the failure to one of: input schema, native binding load on darwin-arm64, Crawlee/Playwright config, or engine API mismatch. Patch the smallest surface and rerun.
