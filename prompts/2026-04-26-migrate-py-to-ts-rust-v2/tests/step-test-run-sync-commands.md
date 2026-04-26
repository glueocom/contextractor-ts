# Test step run-sync-commands

## TLDR

Reviews `../implementation/step-run-sync-commands.md`. Re-runs `/sync/docs` and `/sync/gui` and verifies they exit with no remaining drift.

## Inputs

- `../implementation/step-run-sync-commands.md`.
- `.claude/commands/sync/docs.md`, `.claude/commands/sync/gui.md`.

## Verification

- Re-running `/sync/docs` produces no edits.
- Re-running `/sync/gui` produces no edits and reports no mismatches in its `Step VERIFY`.
- Specifically: TS engine ⇄ napi-rs binding match; TS engine ⇄ standalone CLI match; TS engine ⇄ Apify input schema match; defaults agree; `OutputFormat` is exactly `txt | markdown | json | html`; `pruneXpath` and `dateExtractionParams` are absent everywhere.
- `actor.json.name` is `contextractor-test`; `dockerContextDir` is `../../..`; description mentions `rs-trafilatura` and `Crawlee`.
- The actor's `package.json` declares `"@contextractor/engine": "workspace:*"` — no `vendor/` directory.

## Auto-fix examples

- A `sync` command surfaces a default mismatch — fix the canonical TS engine value, then propagate via the sync command.
- A `sync` command surfaces a regression of `xml` in an enum — remove it.

## Done when

Both sync commands run idempotent (no diff on re-run).
