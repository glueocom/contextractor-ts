# Step run-sync-commands

## TLDR

Run `.claude/commands/sync/docs.md` then `.claude/commands/sync/gui.md` against the migrated repo. Fix any drift the commands surface — they enforce the canonical `TrafilaturaConfig` interface, the `OutputFormat` set, the `pruneXpath` / `dateExtractionParams` ban, the `actor.json` requirements, the `vendor/`-removal rule, and the `built on rs-trafilatura and Crawlee` wording.

## Skills and Agents

- Agents: `ts-pro` (apply auto-fixes the commands cannot make), `code-reviewer`.

## Reference reading

- `.claude/commands/sync/docs.md` (the canonical README sync command for this repo).
- `.claude/commands/sync/gui.md` (the canonical config-consistency verifier).
- `../migrate-py-to-ts-rust-v2-notes/v1-lessons-codified.md` (the lessons these commands encode).

## Actions

### Pre-flight

- Confirm preceding steps landed: TS engine, napi-rs binding + prebuilds, Apify Actor + `.actor/`, standalone CLI, vitest tests, all READMEs.
- Confirm `apps/contextractor-apify/.actor/actor.json` `name` is `contextractor-test` and `dockerContextDir` is `../../..`.

### Run `/sync/docs`

- Execute the `Sync Contextractor Repo Documentation` workflow defined in `.claude/commands/sync/docs.md` end-to-end (the command is allowed to read/edit docs and READMEs).
- Apply every auto-fix the command makes.
- Resolve every mismatch the command surfaces in `Step VERIFY`. Do not silently override the canonical sources — fix the divergent surface to match the canonical one.

### Run `/sync/gui`

- Execute `.claude/commands/sync/gui.md`.
- The canonical surface is `packages/contextractor-engine/src/index.ts`. The napi-rs binding, the standalone CLI, and the Apify input schema follow the TS interface.
- Auto-fix conservatively: schemas, the CLI, and the napi-rs binding may grow to match the TS engine, never shrink without human review.
- The command's "No-op fields" check verifies `pruneXpath` and `dateExtractionParams` are absent. Fix any reappearance.

### Commit

- Commit each command's output as a separate commit. Subject lines: `sync(docs): align READMEs with TS engine + Crawlee` and `sync(gui): align schemas, CLI, napi binding with TS engine`.

## Constraints

- Do not edit `prompts/**` regardless of what the commands surface — the prompts directory is historical record.
- Do not change any source-of-truth file beyond what the commands themselves auto-fix; the command is the source of truth for this step.
- If `/sync/gui` flags a property in the input schema with no TS counterpart, do not auto-delete — surface the finding.

## Done when

- `/sync/docs` and `/sync/gui` both run to completion with no remaining drift.
- All four canonical surfaces (`packages/contextractor-engine/src/index.ts`, `packages/contextractor-engine/native/src/lib.rs`, `apps/contextractor-standalone/src/cli.ts`, `apps/contextractor-apify/.actor/*.json`) are mutually consistent.
- The matching `../tests/step-test-run-sync-commands.md` passes.
