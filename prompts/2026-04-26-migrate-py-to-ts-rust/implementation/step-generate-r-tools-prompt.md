# Step generate-r-tools-prompt

## TLDR

Write a new prompt at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite.md` describing the cross-repo follow-up work for `r/tools/`. Do **not** execute it.

## Skills and agents

- Agent: `prompt-writer` (creates new prompt files per `.claude/rules/prompt-engineering-knowledge.md`).

## Inputs

- Read `../migrate-py-to-ts-rust-notes/cross-repo-followup.md` — the canonical surface inventory and required follow-up work.
- Read `/Users/miroslavsekera/r/tools/.claude/commands/projects/contextractor/{sync-all.md, sync-docs.md, sync-gui.md}` to understand the orchestrator the follow-up prompt must invoke.

## Actions

- Create `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite.md`. Structure it as a runnable prompt with:
  - **Goal**: propagate the contextractor-ts TS-engine + napi-rs rewrite into `r/tools/` surfaces.
  - **Scope**: only `r/tools/`. The contextractor-ts repo is read-only input.
  - **Surfaces**:
    - `apps/contextractor-site/` — replace PyPI / npm install messaging with Apify-actor-only messaging; **modify** `/help/pypi/` route to mark the PyPI package as no longer maintained (do not delete); remove links to `/help/pypi/` from any other docs and `.md` files.
    - `apps/contextractor-api/` — sync schemas/fixtures to the new input/output schemas in `apps/contextractor-apify/.actor/`.
    - `distributed-packages/contextractor-engine/` — replace the Python wheel artifact with the new TS engine artifacts (TS `dist/` + napi-rs prebuilt `.node` files), or remove if no longer distributed from this monorepo.
    - `.claude/commands/projects/contextractor/{sync-docs.md, sync-gui.md}` — update source-of-truth paths to `apps/contextractor-apify/.actor/`, `packages/contextractor-engine/src/index.ts`, and `apps/contextractor-standalone/src/cli.ts` in the contextractor-ts repo.
  - **Final action**: run `/Users/miroslavsekera/r/tools/.claude/commands/projects/contextractor/sync-all.md`.
  - **Out of scope**: production deploys for `contextractor-site` and `contextractor-api`.

## Constraints

- Follow `.claude/rules/formatting-guidelines.md` (named steps, no numbered headers).
- Do not run the generated prompt — leave that to a future invocation.
- Do not modify any file inside `r/tools/` other than creating the new prompt file.

## Done when

- The new prompt file exists at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite.md`.
- `git status` for `r/tools/` shows only the new file.
- The matching `tests/step-test-generate-r-tools-prompt.md` passes.
