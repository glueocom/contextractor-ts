# Schema Gen Input Schema Report

**Date:** 2026-05-03

## Results

- **input_schema.json changed:** No (no diff vs HEAD)
- **Snapshot test passed:** Yes — 2 test files, 19 tests, all passed
- **Errors:** None

## Details

`pnpm --filter @contextractor/gen-input-schema start` ran successfully, wrote `apps/apify-actor/.actor/input_schema.json`, and Biome formatted 1 file.

`pnpm --filter @contextractor/schema test` passed all 19 tests in `packages/schema/test/to-apify-schema.test.ts` and adjacent test files.
