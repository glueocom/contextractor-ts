# Step RUN_SYNC: Run `/sync:gui` and `/sync:docs`

## TLDR

Run `/sync:gui` first (internal-consistency auto-fix across Rust, TS validators, and Apify schemas), then `/sync:docs` (sync READMEs with the new state). Reconcile any flagged inconsistencies before declaring the step done.

## Skills and agents

- `apify-schemas` — for `/sync:gui` semantics.

## Step GUI: `/sync:gui`

Run `/sync:gui`. The command runs against the post-rename `apps/contextractor-apify/` paths.

Expected outcomes:

- Schema fields without a Rust counterpart are listed for review (e.g. anything we forgot to drop after the XML/TEI removal).
- Defaults that disagree are listed.

For each finding, fix the canonical side per the decision matrix in `.claude/commands/sync/gui.md` Step REPORT.

## Step DOCS: `/sync:docs`

Run `/sync:docs`. Expect updates to:

- Root `README.md`.
- `apps/contextractor-apify/README.md`.
- Any other `README.md` under the repo (`apps/contextractor-standalone/README.md`, `packages/contextractor_engine/README.md`, `tools/*/README.md`).

The version stamp at the end of root `README.md` updates to the current UTC timestamp.

## Step COMMIT: Commit

Both sync commands stage and commit on their own. Verify two commits land: "Fix internal package consistency" and "Sync documentation with current Rust + TS state and Apify schema". Push.
