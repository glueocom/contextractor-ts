# Remove JSONL Saving Functionality

> **TLDR**: Removes the `jsonl` save format (extraction output) from the standalone CLI. Edits `config.ts`, `sinks.ts`, `cliProgram.ts`, tests, `SPEC.md`, and `README.md`. The `list --format jsonl` dataset read format is out of scope and must not be touched.

Remove the `jsonl` save format from the standalone CLI extraction pipeline. JSONL as a dataset *read/print* format (`contextractor list --format jsonl`) is unrelated and must not be touched.

## Scope

Files to change:

- `apps/standalone/src/config.ts`
- `apps/standalone/src/sinks.ts`
- `apps/standalone/src/cliProgram.ts`
- `apps/standalone/src/sinks.test.ts`
- `apps/standalone/src/cli.test.ts`
- `apps/standalone/SPEC.md`
- `apps/standalone/README.md`

## Agent

Use the `ts-pro` agent for all code and test changes.

## Step REMOVE_TYPE: Strip `jsonl` from `config.ts`

In `apps/standalone/src/config.ts`:

- Remove `'jsonl'` from `SaveFormat` union type
- Remove `'jsonl'` from `SORTED_SAVE_FORMATS` array
- Remove the `case 'jsonl':` branch in `isSaveFormat`

## Step REMOVE_SINK: Remove `jsonlSink` from `sinks.ts`

In `apps/standalone/src/sinks.ts`:

- Delete the `jsonlSink` function entirely
- In `createCliSink`: remove the `formats.includes('jsonl')` branch and the `jsonlSink` push
- In `createCliSink`: update the `fileFormats` filter — it currently excludes both `'jsonl'` and `'original'`; reduce to excluding only `'original'`
- In `createCrawleeStorageSink`: the `storageFormats` filter currently excludes `'jsonl'`; reduce to excluding nothing (or remove `storageFormats` if `'jsonl'` was the only excluded format — verify against code)

## Step REMOVE_CLI: Update `cliProgram.ts`

In `apps/standalone/src/cliProgram.ts`:

- `--save <formats>` help string: change `markdown,html,txt,json,jsonl,original,all` → `markdown,html,txt,json,original,all`
- `createContextractorCrawler` formats filter: currently `format !== 'jsonl' && format !== 'original'`; reduce to `format !== 'original'`

Do NOT modify `list --format <fmt>` (line ~446) — that is a dataset read format, not a save format.

## Step REMOVE_TESTS: Update tests

In `apps/standalone/src/sinks.test.ts`:

- Remove the test `'writes output.jsonl for jsonl format'`
- Remove the test that checks `output.jsonl` is created when formats include `['txt', 'jsonl', 'original']`

In `apps/standalone/src/cli.test.ts`:

- In the test that calls `validateSaveFormats(['all'])`, the expected result includes `'jsonl'`; remove it from the expected array

## Step UPDATE_DOCS: Update SPEC and README

In `apps/standalone/SPEC.md`:

- Output section: remove `jsonl` from "Supported save formats: `txt`, `markdown`, `json`, `html`, `jsonl`, `original`."
- Sinks section: remove `jsonlSink` from `createCliSink` description

In `apps/standalone/README.md`:

- `--save` flag table row: remove `jsonl` from the formats list
- Do NOT modify any references to `list --format jsonl` (lines showing `--format jsonl` or "Formats: `json`, `jsonl` (default), `csv`")
