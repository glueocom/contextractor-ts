# Test step generate-r-tools-prompt

## TLDR

Reviews `../implementation/step-generate-r-tools-prompt.md`. Verifies the emitted follow-up prompt at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite/` has the right shape and scope, and **was not executed**.

## Inputs

- `../implementation/step-generate-r-tools-prompt.md`.
- `../migrate-py-to-ts-rust-v2-notes/cross-repo-followup.md`.

## Verification

- Directory `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite/` exists with subdirectories `user-entry-log/`, `propagate-contextractor-rewrite-notes/`, `implementation/`, `tests/`.
- `implementation/master.md` exists; lists at least the five steps named in `../implementation/step-generate-r-tools-prompt.md`.
- Each implementation step file exists and starts with a TLDR.
- `tests/master.md` exists; lists matching `step-test-*.md` plus `step-test-user-intent.md`.
- `propagate-contextractor-rewrite-notes/r-tools-inventory.md` exists and lists `apps/contextractor-site`, `apps/contextractor-api`, `distributed-packages/contextractor-engine`, and `.claude/commands/projects/contextractor/`.
- `git status` in `/Users/miroslavsekera/r/tools/` shows only new files under `prompts/2026-04-26-propagate-contextractor-rewrite/` — no modifications outside `prompts/`.
- The emitted prompt covers (at minimum):
  - `/help/pypi/` "modify, do not delete" instruction.
  - "Built on rs-trafilatura and Crawlee" wording across `apps/contextractor-site` copy and meta tags.
  - Schema sync with the new `apps/contextractor-apify/.actor/` (no XML/XMLTEI; no `pruneXpath`/`dateExtractionParams`).
  - `distributed-packages/contextractor-engine` replacement strategy (with a Q&A entry for replace-vs-delete).
  - Final `sync-all` command run.

## Auto-fix examples

- A required step file missing — generate it from the inventory.
- A wrong path or typo — edit.
- An accidental edit outside `prompts/` in `r/tools/` — revert immediately.

## Done when

The follow-up prompt is structurally complete and `r/tools/` has no edits outside `prompts/`.
