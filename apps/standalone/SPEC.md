# apps/standalone — Specification

Standalone TypeScript CLI for local content extraction. Also exports a programmatic library API backed by Crawlee storage.

## Usage

```bash
contextractor [OPTIONS] [URLS...]         # backwards-compatible root form
contextractor extract [URLS...]           # explicit subcommand
contextractor list [dataset]
contextractor get <dataset> <index>
contextractor kvs put|get|ls|rm
contextractor purge [--all]
contextractor storage-dir
```

Full flag reference: auto-generated table in `apps/standalone/README.md`.

## Subcommands

### `extract`

Extracts content from one or more URLs. Writes to the file output directory (`--output-dir`, default `./output/`) and/or Crawlee storage (Dataset / KeyValueStore), depending on `--save-destination`.

Options: all extraction flags (`--save`, `--max-pages`, `--headless`, `--crawler-type`, `--rendering-detection-pct`, etc.) plus:
- `--input-file <file>` — read URLs line by line from a file
- `--dataset <name>` — named dataset for Crawlee storage (default `default`)
- `--save-destination <dest>` — repeatable; `key-value-store` (default) or `dataset`
- `--storage-dir <path>` — override Crawlee storage directory
- `--use-sitemaps` — fetch `sitemap.xml` at each start URL domain root and enqueue matching URLs (filtered by `--globs` / `--excludes`) in addition to link-following
- `--store-skipped-urls` — write `skipped-urls.json` to `--output-dir` after the crawl
- `--initial-concurrency <n>` — initial parallel requests; Crawlee auto-scales up to `--max-concurrency`; `0` (default) lets Crawlee pick the starting concurrency
- `--block-media` / `--no-block-media` — block images, stylesheets, fonts, PDFs, and ZIPs (no effect for `cheerio`)
- `--dynamic-content-wait <seconds>` — seconds to wait for network idle after navigation; also sets the timeout for `--wait-for-selector` / `--soft-wait-for-selector`; 0 disables (Playwright only)
- `--wait-for-selector <selector>` — CSS selector to wait for before extracting; request fails and is retried if selector does not appear within the timeout (Playwright only)
- `--soft-wait-for-selector <selector>` — like `--wait-for-selector` but continues extraction even if the selector does not appear (Playwright only)
- `--ignore-canonical-url` — disable canonical URL deduplication; by default, pages whose `<link rel="canonical">` was already extracted are skipped (Playwright only)

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

`defaults (Zod schema) → config file (JSON) → CLI args`

Config file: optional JSON file with the same camelCase shape as the Apify input schema. CLI-only flags (`--output-dir`, `--save`, `--save-destination`, `--proxy-urls`) are not accepted in the config file. Unknown keys are stripped by `ContextractorInput.parse()`.

## Output

### File output (backwards-compatible)

One file per crawled page in the output directory, named from a URL slug (e.g. `example-com-page.md`). When metadata is available, a header (title, author, date, URL) is prepended to text-format outputs. Supported save formats: `txt`, `markdown`, `json`, `html`, `original`.

After `crawler.run()` completes:
- If any requests failed (all retries exhausted), `failed-urls.json` is written to `--output-dir` with records `{ url, loadedUrl, status: 'failed', errorMessages, retryCount }`.
- If `--store-skipped-urls` is set and any URLs were skipped, `skipped-urls.json` is written to `--output-dir` with records `{ url, status: 'skipped', skipReason }`.

### Crawlee storage output

Controlled by `--save-destination` (default `key-value-store`):

- **`key-value-store`** — KVS key `${slug}.${ext}` (or `${slug}-original.html` for `original` format)
- **`dataset`** — Dataset record with `url`, metadata fields, `originalHash` (MD5 of raw HTML), `crawl: { depth, referrerUrl }` (link distance from start URL and linking page URL; `depth` is 0 and `referrerUrl` is `null` for start URLs), content per format as inline strings, and a `{format}Hash` field alongside each format's content

Storage errors (write failures) are logged to stderr and do not abort extraction.

## Storage directory resolution

Five-level precedence (first match wins):

1. `--storage-dir` CLI flag
2. `CONTEXTRACTOR_STORAGE_DIR` env var
3. `CRAWLEE_STORAGE_DIR` env var
4. `./storage` if `.actor/` or `./storage/` exists in the current working directory
5. `${XDG_DATA_HOME:-~/.local/share}/contextractor/storage`

## Programmatic API

`@contextractor/standalone` exports:

- `buildProgram()` — returns a configured Commander `Command` for programmatic use
- `runCli(program, argv)` — entry point used by the binary
- `isMainEntry(metaUrl)` — helper to detect if a module is the main entry
- `program` — pre-built program instance (from `./cli.js`)
- `configureStorage(storageDir)` — sets Crawlee `localDataDirectory` and `purgeOnStart: false`
- `resolveStorageDir(flagValue?)` — five-level storage dir resolution
- `Dataset`, `KeyValueStore`, `Configuration` — re-exported from `crawlee`

## Sinks

- `createCliSink({ outDir, formats })` — composes `fileSink` and `originalSink` for file output
- `createCrawleeStorageSink({ destinations, kvs, dataset, formats })` — routes to KVS and/or Dataset; errors are caught and logged to stderr
