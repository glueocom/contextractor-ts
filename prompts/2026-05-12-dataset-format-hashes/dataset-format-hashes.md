# Dataset Format Hashes

> **TLDR**: Adds `originalHash` (always present, from `result.rawHtmlHash`) and per-format hash fields (`markdownHash`, `txtHash`, etc.) to dataset records in both sinks. Per-format hashes appear only when the corresponding format content is in the record. Affects `apps/apify-actor/src/sinks.ts`, `apps/standalone/src/sinks.ts`, their tests, and SPECs.

Add content hashes to every dataset record for both sinks. `originalHash` is always present. Per-format hashes (`markdownHash`, `txtHash`, etc.) appear only when that format's content is in the record.

## Skills and Agents

- Agent: `ts-pro` — all code and test changes

## Current State

`ExtractionResult` already carries `rawHtmlHash: string` (MD5 of the raw HTML, computed in `packages/crawler/src/handler.ts`).

**`apps/apify-actor/src/sinks.ts` — `createApifySink`:**
- `toKvs` path: format fields are `ContentInfo` objects `{ hash, length, key, url? }` — hashes already present
- `toDataset` path: format fields are raw strings — no hashes
- `saveOriginal + toKvs`: `data.original` is a `ContentInfo` with `hash: result.rawHtmlHash`
- `saveOriginal + toDataset`: `data.original` is the raw HTML string — no hash

**`apps/standalone/src/sinks.ts` — `createCrawleeStorageSink`:**
- Dataset record has `url`, spread metadata, and format content as raw strings — no hashes at all

## Step APIFY: Update `createApifySink`

File: `apps/apify-actor/src/sinks.ts`

**`originalHash` — always present:**

Add `originalHash: result.rawHtmlHash` to the initial `data` object unconditionally (regardless of `saveOriginal` or destination). The hash is always computed by the crawler for every page.

**Per-format hashes — `toDataset` path only:**

In the format loop, in the `if (toDataset)` branch, alongside `data[spec.dataKey] = content` add:

```
data[`${spec.dataKey}Hash`] = computeContentInfo(content).hash
```

Import `computeContentInfo` from `@contextractor/extraction`.

No change to the `toKvs` branch — the hash is already embedded in the `ContentInfo` object at `data[spec.dataKey].hash`.

## Step STANDALONE: Update `createCrawleeStorageSink`

File: `apps/standalone/src/sinks.ts`

**`originalHash` — always present:**

Add `originalHash: result.rawHtmlHash` to the record before the format loop.

**Per-format hashes:**

In the format loop, when `fmt !== 'original'` and content is defined, add alongside the content field:

```
record[`${fmt}Hash`] = computeContentInfo(content).hash
```

For `fmt === 'original'`: the hash is `result.rawHtmlHash`, already set as `originalHash`.

Import `computeContentInfo` from `@contextractor/extraction`.

## Step TESTS: Update Tests

### `apps/apify-actor/src/sinks.test.ts`

- All three existing test cases: add assertion that `item.originalHash === FAKE_RESULT.rawHtmlHash` (`'abc123'`)
- `saveDestination: ["dataset"]` test: add assertions that `item.markdownHash` and `item.txtHash` are non-empty strings matching the MD5 of the respective format content
- `saveDestination: ["key-value-store"]` test: `markdownHash` / `txtHash` should NOT be present as top-level fields (hash lives inside the ContentInfo object)

### `apps/standalone/src/sinks.test.ts`

- `createCrawleeStorageSink — dataset destination` tests: add assertions that `item.originalHash` equals `BASE_RESULT.rawHtmlHash`, and that `item.txtHash` is a non-empty string when `txt` format is saved
- Add a new test: saving multiple formats produces a hash field for each saved format and no hash field for formats not in the record

## Step DOCS: Update SPECs

### `apps/apify-actor/SPEC.md`

In the Sinks section, update the dataset item description: note that `originalHash` is always present (MD5 of raw HTML), and per-format hashes (`markdownHash`, etc.) appear alongside inline content when destination is `dataset`.

### `apps/standalone/SPEC.md`

In the Crawlee storage output section: note that `originalHash` is always in the dataset record, and per-format hashes appear alongside each saved format's content.

## Verification

```bash
pnpm build
pnpm test
```

All tests must pass. Verify that a dataset record for a page saved with `markdown` format contains both `markdown` (string) and `markdownHash` (32-char hex string), and always contains `originalHash`.
