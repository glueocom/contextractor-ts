# Schema Gen Input Schema Report

**Date**: 2026-05-03T00:04:36Z
**Scope**: Regenerate `apps/apify-actor/.actor/input_schema.json` from `packages/schema/src/input.ts` and verify the schema snapshot tests.

## Findings

- `pnpm --filter @contextractor/gen-input-schema start` completed successfully and rewrote `apps/apify-actor/.actor/input_schema.json`.
- `git status --short -- "apps/apify-actor/.actor/input_schema.json"` and `git diff -- "apps/apify-actor/.actor/input_schema.json"` were both empty after generation, so the generated file content did not change.
- `pnpm --filter @contextractor/schema test` passed: 2 test files, 19 tests.
- `pnpm` emitted platform-specific optional dependency warnings for prebuilt native packages on `darwin arm64`; these did not block generation or tests.

## Actions Taken

- Ran `pnpm --filter @contextractor/gen-input-schema start` from the repo root.
- Verified the generated schema file has no resulting git diff.
- Ran `pnpm --filter @contextractor/schema test` and confirmed the snapshot test passed.

## Deferred Decisions

- None

## Summary

- Issues found: 0
- Issues fixed: 0
- Remaining: 0
- `input_schema.json` changed: No
- Snapshot test passed: Yes
- Errors encountered: None
