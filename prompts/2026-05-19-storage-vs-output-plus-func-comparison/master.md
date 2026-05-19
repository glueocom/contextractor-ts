# Master: Modernize Contextractor

Executes two coordinated changes to contextractor. Run them in order — Part 1 must
complete and pass all tests before Part 2 starts.

## Part 1: Remove file output

Prompt: `prompts/2026-05-19-storage-vs-output-plus-func-comparison/storage-vs-output.md`

**Run this first.** Removes the `output/` directory, `--output-dir` flag, `createCliSink`,
and `fileSink`. All extracted content goes through Crawlee storage only. After this change,
`contextractor extract … --save-destination dataset` followed by `contextractor list` is the
canonical CLI workflow.

Part 1 finishes when:
- `pnpm build`, `pnpm lint`, `pnpm test` all pass
- `contextractor extract … --save-destination dataset && contextractor list` produces output
- Platform smoke test via `/platform:deploy-and-test` succeeds
- All SPEC.md and README.md files listed in the prompt are updated

## Part 2: Add missing features and fix bugs

Prompt: `prompts/2026-05-19-storage-vs-output-plus-func-comparison/compare-funtionality.md`

**Run after Part 1 passes.** Adds features identified by comparing contextractor against
`apify/website-content-crawler` and `apify/playwright-scraper`, and fixes the `loadedUrl`
bug. Does not re-introduce any file output.

Part 2 finishes when:
- `pnpm build`, `pnpm lint`, `pnpm test` all pass
- Platform smoke test via `/platform:deploy-and-test` succeeds
- All SPEC.md and README.md files listed in the prompt are updated

## Shared Documentation Requirements

Both prompts must leave all of the following in sync with the code:

- `SPEC.md` (root)
- `apps/apify-actor/SPEC.md` and `apps/apify-actor/README.md`
- `apps/standalone/SPEC.md` and `apps/standalone/README.md`
- `packages/crawler/SPEC.md`
- `packages/extraction/SPEC.md`
- `packages/schema/SPEC.md`

Run `pnpm docs:update` at the end of each part to rebuild auto-generated README sections.

## Conflict Resolution

The two prompts share the input schema and output contracts. Resolved rules:

- **`saveDestination` default** — Part 1 considers changing the CLI default from
  `key-value-store` to `dataset`. Part 2 adds new schema fields but does not change
  any defaults. The default decision from Part 1 stands and must not be reversed in Part 2.
- **`save` formats** — Part 1 removes the `original` format from file output; `original`
  continues to work via Crawlee storage (KVS). Part 2 adds `saveScreenshots` as a separate
  flag — it does not overlap with `save: ['original']`.
- **`output/` directory** — Part 2 must not reference `output/`, `--output-dir`,
  `createCliSink`, or `fileSink`. These are deleted by Part 1.
- **CLI test commands** — All Part 2 test commands must use `--save-destination dataset`
  (or `key-value-store`) explicitly, without assuming a default. Both commands are valid
  after Part 1.
- **`loadedUrl` fix** — Part 2 fixes `loadedUrl` to reflect the final URL after redirects
  and adds a `url` field for the original URL. Part 1 does not touch the dataset record
  shape, so there is no conflict.
