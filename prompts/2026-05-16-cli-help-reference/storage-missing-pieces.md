# Storage Feature — Missing Pieces

Missing pieces from `prompts/2026-05-07-storage/` implementation. Everything not listed here was correctly implemented.

## Exit code 2 for partial failures

**Prompt** (`2-storage.md`, §extract semantics): "Exit codes: 0 full success, 2 partial (some URLs failed but storage is consistent), 1 hard error."

**Reality**: `runExtractAction()` tracks `failedRecords` and writes `failed-urls.json` when URLs fail, but `runCli()` always exits 0 on success. There is no mechanism to signal partial failure back to `runCli()`.

**Fix**: `runExtractAction()` must return (or throw a distinguishable value) when `failedRecords.length > 0`, so `runCli()` can call `process.exit(2)` in that case instead of `process.exit(0)`.

Files to change:
- `apps/standalone/src/cliProgram.ts` — `runExtractAction()` return type, `runCli()` exit logic

## `DatasetContent` re-export missing from standalone library

**Prompt** (`2-storage.md`, task 3): "Re-export `Dataset`, `KeyValueStore`, `DatasetContent`, and `Configuration` from `crawlee` in `@contextractor/standalone`'s public API."

**Reality**: `apps/standalone/src/index.ts` exports only `Configuration`, `Dataset`, `KeyValueStore`. `DatasetContent` (the return type of `dataset.getData()`, exported by `crawlee`) is not re-exported. Commit `d7c127a` removed a locally-defined `DatasetContent` interface; the Crawlee-exported type was never added.

**Fix**: Add to `apps/standalone/src/index.ts`:
```ts
export { Configuration, Dataset, DatasetContent, KeyValueStore } from 'crawlee';
```

## Backwards compatibility snapshot test missing

**Prompt** (`2-storage.md`, task 5): "Existing users running `contextractor https://example.com` must see byte-identical file output in `./output/`. Verify with a snapshot test against a frozen input."

**Reality**: `apps/standalone/src/cli.test.ts` checks option flags and config helpers but has no snapshot or integration test that verifies file output from the legacy `contextractor <url>` invocation pattern. There is no frozen-input fixture test anywhere in the standalone package.
