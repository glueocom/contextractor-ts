# Example Projects

> **TLDR**: Creates four self-contained, runnable example projects under `examples/` demonstrating npm CLI, library, and Apify API usage patterns. No Docker examples — there is no Docker distribution.

Create the following examples under `examples/`. Each must be self-contained and runnable. The `saveDestination` field applies only to Apify Actor invocations — do not include it in npm or library examples.

## `examples/library-ts/`

Node.js TypeScript project consuming `@contextractor/standalone` as a library (programmatic API, not the CLI binary). Include `package.json`, `tsconfig.json`, and `src/main.ts`. Demonstrate calling `extract` for a URL, then consuming the persisted result via the re-exported `Dataset` API (`Dataset.open()` and `dataset.forEach()` imported from `@contextractor/standalone`). No `saveDestination`.

## `examples/cli-npm/`

Folder with `run.sh` — shell script demonstrating the full npm CLI surface:

- Single URL extract: `contextractor extract <url> --save txt` — writes to default dataset and prints JSON to stdout.
- Single URL force NDJSON: `contextractor extract <url> --ndjson` — forces NDJSON output even for a single URL.
- Multi-URL extract (NDJSON): `contextractor extract <url1> <url2> --save markdown` — emits one JSON record per line on stdout.
- Named dataset: `contextractor extract <url> --dataset my-archive` — routes to `datasets/my-archive/`. (The `-o` flag is taken by `--output-dir`; use `--dataset` for dataset routing.)
- Storage-only (no stdout): `contextractor extract <url> --no-stdout` — writes to storage, silent on stdout.
- Input file: `contextractor extract --input-file urls.txt` — reads URLs line by line.
- List default dataset: `contextractor list --format json --limit 10`.
- List named dataset: `contextractor list my-archive --format jsonl --desc` — named dataset, NDJSON output, descending order.
- Get a specific item: `contextractor get default 0`. (Indexes are 0-based.)
- KVS file write: `contextractor kvs put my-key ./file.json`.
- KVS stdin write with explicit MIME: `echo '{"ok":true}' | contextractor kvs put my-key - --content-type application/json`.
- KVS get: `contextractor kvs get my-key`.
- KVS list: `contextractor kvs ls --limit 20`.
- KVS delete: `contextractor kvs rm my-key`.
- Print resolved storage path: `contextractor storage-dir`.
- Purge default storage: `contextractor purge`.
- Purge all (including named datasets): `contextractor purge --all`.
- Custom storage dir: `CONTEXTRACTOR_STORAGE_DIR=./my-storage contextractor extract <url>`.

No `saveDestination`.

## `examples/apify-api-ts/`

Node.js TypeScript project calling the test Apify actor (`glueo/contextractor-test`) via the Apify API. Use the `apify-client` npm package. Start a run, wait for it to finish, and retrieve dataset results. Include `package.json`, `tsconfig.json`, and `src/main.ts`. Pass `saveDestination: ['dataset']` in the actor input to demonstrate dataset output.

## `examples/cli-apify/`

Folder containing `run.sh` — shell script calling `glueo/contextractor-test` via the Apify CLI (`apify call`). Pass actor input as JSON including `saveDestination`.
