# Dead Code Autofix — Deferred Follow-Up

All three decisions have been resolved.

## ✅ RESOLVED — EXAMPLES-WORKSPACE: Add examples to knip scope

Chose Option A. `examples/**` was already present in `knip.json` at the repo root. Documented
in `SPEC.md` (Stack section) and `.claude/rules/testing.md` (Dead-Code Analysis section)
explaining why examples are excluded and why `pnpm-workspace.yaml` should not be used to fix
this. Knip runs clean. Fixed in commit 40d103d.

## ✅ RESOLVED — STANDALONE-DATASETCONTENT: `DatasetContent` type removed

Chose Option B (remove). Speculative export with no workspace consumers and no example usage.
Removed from `apps/standalone/src/index.ts`, stripped from the README import example, and
deleted from `apps/standalone/SPEC.md`. Fixed in commit d7c127a.

## ✅ RESOLVED — SCHEMA-OUTPUTTYPE: `ContextractorOutputType` exposure consolidated

Type definition moved from `packages/schema/src/source-of-truth/output.ts` to
`packages/schema/src/index.ts`. `output.ts` no longer directly exports the type; it is only
accessible via the package's single public entry point (`index.ts`). The type is still exported
as public API for external TypeScript consumers. Fixed in commit f92d007.
