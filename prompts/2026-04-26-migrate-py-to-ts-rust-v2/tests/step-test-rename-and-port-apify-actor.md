# Test step rename-and-port-apify-actor

## TLDR

Reviews `../implementation/step-rename-and-port-apify-actor.md`. Verifies the rename, TS port, schema cleanup, multi-stage Dockerfile, and the `actor.json` production-protection guards.

## Inputs

- `../implementation/step-rename-and-port-apify-actor.md`.
- `../migrate-py-to-ts-rust-v2-notes/apify-monorepo-deploy.md`.
- `../migrate-py-to-ts-rust-v2-notes/v1-lessons-codified.md`.
- `../user-entry-log/entry-qa-config-field-scope.md`.

## Verification

- `apps/contextractor` no longer exists. `apps/contextractor-apify` exists with TS sources, `.actor/`, multi-stage Dockerfile, and **no** `vendor/`.
- `git log --oneline --diff-filter=R apps/contextractor-apify/` shows the rename commit (history preserved via `git mv`).
- `jq -r '.name' apps/contextractor-apify/.actor/actor.json` returns `contextractor-test`. Anything else stops the auto-fix and surfaces the value (this is one of the destructive-fix exceptions in `master.md`).
- `jq -r '.dockerContextDir' apps/contextractor-apify/.actor/actor.json` returns `../../..`.
- `jq -r '.description' apps/contextractor-apify/.actor/actor.json` mentions both `rs-trafilatura` and `Crawlee`. No `pypi` / `npm package` mentions.
- `grep -ri 'xml\|xmltei' apps/contextractor-apify/.actor/` returns nothing.
- `grep -ri 'pruneXpath\|dateExtractionParams' apps/contextractor-apify/.actor/` returns nothing.
- `apps/contextractor-apify/package.json` declares `"@contextractor/engine": "workspace:*"`, `apify`, `crawlee`, `playwright`, plus Biome / vitest / TS dev deps.
- `apps/contextractor-apify/package.json` `scripts.test` includes `--passWithNoTests`.
- `apps/contextractor-apify/Dockerfile` is multi-stage, uses `apify/actor-node-playwright-chrome:22`, and runs `pnpm --filter @contextractor/apify --prod deploy /deploy`.
- `pnpm -F @contextractor/apify build` succeeds.
- `apify run` from `apps/contextractor-apify/` writes a non-empty dataset entry against the default test URL.
- `grep -ri 'pypi\|pip install\|browserforge\|trafilatura>=' apps/contextractor-apify/` returns nothing.

## Auto-fix examples

- `actor.json` description missing the Crawlee mention — edit to add it.
- `vendor/` directory present — `rm -rf` it and add `"@contextractor/engine": "workspace:*"` to `package.json`.
- Multi-stage Dockerfile missing `pnpm deploy` — rewrite per `apify-monorepo-deploy.md`.
- Stale Python imports in TS sources — replace with the TS equivalent.

## Done when

Rename and port land cleanly. All `actor.json` guards pass. Local `apify run` smoke produces output.
