# Test — user-intent (final)

## TLDR

Review the **complete migration** against the original user intent and every recorded Q&A decision. Flag gaps and mismatches, then auto-fix them. This is the last gate before declaring the migration done.

## Inputs

Read every file before reviewing:

- `../user-entry-log/entry-initial-prompt.md` — original 17-line raw prompt.
- `../user-entry-log/entry-qa-rust-bridge.md` — napi-rs decision.
- `../user-entry-log/entry-qa-xml-formats.md` — drop xml/xmltei.
- `../user-entry-log/entry-qa-unit-tests.md` — vitest port.
- `../user-entry-log/entry-qa-test-actor.md` — `glueo/contextractor-test`.
- `../migrate-py-to-ts-rust-notes/{source-repo-inventory.md, target-state-snapshot.md, rs-trafilatura.md, cross-repo-followup.md}`.

## Requirements ↔ implementation map

For each requirement in `entry-initial-prompt.md`, identify the implementation step that delivered it:

| Requirement (line)                                                                  | Implementation step(s)                                                                       |
|-------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| L1 propagate functionality from `r/contextractor/`; switch to TS + `rs-trafilatura` | `step-build-napi-binding`, `step-port-engine-to-ts`, `step-rename-and-port-apify-actor`, `step-add-standalone-cli` |
| L2 `.actor/` propagated to `apps/contextractor-apify/.actor/`                       | `step-rename-and-port-apify-actor`                                                           |
| L3 engine renamed to `contextractor-engine`, TS, uses `rs-trafilatura`              | `step-rename-engine-package`, `step-build-napi-binding`, `step-port-engine-to-ts`            |
| L5 rename `apps/contextractor` → `apps/contextractor-apify`, propagate              | `step-rename-and-port-apify-actor`                                                           |
| L6 propagate `contextractor-standalone`                                             | `step-add-standalone-cli`                                                                    |
| L8 propagate markdown/docs, no Python                                               | `step-update-docs`                                                                           |
| L9 propagate `tools/`                                                               | `step-port-tools-tests`                                                                      |
| L11 remove all PyPI mentions in target docs                                         | `step-update-docs`                                                                           |
| L13 run all tests, push only to `glueo/contextractor-test`                          | `step-local-and-platform-tests`                                                              |
| L15 run `/sync/docs` and `/sync/gui`                                                | `step-run-sync-commands`                                                                     |
| L17 emit follow-up prompt for `r/tools/`; modify `/help/pypi/`; remove links        | `step-generate-r-tools-prompt`                                                               |

If any row above lacks a delivering step, that's a gap — fix it now.

## Q&A ↔ implementation map

- **napi-rs**: `packages/contextractor-engine/native/` Cargo crate exists; TS engine loads it. Verify.
- **Drop xml/xmltei**: `grep -rni '\"xml\"\\|\"xmltei\"' apps packages tools .actor .claude` returns nothing outside test-skip placeholders. Verify.
- **vitest**: `tools/generated-unit-tests/` is a TS vitest package; HTML fixtures match source byte-for-byte. Verify.
- **`glueo/contextractor-test`**: CLAUDE.md, `.claude/commands/platform/push-and-get-working.md`, recent `apify push` history all consistent with `glueo/`. Verify.

## Verify

- `git status` is clean.
- `pnpm -r build`, `pnpm -r test`, `pnpm -r lint`, `cargo build --workspace`, `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings` all exit 0.
- Latest `glueo/contextractor-test` build is `succeeded`.
- The follow-up prompt at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite.md` exists and was not executed (`/r/tools/` has no other modifications).
- `grep -rni 'pypi\\|/help/pypi' --include='*.md' --include='*.json' --include='*.toml' . | grep -v '^./prompts/'` returns nothing.

## Auto-fix

For each gap or mismatch, apply the smallest patch in the lowest-numbered implementation step's domain (engine before app before tools before docs before claude-config before sync). Rerun the local + platform suites. Do not declare done until every check is green and every requirement maps to a delivered step.
