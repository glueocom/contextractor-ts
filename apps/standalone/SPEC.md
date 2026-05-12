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

Options: all extraction flags (`--save`, `--max-pages`, `--headless`, etc.) plus:
- `--input-file <file>` — read URLs line by line from a file
- `--dataset <name>` — named dataset for Crawlee storage (default `default`)
- `--save-destination <dest>` — repeatable; `key-value-store` (default) or `dataset`
- `--storage-dir <path>` — override Crawlee storage directory

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

One file per crawled page in the output directory, named from a URL slug (e.g. `example-com-page.md`). When metadata is available, a header (title, author, date, URL) is prepended to text-format outputs. Supported save formats: `txt`, `markdown`, `json`, `html`, `jsonl`, `original`.

### Crawlee storage output

Controlled by `--save-destination` (default `key-value-store`):

- **`key-value-store`** — KVS key `${slug}.${ext}` (or `${slug}-original.html` for `original` format)
- **`dataset`** — Dataset record with `url`, metadata fields, and content per format as inline strings

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
- `DatasetContent<Data>` — interface matching the Crawlee dataset page shape

## Sinks

- `createCliSink({ outDir, formats })` — composes `fileSink`, `jsonlSink`, and `originalSink` for file output
- `createCrawleeStorageSink({ destinations, kvs, dataset, formats })` — routes to KVS and/or Dataset; errors are caught and logged to stderr
