# Schema Gen Input Schema Report

**Date:** 2026-05-12

## Summary

- `input_schema.json` changed: No (no diff vs HEAD)
- `dataset_schema.json` changed: No (no diff vs HEAD)
- Snapshot test: Passed (43/43 tests)

## Details

### Step GENERATE

`pnpm --filter @contextractor/gen-input-schema start` ran successfully.

Both files were regenerated and formatted by Biome:
- `apps/apify-actor/.actor/input_schema.json`
- `apps/apify-actor/.actor/dataset_schema.json`

### Step VERIFY

`pnpm --filter @contextractor/schema test` passed.

```
Test Files  4 passed (4)
Tests       43 passed (43)
Duration    394ms
```

### Errors

None.
