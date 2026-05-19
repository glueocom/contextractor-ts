# Remove output/ — Route Everything Through Crawlee Storage

## TLDR

Remove the `output/` directory and file sink from the standalone CLI. All extracted content goes exclusively through Crawlee storage (Dataset and Key-Value Store). The `saveDestination` schema default remains `key-value-store`. Additional required config changes (`purgeOnStart`, storage dir location, KVS slugging) and follow-up scope come from `context/storage-only-verdict.md`.

## Goal

Remove the `output/` directory concept from the standalone CLI completely. All extracted content goes exclusively through Crawlee's `storage/` abstraction (Dataset and Key-Value Store). Users query results via `contextractor list` and `contextractor get`.

## Context

Read before implementing:

- `prompts/2026-05-19-storage-vs-output-plus-func-comparison/context/research.md` — storage vs output architecture analysis
- `prompts/2026-05-19-storage-vs-output-plus-func-comparison/context/industry-research.md` — industry conventions verdict
- `prompts/2026-05-19-storage-vs-output-plus-func-comparison/context/storage-only-verdict.md` — Crawlee docs/community research, risks, and required config changes

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

## Required configuration changes

Three additions from `context/storage-only-verdict.md` (see verdict §8 "Specific risks and mitigations" for full rationale and severity) ride along with this change:

### 1. Disable `purgeOnStart` (critical)

Crawlee defaults to purging all storage at the start of every run. Without `output/` as a parallel sink, the next `contextractor extract` silently destroys the previous result. At the crawler bootstrap (standalone CLI only — the Actor handles purge platform-side):

```ts
Configuration.getGlobalConfig().set('purgeOnStart', false);
```

Add `--clean` (or `--fresh`) flag on `extract` to opt back into a purge for users who want a clean run.

### 2. Verify storage dir stays out of CWD

`resolveStorageDir()` already defaults to `$XDG_DATA_HOME/contextractor/storage`. Confirm this still resolves correctly after the `--output-dir` / `outputDir` removal — no change expected, just guard against accidental regression to `./storage`. Reason: `storage/` mixes user-facing dataset/KVS records with `request_queues/` and SDK statistics files; in CWD it invites manual browsing and `.DS_Store`-class crashes (apify/crawlee#1985).

### 3. KVS slugger correctness

If `urlToFilename` is retained for KVS key generation, verify it:
- lowercases the key (KVS keys are case-preserved on disk; collides on APFS/NTFS)
- strips characters outside `[a-zA-Z0-9!\-_.'()]` (Crawlee's allowed key charset)
- truncates to ≤256 chars

Add a unit test if one doesn't exist.

## Out of scope (follow-up prompts)

Surfaced by `context/storage-only-verdict.md` but deferred:

- 9MB dataset-item JSON limit with `--save-destination=dataset` + `original` on long pages — mirror Website Content Crawler's `htmlUrl` overflow pattern.
- `crawler.exportData('./run-{timestamp}.json')` for a single consolidated per-run artifact alongside the dataset (idiomatic Crawlee, but `contextractor list/get` already covers consumption).

## Docs to Update

Update all of the following in the **same response** as the code change:

- `apps/standalone/SPEC.md` — remove `output/` section, `--output-dir` option, file output descriptions; update "Output" section to describe storage-only access; update CLI-only flags list; document new `--clean` flag and `purgeOnStart: false` default
- `apps/standalone/README.md` — remove `--output-dir` from usage examples and flag table; add `contextractor list` / `contextractor get` workflow as the **primary** output access path; mention raw `storage/` layout only in an "Advanced" section with a warning that the layout is a Crawlee implementation detail subject to change across major versions
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
- `purgeOnStart` is `false` on the standalone CLI; `--clean` flag re-enables purging for a single run
- Storage dir continues to resolve to `$XDG_DATA_HOME/contextractor/storage` (not `./storage`) when nothing is configured
- Running `contextractor extract a.com` then `contextractor extract b.com` preserves `a.com`'s data in storage
- All SPEC.md and README.md files reflect the new storage-only model
- `pnpm build`, `pnpm lint`, `pnpm test` all pass
- Platform Actor build and smoke test succeed

_Risk-driven criteria (rows 5–7) trace to `context/storage-only-verdict.md` §8._
