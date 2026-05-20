# Schema Gen Input Schema Report

**Date:** 2026-05-20

## Results

- **input_schema.json changed:** No (no diff vs HEAD)
- **dataset_schema.json changed:** No (no diff vs HEAD)
- **Snapshot test:** Passed (85/85 tests across 4 files)

## Details

### Step GENERATE

```
pnpm --filter @contextractor/gen-input-schema start
```

Generator ran successfully. Biome formatted both output files:
- `apps/apify-actor/.actor/input_schema.json`
- `apps/apify-actor/.actor/dataset_schema.json`

No changes detected against HEAD — schema is already in sync with the Zod source.

### Step VERIFY

```
pnpm --filter @contextractor/schema test
```

All 85 tests passed in 4 test files. The `to-apify-schema.test.ts` snapshot test confirmed the generated JSON matches `toApifyInputSchema(ContextractorInput)` exactly.

## Errors

None.
