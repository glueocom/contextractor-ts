# Step WRITE_SIBLING: Author propagation prompt for `/r/tools/`

## TLDR

Author a full structured prompt at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-ts-changes/` that propagates this migration's outcomes into `contextractor-site`, `contextractor-api`, `distributed-packages/contextractor-engine`, and `.claude/commands/projects/contextractor`, then runs `/projects/contextractor/sync-all`.

## Skills and agents

- `prompt-writer` agent — primary author.
- `prompt-formatter` agent — final formatting pass.

## Inputs

- Decision: `../user-entry-log/entry-qa-sibling-prompt.md`.
- PyPI deprecation matrix: `../migrate-py-to-ts-rust-notes/pypi-deprecation.md`.
- This prompt's outputs (engine API, schema diff, supported formats) — the sibling prompt cites them as the source of truth.

## Step DIR_INIT: Create directory

```bash
mkdir -p /Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-ts-changes/{user-entry-log,implementation,propagate-contextractor-ts-changes-notes}
```

## Step ENTRY_LOG: Capture the user intent verbatim

Write `user-entry-log/entry-initial-prompt.md` with a concise statement of intent: propagate the `contextractor-ts` migration outcomes into the `tools` repo. Reference the originating prompt at `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-26-migrate-py-to-ts-rust/`.

Also copy the four QA decision files from this prompt into `user-entry-log/` (they are inherited constraints):

- `entry-qa-format-gap.md`
- `entry-qa-apify-owner.md`
- `entry-qa-rename-scope.md`
- `entry-qa-sibling-prompt.md`

## Step WRITE_MASTER: master.md

Write `implementation/master.md` covering:

- TLDR.
- Skills and agents (`apify-ops`, `apify-schemas`, `ts-pro`, `general-purpose`, `code-reviewer`).
- Step list (see below).
- Shared context: source-of-truth pointers back to this prompt's outputs.
- Constraints (no production deploys, no PyPI artefacts, drop XML/XML-TEI from any user-facing format list).

## Step WRITE_STEPS: Implementation steps

Author each of these step files under `implementation/`:

- `step-update-site.md` — propagate changes to `apps/contextractor-site/`. Modify `content/automatic/help/pypi/pypi.md` to mark the PyPI package as no longer supported (do **not** delete). Remove links to `https://www.contextractor.com/help/pypi/` from every other content file (audit list in `../migrate-py-to-ts-rust-notes/pypi-deprecation.md`). Update the supported-format copy: HTML, TXT, JSON, Markdown.
- `step-update-api.md` — propagate changes to `apps/contextractor-api/`. Update zod schemas / TS types so they mirror the Rust engine config (no XML/TEI fields, owner is `glueo`).
- `step-update-distributed-engine.md` — replace `distributed-packages/contextractor-engine/contextractor_engine-0.3.12-py3-none-any.whl` with the new artefact. Decide between (a) republishing as a Rust crate with TS bindings, (b) shipping the standalone Rust CLI binary as an npm-distributed dependency, or (c) deleting the directory entirely if the API and site no longer need a shared library. Pick (c) unless API or site code imports from it.
- `step-update-claude-commands.md` — sync `.claude/commands/projects/contextractor/{sync-all,sync-docs,sync-gui}.md` against `contextractor-ts`'s `.claude/commands/sync/{docs,gui}.md`. Update every `apps/contextractor/` reference to `apps/contextractor-apify/`. Update Apify owner to `glueo`.
- `step-run-sync-all.md` — run `/projects/contextractor/sync-all`, fix any reported inconsistencies, commit.
- `step-review.md` — review every prior step's diff, run all tools-repo build/lint/test commands, verify nothing in the `tools` repo still references `contextractor` (Python flavour) or PyPI as a current install path.

## Step VERIFY: Verify

- `ls /Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-ts-changes/implementation/` lists `master.md` plus six step files plus `step-review.md`.
- Each step file has a TLDR, skills/agents section, named steps, and references at least one note or QA file.
