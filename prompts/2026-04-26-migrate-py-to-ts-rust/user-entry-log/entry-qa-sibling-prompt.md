# QA — Sibling prompt for `/r/tools/`

## Question

The raw prompt asks to also write a sibling prompt for `/Users/miroslavsekera/r/tools/` that propagates changes to `contextractor-site`, `contextractor-api`, `distributed-packages/contextractor-engine`, and `.claude/commands/projects/contextractor`. How thorough should the sibling prompt be?

## Answer

**Full structured prompt with steps.**

## Implication

- One step in this prompt's `implementation/` is dedicated to authoring the sibling prompt.
- Sibling output lives at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-ts-changes/` with:
  - `user-entry-log/entry-initial-prompt.md` — captured user intent (this repo's outputs become the input).
  - `implementation/master.md` + `step-*.md` for each propagation target plus `step-review.md`.
- Sibling prompt covers:
  - `apps/contextractor-site/` — content + components, including the `automatic/help/pypi/pypi.md` page (modify, don't delete; mark PyPI package as no longer supported; remove links to `https://www.contextractor.com/help/pypi/` from other docs).
  - `apps/contextractor-api/` — TS API surface kept in sync with Rust binary CLI / engine config.
  - `distributed-packages/contextractor-engine/` — currently a Python wheel; replace with the Rust crate or its TS bindings (the sibling prompt decides; likely TS bindings or a thin re-export).
  - `.claude/commands/projects/contextractor/sync-all.md`, `sync-docs.md`, `sync-gui.md` — kept in sync with this repo's `.claude/commands/sync/*.md`.
  - Final step runs `/projects/contextractor/sync-all.md`.
