# Step run-sync-commands

## TLDR

Run `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/sync/docs.md` and `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/sync/gui.md` (now updated to reflect the TS-engine reality from `step-update-claude-config`). Resolve any drift surfaced.

## Skills and agents

- Agent: `code-reviewer` to inspect the diff before commit.

## Inputs

- Read both sync command files: they describe their own EXTRACT / SYNC / VERIFY phases.

## Actions

- Run `/sync/docs` — it walks every README and brings them in line with the TS engine config + Apify schemas + standalone CLI flags.
- Run `/sync/gui` — internal-consistency check between TS engine config, TS standalone CLI flags, the Apify input schema, and the napi-rs binding's `TrafilaturaConfig` mirror.
- Resolve any divergence:
  - If `/sync/gui` flags a field present in TS but missing in the Apify input schema → add it to the schema with a sensible default and description.
  - If a field is present in the schema but missing from TS → either add it to TS or remove it from the schema. Treat the **TS engine** as the authoritative source-of-truth (it directly maps to the napi-rs binding).
  - If output formats drift, force them back to `txt | markdown | json | html`.

## Constraints

- Do not auto-delete schema properties without confirming with the TS source.
- Do not modify rules in `.claude/rules/`.

## Done when

- A second run of `/sync/gui` reports no drift.
- `pnpm -r build` and `pnpm -r test` still pass.
- The matching `tests/step-test-run-sync-commands.md` passes.
