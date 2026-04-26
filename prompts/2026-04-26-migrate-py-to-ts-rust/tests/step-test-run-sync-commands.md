# Test — run-sync-commands

## TLDR

Re-run `/sync/docs` and `/sync/gui` after `implementation/step-run-sync-commands.md`. Both must report no drift. Auto-fix any drift surfaced by treating the TS engine as the canonical source.

## Inputs

- `../implementation/step-run-sync-commands.md`
- `.claude/commands/sync/docs.md`, `.claude/commands/sync/gui.md`

## Review

- The previous run's diff is reasonable: schema additions match new TS engine fields; removed schema properties have no TS counterpart and were not silently dropped without a note.
- No regressions: `pnpm -r build` and `pnpm -r test` still pass.

## Verify

- A second run of `/sync/gui` produces no edits.
- A second run of `/sync/docs` produces no edits.
- `pnpm -r build`, `pnpm -r test`, `cargo build --workspace`, `cargo test --workspace` exit 0.

## Auto-fix

If `/sync/gui` keeps re-flipping a value, the source-of-truth precedence is being mishandled — TS engine wins. Patch the schema or the napi-rs `TrafilaturaConfig` mirror to match TS, never the other direction.
