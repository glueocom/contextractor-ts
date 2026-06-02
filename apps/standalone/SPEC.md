# apps/standalone — Specification

Standalone TypeScript CLI for local content extraction. Also exports a programmatic library API backed by Crawlee storage.

## Usage

```bash
contextractor extract [URLS...]
contextractor export [--output-dir <path>]
contextractor purge [--all]
```

Full flag reference: auto-generated table in `apps/standalone/README.md`.

## Subcommands

### `extract`

Extracts content from one or more URLs. Writes to Crawlee storage (Dataset or Key-Value Store), depending on `--save-destination`.

Options: all extraction flags (`--save`, `--max-requests-per-crawl`, `--headless`, `--crawler-type`, `--rendering-type-detection`, etc.) plus:
- `--input-file <file>` — read URLs line by line from a file
- `--dataset <name>` — named dataset for Crawlee storage (default `default`)
- `--key-value-store <name>` — named key-value store for content blobs (default `default`)
- `--request-queue <name>` — named request queue for pending URLs
- `--save-destination <dest>` — repeatable; `key-value-store` (default) or `dataset`
- `--clean` — purge default Dataset, Key-Value Store, and Request Queue before extracting
- `--storage-dir <path>` — override Crawlee storage directory
- `--use-sitemaps` — fetch `sitemap.xml` at each start URL domain root and enqueue matching URLs (filtered by `--globs` / `--exclude`) in addition to link-following
- `--store-skipped-urls` — push skipped URL records (`status: 'skipped'`) to the Crawlee dataset after the crawl
- `--initial-concurrency <n>` — initial parallel requests; Crawlee auto-scales up to `--max-concurrency`; `0` (default) lets Crawlee pick the starting concurrency
- `--block-media` / `--no-block-media` — block images, stylesheets, fonts, PDFs, and ZIPs (no effect for `cheerio`)
- `--wait-for-dynamic-content <seconds>` — seconds to wait for network idle after navigation; also sets the timeout for `--wait-for-selector` / `--soft-wait-for-selector`; 0 disables (Playwright only)
- `--wait-for-selector <selector>` — CSS selector to wait for before extracting; request fails and is retried if selector does not appear within the timeout (Playwright only)
- `--soft-wait-for-selector <selector>` — like `--wait-for-selector` but continues extraction even if the selector does not appear (Playwright only)
- `--deduplication <level>` — deduplication level: `none` (URL dedup only), `url` (default, canonical URL dedup across all handler types), or `content-hash` (canonical URL + content hash dedup)
- `--session-pool-name <name>` — named session pool for cross-run session sharing (`persistStateKey`)
- `--max-session-rotations <n>` — max session rotations per request on block detection (default `10`)

### `export`

Exports stored extraction content to a user-facing output directory. The dataset is the record index; with the default `key-value-store` destination, content lives as KVS blobs that this command reads back. Only `success` records produce content files; every record (incl. failed/skipped) is written to `manifest.json`. Backed by the library-callable `runExportAction`.

- `--output-dir <path>` — output directory (default `./contextractor-output`)
- `--dataset <name>` — dataset to read the record index from (default `default`)
- `--key-value-store <name>` — key-value store holding content blobs (default `default`)
- `--storage-dir <path>` — override Crawlee storage directory

Readable file names are derived from `metadata.title` (falling back to the URL host/path, then `page`). Within a record, kinds are processed `markdown, txt, json, html, original` so the primary format keeps the clean `<slug>.<ext>` name; the `html`/`original` extension clash is resolved with a kind tag (`<slug>.original.html`), then a URL-hash suffix.

### `purge`

Drops the default Dataset and KeyValueStore. `--all` drops all named stores.

## Config merge order

`schema defaults → config file (JSON) → explicit CLI args`

Config file: optional JSON file with the same camelCase shape as the Apify input schema. CLI-only flags (`--proxy`, `--dataset`) are not accepted in the config file. Shared schema fields like `save`, `saveDestination`, `datasetName`, `keyValueStoreName`, and `requestQueueName` are honored from config. Unknown keys are stripped by `ContextractorInput.parse()`.

## Output

Controlled by `saveDestination` / `--save-destination` (default `key-value-store`). The output shape is identical to the Apify Actor's — record assembly and KVS key derivation come from the shared `@contextractor/crawler` sink core (`buildSuccessRecord`, `kvsKey`):

- **`key-value-store`** — content blobs are written under `{format}-{md5(url)}.{ext}` keys (e.g. `txt-…txt`, `original-…html`), and the dataset record references each as a `ContentNode` (`{ hash, bytes, key }`; local storage has no public `url`)
- **`dataset`** — content is inlined on the dataset record under each `ContentNode`'s `content` field (dataset takes precedence when both destinations are selected)
- A dataset record is pushed for every page regardless of destination; all three crawl outcomes appear in the dataset index (and in `manifest.json` after `contextractor export`):
  - `status: 'success'` — `url`, `status`, nested `metadata`, `crawl: { loadedUrl, loadedTime, httpStatusCode, depth, referrerUrl }`, `original`, and per-format content — each a `ContentNode` (`hash` + `bytes` always present; inline `content` for `dataset`, or `key`/`url` for `key-value-store`)
  - `status: 'failed'` — always pushed; record has `url`, `crawl: { loadedUrl }`, `errors`, `retryCount`, `crawledTime` (ISO 8601)
  - `status: 'skipped'` — pushed only when `--store-skipped-urls` is set; record has `url` and `skipReason`

`datasetName`, `keyValueStoreName`, and `requestQueueName` are taken from the shared input schema when present; the CLI flags `--dataset`, `--key-value-store`, and `--request-queue` override them for the output run.

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

`contextractor` exports:

- `buildProgram()` — returns a configured Commander `Command` for programmatic use
- `runCli(program, argv)` — entry point used by the binary
- `isMainEntry(metaUrl)` — helper to detect if a module is the main entry
- `program` — pre-built program instance (from `./cli.js`)
- `runExportAction(opts)` — library-callable `export` action; returns `ExportResult` (does not call `process.exit`)
- `configureStorage(storageDir)` — sets Crawlee `localDataDirectory` and `purgeOnStart: false`
- `resolveStorageDir(flagValue?)` — five-level storage dir resolution
- `Dataset`, `DatasetContent`, `KeyValueStore`, `Configuration` — re-exported from `crawlee`

## Sinks

- `createCrawleeStorageSink({ destinations, kvs, dataset, formats })` — routes to KVS and/or Dataset; errors are caught and logged to stderr
