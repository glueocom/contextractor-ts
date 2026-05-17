# Implement Storage Feature Missing Pieces

> **TLDR**: Two surgical fixes for gaps left after the storage feature landed: exit code 2 for partial extraction failures and the missing `DatasetContent` re-export from the standalone library.

These two fixes are independent of each other and orthogonal to `optimize-cli-args.md` — the exit code fix targets the `failedRecords` block at the end of `runExtractAction()` which `optimize-cli-args.md` does not touch; the re-export fix is in `index.ts` which that prompt does not touch.

Read `apps/standalone/src/cliProgram.ts` and `apps/standalone/src/index.ts` in full before making any change. Do not touch unrelated code.

## Fix: DatasetContent re-export

**File**: `apps/standalone/src/index.ts`

Current content (line 1):

```ts
export { Configuration, Dataset, KeyValueStore } from 'crawlee';
```

`DatasetContent<Data>` is the return type of `dataset.getData()`. It is defined in `@crawlee/core/storages/dataset.d.ts` and re-exported by the `crawlee` package through its `export * from '@crawlee/core'` chain. Add it to the re-export:

```ts
export { Configuration, Dataset, DatasetContent, KeyValueStore } from 'crawlee';
```

`DatasetContent` is generic — consumers specify the type parameter at the usage site. No type annotation is needed in the re-export itself.

No test needed: the TypeScript compiler verifies the re-export at build time. Run `pnpm --filter @contextractor/standalone build` and confirm it compiles clean.

History: the original implementation defined `DatasetContent` as an inline interface (deviation from the spec). Commit `d7c127a` removed that inline interface; the Crawlee re-export was never added to replace it.

## Fix: Exit code 2 for partial failures

**File**: `apps/standalone/src/cliProgram.ts`

`runExtractAction()` collects failures in `failedRecords`, writes `failed-urls.json` when any URL fails, then falls through — `runCli()` always exits 0 after `program.parseAsync()` returns. There is no mechanism to signal partial failure.

`runExtractAction()` already calls `process.exit(1)` directly in several places (malformed proxy URL, schema parse failure). The consistent fix is a direct `process.exit(2)` at the end of the function, after all output files are written.

Find the end of `runExtractAction()` — after the `failedRecords` block, the `skippedRecords` block, and the `Done.` stderr write. The final lines currently read:

```ts
  process.stderr.write('Done.\n');
}
```

Change to:

```ts
  process.stderr.write('Done.\n');
  if (failedRecords.length > 0) process.exit(2);
}
```

The `Done.` message must still print before the exit — exit code 2 means "completed with partial failures", not "crashed". All output files (`failed-urls.json`, `skipped-urls.json`) must be written before `process.exit(2)` is reached; the existing block order already ensures this.

### Step TEST: Verify Exit Code 2

`process.exit()` terminates the vitest worker process, so full integration testing of this path requires either mocking `process.exit` or running it in a child process. Add a focused test to `apps/standalone/src/cli.test.ts`:

```ts
import { vi, describe, it, expect, afterEach } from 'vitest';

describe('exit code — partial failure', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exits with 2 when some URLs fail', async () => {
    // Prevent process.exit from actually terminating the vitest worker.
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    vi.mock('@contextractor/crawler', () => ({
      createContextractorCrawler: vi.fn((opts) => ({
        run: vi.fn(async () => {
          // Simulate a failed request by calling the onFailedRequest hook directly.
          await opts.onFailedRequest?.({
            url: 'https://example.com',
            loadedUrl: null,
            status: 'failed',
            errorMessages: ['timeout'],
            retryCount: 3,
          });
        }),
      })),
      createCliSink: vi.fn(() => vi.fn()),
      createCrawleeStorageSink: vi.fn(() => vi.fn()),
    }));

    vi.mock('crawlee', async (importOriginal) => {
      const actual = await importOriginal<typeof import('crawlee')>();
      return {
        ...actual,
        Dataset: { open: vi.fn().mockResolvedValue({ getData: vi.fn(), drop: vi.fn() }) },
        KeyValueStore: { open: vi.fn().mockResolvedValue({ getValue: vi.fn(), setValue: vi.fn(), forEachKey: vi.fn() }) },
        Configuration: { getGlobalConfig: vi.fn(() => ({ set: vi.fn() })) },
      };
    });

    const { buildProgram } = await import('./cliProgram.js');
    const program = buildProgram();
    await program.parseAsync(['https://example.com'], { from: 'user' });

    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});
```

If the module-level `vi.mock` calls interact with other tests in `cli.test.ts`, move this test to a separate `apps/standalone/src/exitCode.test.ts` file.

## After changes

- `pnpm --filter @contextractor/standalone build` — must compile clean
- `pnpm test` — all tests pass; confirm the new tests are collected and run
- `grep -n 'DatasetContent' apps/standalone/src/index.ts` — must return a match
- `grep -n 'process.exit(2)' apps/standalone/src/cliProgram.ts` — must return a match at the end of `runExtractAction()`
- Verify `Done.` still appears in stderr for both full-success and partial-failure runs (the exit must come after the write)
