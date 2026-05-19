# storage/ vs output/ — Research

Investigation into whether the standalone CLI needs both `storage/` and `output/` directories, what each contains, and what Crawlee's convention is.

## TL;DR

`storage/` and `output/` are completely different things:

- **`storage/`** — Crawlee's runtime database (request queues, datasets, KVS). Framework concept. Used by all entry points.
- **`output/`** — contextractor CLI invention. Human-readable extracted files, one per page. Never used by Crawlee or the Actor.

Currently the CLI double-writes: every extraction goes to **both** directories simultaneously, regardless of `--save-destination`.

---

## What goes where

### `storage/` (Crawlee runtime database)

Crawlee creates three subdirectories:

```
storage/
├── datasets/default/          # JSON records, one file per crawled page
├── key_value_stores/default/  # Binary/text blobs keyed by URL slug
└── request_queues/default/    # Crawl queue persistence (for resumable runs)
```

This is a **runtime database**, not human output. The CLI's `--save-destination` flag controls whether extracted content also lands in `key_value_stores/` or `datasets/` (in addition to `output/`).

The request queue is always written, even when the user wants no storage output at all — it is how Crawlee tracks which URLs have been processed.

Default location: `${XDG_DATA_HOME:-~/.local/share}/contextractor/storage` (resolved by `resolveStorageDir()` five-level precedence).

### `output/` (CLI file output)

```
output/
├── example-com.md
├── example-com-page.txt
└── example-com-other-page.json
```

Flat directory of human-readable files. One file per crawled page per format. Metadata (title, author, date, URL) is prepended as a text header for `.md` and `.txt` formats. Default: `./output` relative to CWD.

`output/` is a **contextractor invention** — Crawlee has zero references to it.

---

## The double-write (current behaviour)

In `apps/standalone/src/cliProgram.ts` (lines 489–500), the CLI composes both sinks and always calls both:

```ts
const sink = async (result: ExtractionResult): Promise<void> => {
  await fileSinkInstance(result);      // → output/
  await storageSinkInstance(result);   // → storage/
};
```

So for every page crawled, the extracted content is written to **both** locations. The user has no way to suppress `output/` writes (short of pointing `--output-dir` at `/dev/null`).

---

## Does the Actor use `output/`?

No. `apps/apify-actor/src/sinks.ts` only targets Apify's managed Dataset and KVS. No files are written to disk. `output/` does not exist in the Actor context.

---

## Crawlee's convention

Crawlee has no concept of an `output/` directory. All Crawlee output goes through storage abstractions (Dataset, KVS, RequestQueue), which persist to `storage/` locally or to Apify's platform remotely. The two naming conventions used by Crawlee:

- `storage/` — the current default (since v3.0.1)
- `crawlee_storage/` — the legacy v3.0.0 name (kept as a compatibility fallback)

---

## Do we need both?

| Scenario | `output/` | `storage/` |
|----------|-----------|-----------|
| User wants readable files | required | optional (request queue only strictly needed) |
| User wants programmatic access via `contextractor list/get` | not useful | required |
| Actor running on Apify | not used | required (mapped to Apify storage) |
| Resumable crawl (stop + continue) | not useful | required (request queue) |
| CI/CD pipeline consuming results | not useful (files) | useful (JSON dataset) |

**`storage/` is always needed** because Crawlee's request queue lives there. Even if the user wants only file output, Crawlee needs its queue state.

**`output/` is optional** — it is a convenience layer for direct file consumption. A user who is happy to run `contextractor get` or read KVS blobs does not need `output/`.

---

## Open question: should `--save-destination` gate `output/` writes?

Currently `--save-destination` only controls the storage sub-system (KVS vs Dataset), while `output/` is always written. A possible improvement would be:

- Add `file` as a valid `--save-destination` value (or a separate `--no-output-dir` flag)
- Only write `output/` when destination includes `file`
- Write to `storage/` KVS or Dataset when destination includes those

This would eliminate the double-write and let users choose one or the other. The Crawlee convention points toward storage as the primary mechanism; `output/` is a usability affordance for local CLI use.

---

## Code paths

| Path | Role |
|------|------|
| `packages/crawler/src/sinks/file.ts` | `fileSink()` — writes format files to `output/` |
| `apps/standalone/src/sinks.ts:72-95` | `createCliSink()` — composes fileSink + originalSink |
| `apps/standalone/src/sinks.ts:16-70` | `createCrawleeStorageSink()` — routes to KVS or Dataset |
| `apps/standalone/src/cliProgram.ts:489-500` | Composes both sinks, always calls both |
| `apps/standalone/src/storage/resolve-storage-dir.ts` | Five-level storage dir resolution |
| `apps/apify-actor/src/sinks.ts:44-93` | `createApifySink()` — KVS + Dataset only, no files |
