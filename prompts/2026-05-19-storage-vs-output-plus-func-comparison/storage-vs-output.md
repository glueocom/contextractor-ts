# Remove output/ — Route Everything Through Crawlee Storage

## TLDR

Remove the `output/` directory and file sink from the standalone CLI. All extracted content goes exclusively through Crawlee storage (Dataset and Key-Value Store). The `saveDestination` schema default remains `key-value-store`.

## Goal

Remove the `output/` directory concept from the standalone CLI completely. All extracted content goes exclusively through Crawlee's `storage/` abstraction (Dataset and Key-Value Store). Users query results via `contextractor list` and `contextractor get`.

## Context

Read before implementing:

- `prompts/2026-05-19-storage-vs-output-plus-func-comparison/context/research.md` — storage vs output architecture analysis
- `prompts/2026-05-19-storage-vs-output-plus-func-comparison/context/industry-research.md` — industry conventions verdict

## Background

The CLI currently double-writes every extraction to both `output/` (flat files) and `storage/` (Crawlee Dataset/KVS). This is redundant:

- `storage/` is Crawlee's canonical local storage; it is the only output mechanism for the Actor
- `output/` is a contextractor-specific invention with no Crawlee precedent
- Structured storage + `contextractor list` / `contextractor get` is the idiomatic interface for programmatic consumption (Crawlee, Scrapy, Apify all use this model)

## What to Remove

### `apps/standalone/src/cliProgram.ts`

- Remove `--output-dir` / `-o` flag from `extract`
- Remove `outputDir` from `buildSchemaOverrides` / `buildCrawlConfig` return value
- Remove `createCliSink` import and instantiation (`fileSinkInstance`)
- Remove the `await fileSinkInstance(result)` call — `sink` becomes just `storageSinkInstance`
- Update the progress message (`Extracting ... → ${cfg.outputDir}/`) to show the storage destination instead (e.g., `Extracting N URL(s) → storage [formats]`)

### `apps/standalone/src/config.ts`

- Remove `outputDir` field from `CrawlConfig` interface and its population in `buildCrawlConfig`

### `apps/standalone/src/sinks.ts`

- Remove `createCliSink()` function entirely
- Remove `originalSink()` helper
- Remove `fileSink` and `urlToFilename` from the import (keep `urlToFilename` only if `createCrawleeStorageSink` still needs it for KVS key generation — check before removing)
- Keep `createCrawleeStorageSink()` unchanged

### `packages/crawler/src/sinks/file.ts` and its exports

- Remove `fileSink` from `packages/crawler/src/index.ts` public exports
- Remove `packages/crawler/src/sinks/file.ts` entirely (it becomes dead code)
- Remove `FORMAT_EXTENSIONS` export if it is only used by `file.ts` — check usages first
- Keep `urlToFilename` only if it is still used elsewhere; otherwise remove it too

### Tests to remove or rewrite

- `packages/crawler/src/sinks/file.test.ts` — remove entirely (tests a deleted module)
- `apps/standalone/src/sinks.test.ts` — remove the `createCliSink` describe block; keep `createCrawleeStorageSink` tests
- `apps/standalone/src/exitCode.test.ts` — remove the `createCliSink` mock if it's no longer imported

## What to Keep

- `--storage-dir <path>` on all subcommands — correct and necessary; controls `CRAWLEE_STORAGE_DIR` location
- `--save-destination <dest>` — now the primary output control; `key-value-store` (blobs) vs `dataset` (JSON records)
- `contextractor list`, `contextractor get`, `contextractor kvs` subcommands — these are the new primary access path
- `original` format in `--save` — already handled by `createCrawleeStorageSink` via `saveOriginal: input.save.includes('original')` path in the Actor sink; verify the standalone storage sink also handles `original` correctly (saves raw HTML to KVS as `{slug}-original.html`)

## `--save-destination` default

The schema default for `saveDestination` remains `key-value-store`. Do not change it — altering the Actor's default is a breaking change. Both `dataset` and `key-value-store` remain valid destinations after this change.

## `original` format consideration

`original` saves raw HTML. Previously this went to `output/{slug}-raw.html`. After this change, `original` only makes sense as a KVS entry (`{slug}-original.html`). Verify `save: ['original']` alone (without other formats) still works correctly via `createCrawleeStorageSink`. If `original` is not meaningful in dataset-only mode, document that.

## Docs to Update

Update all of the following in the **same response** as the code change:

- `apps/standalone/SPEC.md` — remove `output/` section, `--output-dir` option, file output descriptions; update "Output" section to describe storage-only access; update CLI-only flags list
- `apps/standalone/README.md` — remove `--output-dir` from usage examples and flag table; add `contextractor list` / `contextractor get` workflow as the primary output access path
- `packages/crawler/SPEC.md` — remove `fileSink` from public API section; keep `urlToFilename` only if still exported
- `SPEC.md` (root) — remove `--output-dir` from CLI-only flags list; update any mention of `output/` directory
- `apps/apify-actor/SPEC.md` — no change needed (Actor never used `output/`)

## Testing

### Local validation

```bash
pnpm build
pnpm lint
pnpm test
```

Verify `contextractor extract` writes to storage only:

```bash
contextractor extract https://example.com --save txt --max-pages 1 --crawler-type cheerio --save-destination dataset
contextractor list
contextractor get default 0 | head -20
```

### Platform smoke test

After local tests pass, run `/platform:deploy-and-test` to verify the Actor still builds and produces a dataset item.

## Success Criteria

- `output/` is never created during `contextractor extract`
- `contextractor list` and `contextractor get` return the extracted content
- `--output-dir` flag no longer exists
- `fileSink` is no longer exported from `@contextractor/crawler`
- All SPEC.md and README.md files reflect the new storage-only model
- `pnpm build`, `pnpm lint`, `pnpm test` all pass
- Platform Actor build and smoke test succeed
