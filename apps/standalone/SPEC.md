# apps/standalone — Specification

Standalone TypeScript CLI for local content extraction. Also exports a programmatic library API backed by Crawlee storage.

## Usage

```bash
contextractor extract [URLS...]
contextractor list [dataset]
contextractor get <dataset> <index>
contextractor kvs put|get|ls|rm
contextractor purge [--all]
contextractor storage-dir
```

Full flag reference: auto-generated table in `apps/standalone/README.md`.

## Subcommands

### `extract`

Extracts content from one or more URLs. Writes to Crawlee storage (Dataset or Key-Value Store), depending on `--save-destination`.

Options: all extraction flags (`--save`, `--max-pages`, `--headless`, `--crawler-type`, `--rendering-detection-pct`, etc.) plus:
- `--input-file <file>` — read URLs line by line from a file
- `--dataset <name>` — named dataset for Crawlee storage (default `default`)
- `--save-destination <dest>` — repeatable; `key-value-store` (default) or `dataset`
- `--clean` — purge default Dataset, Key-Value Store, and Request Queue before extracting
- `--storage-dir <path>` — override Crawlee storage directory
- `--use-sitemaps` — fetch `sitemap.xml` at each start URL domain root and enqueue matching URLs (filtered by `--glob` / `--exclude`) in addition to link-following
- `--store-skipped-urls` — push skipped URL records (`status: 'skipped'`) to the Crawlee dataset after the crawl
- `--initial-concurrency <n>` — initial parallel requests; Crawlee auto-scales up to `--max-concurrency`; `0` (default) lets Crawlee pick the starting concurrency
- `--block-media` / `--no-block-media` — block images, stylesheets, fonts, PDFs, and ZIPs (no effect for `cheerio`)
- `--dynamic-content-wait <seconds>` — seconds to wait for network idle after navigation; also sets the timeout for `--wait-for-selector` / `--soft-wait-for-selector`; 0 disables (Playwright only)
- `--wait-for-selector <selector>` — CSS selector to wait for before extracting; request fails and is retried if selector does not appear within the timeout (Playwright only)
- `--soft-wait-for-selector <selector>` — like `--wait-for-selector` but continues extraction even if the selector does not appear (Playwright only)
- `--deduplication <level>` — deduplication level: `minimal` (URL dedup only), `basic` (default, canonical URL dedup across all handler types), or `full` (canonical URL + content hash dedup)
- `--session-pool-name <name>` — named session pool for cross-run session sharing (`persistStateKey`)
- `--max-session-rotations <n>` — max session rotations per request on block detection (default `10`)

### `list`

Reads a Dataset and prints items as JSON, JSONL, or CSV.

### `get`

Reads a single item from a Dataset by 0-based index.

### `kvs`

Sub-commands: `put <key> <file|->`, `get <key>`, `ls`, `rm <key>`.

### `purge`

Drops the default Dataset and KeyValueStore. `--all` drops all named stores.

### `storage-dir`

Prints the resolved Crawlee storage directory and exits.

## Config merge order

`schema defaults → config file (JSON) → explicit CLI args`

Config file: optional JSON file with the same camelCase shape as the Apify input schema. CLI-only flags (`--proxy`, `--dataset`) are not accepted in the config file. Shared schema fields like `save`, `saveDestination`, `datasetName`, `keyValueStoreName`, and `requestQueueName` are honored from config. Unknown keys are stripped by `ContextractorInput.parse()`.

## Output

Controlled by `saveDestination` / `--save-destination` (default `key-value-store`). The output shape is identical to the Apify Actor's — record assembly and KVS key derivation come from the shared `@contextractor/crawler` sink core (`buildSuccessRecord`, `kvsKey`):

- **`key-value-store`** — content blobs are written under `{format}-{md5(url)}.{ext}` keys (e.g. `txt-…txt`, `original-…html`), and the dataset record references each as a `ContentRef` (`{ hash, length, key }`; local storage has no public `url`)
- **`dataset`** — content is inlined on the dataset record as strings, each with a `{format}Hash` field (dataset takes precedence when both destinations are selected)
- A dataset record is pushed for every page regardless of destination; all three crawl outcomes are queryable via `contextractor list`:
  - `status: 'success'` — `url`, `loadedUrl`, `loadedAt`, nested `metadata`, `httpStatus`, `crawl: { depth, referrerUrl }`, `original` (a `ContentRef`), and per-format content (a `ContentRef` or an inline string + `{format}Hash`)
  - `status: 'failed'` — always pushed; record has `url`, `loadedUrl`, `errorMessages`, `retryCount`, `crawledAt` (ISO 8601)
  - `status: 'skipped'` — pushed only when `--store-skipped-urls` is set; record has `url` and `skipReason`

`datasetName`, `keyValueStoreName`, and `requestQueueName` are taken from the shared input schema when present; the CLI-only `--dataset` flag overrides `datasetName` for the output dataset.

Storage errors (write failures) are logged to stderr and do not abort extraction.

The CLI exits with code `2` when at least one request fails (partial failure); `0` on full success; `1` on fatal startup errors.

## Storage directory resolution

Five-level precedence (first match wins):

1. `--storage-dir` CLI flag
2. `CONTEXTRACTOR_STORAGE_DIR` env var
3. `CRAWLEE_STORAGE_DIR` env var
4. `./storage` if `.actor/` or `./storage/` exists in the current working directory
5. `${XDG_DATA_HOME:-~/.local/share}/contextractor/storage`

## Testing

Proxy rotation is tested via the `/proxy-test` slash command, which verifies proxy configuration, rotation modes, and content extraction for this entry point alongside the Actor and library entry points.

See `tools/proxy-rotation-tester/README.md` for test documentation.

## Programmatic API

`@contextractor/standalone` exports:

- `buildProgram()` — returns a configured Commander `Command` for programmatic use
- `runCli(program, argv)` — entry point used by the binary
- `isMainEntry(metaUrl)` — helper to detect if a module is the main entry
- `program` — pre-built program instance (from `./cli.js`)
- `configureStorage(storageDir)` — sets Crawlee `localDataDirectory` and `purgeOnStart: false`
- `resolveStorageDir(flagValue?)` — five-level storage dir resolution
- `Dataset`, `DatasetContent`, `KeyValueStore`, `Configuration` — re-exported from `crawlee`

## Sinks

- `createCrawleeStorageSink({ destinations, kvs, dataset, formats })` — routes to KVS and/or Dataset; errors are caught and logged to stderr
