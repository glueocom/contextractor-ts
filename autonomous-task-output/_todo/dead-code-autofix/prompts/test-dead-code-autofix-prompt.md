# Dead Code Autofix — Deferred Follow-Up

Two items need a human decision before action can be taken.

## Decision EXAMPLES-WORKSPACE: Add examples to knip scope

Knip does not scan `examples/` (not in `pnpm-workspace.yaml`). This causes false positives for every export from `apps/standalone` that is consumed by examples. Two options:

- **Option A — Add a knip config** (`knip.json` at repo root) with `"ignore": ["examples/**"]` to explicitly exclude examples and suppress the false positives. Cleaner: knip stops flagging things it can't see.
- **Option B — Add examples to the workspace** (`pnpm-workspace.yaml`). Gives knip full visibility, but may have side effects (examples would participate in `pnpm build`/`pnpm test`).

Recommended: Option A — add a `knip.json` config.

```json
{
  "ignore": ["examples/**"],
  "ignoreBinaries": [],
  "ignoreExportsUsedInFile": true
}
```

## Decision STANDALONE-DATASETCONTENT: Assess `DatasetContent` type for removal

`DatasetContent` in `apps/standalone/src/index.ts` is not used in any examples and not imported by any workspace package. It mirrors `DatasetContent<Data>` from `@crawlee/core`.

- If external consumers need it: keep as-is.
- If it was added speculatively and has no known users: remove the interface and the export.

Check `CHANGELOG.md` or git log for context on when/why it was added, then decide.

## Decision SCHEMA-OUTPUTTYPE: Assess `ContextractorOutputType` exposure

`ContextractorOutputType` is exported both from `packages/schema/src/source-of-truth/output.ts` and re-exported from `packages/schema/src/index.ts`. No workspace consumer imports it directly. It is the inferred type of the `ContextractorOutput` Zod schema.

If external consumers use it for type-checking output records, keep it. If not, the re-export from `source-of-truth/output.ts` is redundant (the one from `index.ts` is sufficient as a single entry point).

Consider removing the direct export from `output.ts` and keeping only the re-export in `index.ts`.
