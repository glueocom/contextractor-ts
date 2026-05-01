---
description: Regenerate apps/apify-actor/.actor/input_schema.json from the Zod schema
allowed-tools: Bash(pnpm:*), Read
---

Regenerate `apps/apify-actor/.actor/input_schema.json` from the `@contextractor/schema` Zod 4 source of truth. The generated JSON is never hand-edited — always regenerate from the Zod schema.

## Step GENERATE: Regenerate Input Schema

```bash
pnpm --filter @contextractor/gen-input-schema start
```

This reads `packages/schema/src/input.ts` and writes `apps/apify-actor/.actor/input_schema.json`, formatted with Biome.

## Step VERIFY: Confirm Snapshot Test Passes

```bash
pnpm --filter @contextractor/schema test
```

The snapshot test in `packages/schema/test/to-apify-schema.test.ts` verifies the generated JSON matches `toApifyInputSchema(ContextractorInput)` exactly. If it fails, the fix belongs in `packages/schema/src/input.ts`.

## Step REPORT: Save Report

Save `autonomous-task-output/schema-gen-input-schema-report.md` with:
- Whether `input_schema.json` changed
- Whether the snapshot test passed
- Any errors encountered
