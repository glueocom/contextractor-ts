# Step generate-r-tools-prompt

## TLDR

Emit a structured follow-up prompt under `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite/` so a future Claude session can propagate the contextractor rewrite into `r/tools/`. **Do not execute it** — only create the files.

## Skills and Agents

- Agents: `prompt-writer` (author the new prompt structure), `code-reviewer` (review the emitted files).

## Reference reading

- `../migrate-py-to-ts-rust-v2-notes/cross-repo-followup.md` (inventory of `r/tools/` surfaces, scope and out-of-scope items).
- `../user-entry-log/entry-initial-prompt.md` (`r/tools/` propagation list and the `/help/pypi/` "modify-don't-delete" rule).
- `.claude/commands/meta/write-prompt.md` (this repo's canonical structure for new prompts; mirror it).

## Actions

### Read-only inventory of `r/tools/`

- Confirm presence and current content of:
  - `apps/contextractor-site/` (Next.js marketing/help site; contains `/help/pypi/` route).
  - `apps/contextractor-api/` (Next.js API).
  - `distributed-packages/contextractor-engine/` (currently bundles Python wheel).
  - `.claude/commands/projects/contextractor/{sync-all.md, sync-docs.md, sync-gui.md}`.
- Capture the inventory in the emitted prompt's `*-notes/` folder so the future session does not need to re-snapshot.

### Emit the follow-up prompt

Create directory `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite/` with this layout (mirroring `.claude/commands/meta/write-prompt.md`):

```
2026-04-26-propagate-contextractor-rewrite/
├── propagate-contextractor-rewrite-notes/
│   └── r-tools-inventory.md
├── user-entry-log/
│   └── entry-initial-prompt.md
├── implementation/
│   ├── master.md
│   ├── step-update-contextractor-site.md
│   ├── step-update-contextractor-api.md
│   ├── step-replace-distributed-engine.md
│   ├── step-update-claude-commands.md
│   └── step-run-sync-all.md
└── tests/
    ├── master.md
    ├── step-test-update-contextractor-site.md
    ├── step-test-update-contextractor-api.md
    ├── step-test-replace-distributed-engine.md
    ├── step-test-update-claude-commands.md
    ├── step-test-run-sync-all.md
    └── step-test-user-intent.md
```

Each implementation step covers exactly the corresponding scope from `../migrate-py-to-ts-rust-v2-notes/cross-repo-followup.md`. Each test step automatically reviews the diff and fixes regressions per the meta:write-prompt convention.

### Coverage requirements for the emitted prompt

- `step-update-contextractor-site.md` covers:
  - Replace PyPI / npm install instructions with Apify-actor-only messaging.
  - **Modify** (do not delete) `/help/pypi/` route to mark the PyPI package as no longer maintained.
  - Remove links to `/help/pypi/` from other docs and `.md` files.
  - Apply the "built on rs-trafilatura and Crawlee" wording in copy and meta tags.
- `step-update-contextractor-api.md` covers:
  - Sync schemas / fixtures with the new `apps/contextractor-apify/.actor/` schemas (XML / XML-TEI removed; `pruneXpath` / `dateExtractionParams` removed).
  - "Built on" wording in the README.
- `step-replace-distributed-engine.md` covers:
  - Replace `distributed-packages/contextractor-engine/` (currently Python wheel) with the TS engine artifact set + napi-rs prebuilds, OR remove the directory if no longer distributed from the monorepo. The emitted prompt should include a Q&A entry asking which.
  - "Built on" wording in the README of the replacement.
- `step-update-claude-commands.md` covers:
  - Update `.claude/commands/projects/contextractor/{sync-docs.md, sync-gui.md}` source-of-truth paths to match the TS-engine + napi-rs reality.
- `step-run-sync-all.md` covers:
  - Run `/Users/miroslavsekera/r/tools/.claude/commands/projects/contextractor/sync-all.md`.

## Constraints

- **Do not execute** any of the emitted prompt's steps. This step is creation-only.
- **Do not write outside** `/Users/miroslavsekera/r/tools/prompts/` — no edits to `apps/`, `distributed-packages/`, or `.claude/commands/projects/contextractor/` of `r/tools/`.
- Do not delete the existing `/help/pypi/` route content; the follow-up prompt only modifies it.
- Mirror the structure of `.claude/commands/meta/write-prompt.md` — the future session may invoke the same conventions.

## Done when

- `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite/` exists with `user-entry-log/`, `*-notes/`, `implementation/`, `tests/`.
- `implementation/master.md` lists all five steps with one-line descriptions.
- `tests/master.md` lists all five test steps plus `step-test-user-intent.md`.
- `git status` in `r/tools/` shows only new files under `prompts/2026-04-26-propagate-contextractor-rewrite/`.
- The matching `../tests/step-test-generate-r-tools-prompt.md` passes.
