# Schema Gen Input Schema Report

**Date:** 2026-05-12

## Results

- **input_schema.json changed:** No — file was already up to date
- **Snapshot test:** Passed (79/79 tests across 4 files)
- **Errors:** None

## Details

### Step GENERATE

`pnpm --filter @contextractor/gen-input-schema start` ran successfully.
- Wrote `apps/apify-actor/.actor/input_schema.json`
- Wrote `apps/apify-actor/.actor/dataset_schema.json`
- Biome formatted both files with no issues

`git diff` showed no changes — the generated output was identical to the committed file.

### Step VERIFY

`pnpm --filter @contextractor/schema test` passed:
- 4 test files, 79 tests, all green
- Duration: 427ms
