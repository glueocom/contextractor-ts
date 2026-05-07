# Auto-Fix: Code Review, Tests, and Verification

> **TLDR**: Runs after completing steps 1–3. Reviews implementation for correctness, runs all tests, and auto-fixes every failure in a loop. Covers schema refactor, storage layer, and security; examples verification is in `5-auto-fixing-examples.md`.

Run this after completing steps 1–3. Review the implementation, run all tests, fix every failure, and verify all acceptance criteria. Repeat the fix loop until everything is green.

## Prerequisites

All three implementation steps must be complete:

- `1-schema-refactor.md` — add `original` format, `save`/`saveDestination` fields, sinks
- `2-storage.md` — storage layer, subcommands, `serve` API, Dockerfile, docker-compose
- `3-examples.md` — example projects under `examples/`

This step covers schema refactor (step 1), storage layer (step 2), and security. Examples verification is in `5-auto-fixing-examples.md` — run that step separately after this one.

## Agents

- `code-reviewer` — Rust and TypeScript code review
- `ts-pro` — TypeScript fixes
- `rust-pro` — Rust fixes
- `test-runner` — run all checks

## Step REVIEW: Code Review

Read source files and verify each claim. Fix violations before running tests.

### Schema refactor (step 1)

- `txt` is the format identifier used consistently across `OutputFormat`, `SaveFormat`, `FORMAT_SPECS`, Zod schema enum, and `--save` help text. Verify no format-value uses `'text'` instead: `grep -rn "'text'" --include='*.ts' packages/ apps/` — any match that is a format value (not a MIME type, description, or human-readable label) is a bug.
- `txt` is a valid value in `OutputFormat`, `SaveFormat`, and `isSaveFormat`; `original` is valid in `SaveFormat` and `isSaveFormat` but must NOT appear in `OutputFormat` (it is filtered before calling the extraction layer).
- The four removed fields (`saveRawHtmlToKeyValueStore`, `saveExtractedTextToKeyValueStore`, `saveExtractedJsonToKeyValueStore`, `saveExtractedMarkdownToKeyValueStore`) are absent from the Zod schema, TypeScript types, and generated `input_schema.json`.
- `save` and `saveDestination` are present in `packages/schema/src/source-of-truth/input.ts` with correct enum values and defaults.
- `packages/schema/src/source-of-truth/output.ts` exists and exports a Zod schema for dataset items.
- `apps/apify-actor/.actor/dataset_schema.json` was generated and is valid JSON.
- `packages/schema/src/` restructured into `source-of-truth/` and `apify/` subdirectories; all import paths updated.
- `apps/apify-actor/src/sinks.ts` has a `FORMAT_SPECS` entry keyed `txt` and a `saveOriginal` field (not `saveHtml`).
- The `original` sink in `apps/standalone/src/sinks.ts` reads from the raw Playwright-captured HTML (not `result.formats.html`, which is the cleaned extracted HTML).

### Storage layer (step 2)

- `apps/standalone/src/storage/` exists with `Dataset` and `KeyValueStore` classes; no Crawlee/Apify SDK runtime dependency.
- Storage layout: `datasets/<name>/<n>.json`, `key_value_stores/<name>/<key>.<ext>`, `__metadata__.json` in each — byte-compatible with Crawlee's `@crawlee/memory-storage` (`MemoryStorage`) on-disk layout. (JS Crawlee has no `FileSystemStorageClient` — that class exists only in Crawlee for Python.)
- File writes are atomic: write to `.tmp`, then `rename`.
- `resolveStorageDir()` implements the four-level precedence: `--storage-dir` flag → `CONTEXTRACTOR_STORAGE_DIR` env → `./storage` (if `.actor/` or existing `./storage/`) → `${XDG_DATA_HOME:-~/.local/share}/contextractor/storage`.
- All subcommands wired: `extract`, `list`, `get`, `kvs put/get/ls/rm`, `purge`, `storage-dir`, `serve`.
- `serve` host-binding: npm rejects any non-loopback host with a clear error; Docker allows `0.0.0.0` only with `CONTEXTRACTOR_API_TOKEN` set.
- `/healthz` requires no auth; all `/v2/*` endpoints require `Authorization: Bearer` when host is non-loopback in Docker mode.
- `GET /v2/datasets/:name/items` returns a raw JSON array; `X-Apify-Pagination-Total`, `X-Apify-Pagination-Offset`, `X-Apify-Pagination-Limit`, `X-Apify-Pagination-Count` are set in response headers. KVS keys list uses the `{"data":{…}}` envelope.
- `isRunningInDocker()` uses exactly one detection method (either `/.dockerenv` or `CONTEXTRACTOR_DOCKER=1` env — not both).
- Storage errors (read-only dir, full disk) log a warning to stderr and continue with stdout-only — extraction does not fail.

### Security

- No `eval` or dynamic code execution in new files.
- No hardcoded tokens or credentials; all come from env vars.
- HTTP endpoints validate input with zod at every boundary.
- Scraped content not fed into templating engines without escaping.

## Step TEST: Run All Tests

Fix failures before proceeding to the next command.

### TypeScript build and regeneration

```bash
pnpm --filter @contextractor/gen-input-schema start
pnpm build
```

### Lint and unit tests

```bash
pnpm lint
pnpm test
```

### Schema snapshot

```bash
pnpm test -- --update-snapshots
```

Verify `packages/schema/test/to-apify-schema.test.ts` snapshot reflects `save` and `saveDestination`; no old boolean fields.

## Step CRITERIA: Verify Acceptance Criteria

### Schema refactor

- [ ] `txt` is the format identifier in all TypeScript/JSON format values — not `text`. No format enum, type, or CLI help uses `'text'` as a format name.
- [ ] `grep -r 'saveRawHtmlToKeyValueStore\|saveExtractedTextToKeyValueStore\|saveExtractedJsonToKeyValueStore\|saveExtractedMarkdownToKeyValueStore' packages/ apps/` — no matches.
- [ ] `pnpm build && pnpm lint && pnpm test` — all pass.
- [ ] `apps/apify-actor/.actor/input_schema.json` contains `save` and `saveDestination`; does not contain the four old boolean fields.
- [ ] `apps/apify-actor/.actor/dataset_schema.json` exists and is valid JSON.

### Storage layer

- [ ] `contextractor extract https://example.com` prints JSON to stdout AND creates `./storage/datasets/default/000000000.json` AND `./storage/datasets/default/__metadata__.json` with `itemCount: 1`.
- [ ] Two parallel `contextractor extract` runs against different URLs both succeed with no race-condition data loss.
- [ ] `contextractor serve` on npm: `--host 0.0.0.0` is rejected with a clear error message.
- [ ] In Docker: `serve --host 0.0.0.0` without `CONTEXTRACTOR_API_TOKEN` refuses to start.
- [ ] In Docker: `serve --host 0.0.0.0` with token, requests without `Authorization: Bearer` return HTTP 401; `/healthz` does not require auth.
- [ ] `GET /v2/datasets/default/items` returns a JSON array; response headers include `X-Apify-Pagination-Total`, `X-Apify-Pagination-Offset`, `X-Apify-Pagination-Limit`, `X-Apify-Pagination-Count`.
- [ ] `GET /v2/datasets/default/items?format=jsonl` returns NDJSON with `Content-Type: application/x-ndjson`.
- [ ] `docker run --rm <image> extract https://example.com` prints JSON to stdout (no `-v` required). Skip if bare-URL invocation without `extract` subcommand was not previously supported — note as deferred.
- [ ] `docker compose up -d api` + `docker compose run --rm extract https://example.com` + `curl -H 'Authorization: Bearer …' http://localhost:8080/v2/datasets/default/items` returns dataset items.
- [ ] Multi-arch image builds succeed: `docker buildx build --platform linux/amd64,linux/arm64 .`
- [ ] README copy-paste invocations are present for macOS bash, Linux bash, and Windows PowerShell.
- [ ] Snapshot test confirms existing single-URL file output in `./output/` is byte-identical to before.

## Step FIX: Auto-Fix Loop

For each failing test or unmet criterion:

- Read the failing file and the relevant spec section from prompts 1–3.
- Apply the minimal fix (use Edit tool; never rewrite the whole file).
- Re-run only the affected test command.
- Repeat until the criterion passes.

Do not mark a criterion as passing until its command exits 0 or the manual check is confirmed.

## Final Report

Write `prompts/2026-05-07-storage/report.md` covering schema refactor and storage layer findings. `5-auto-fixing-examples.md` appends examples findings to the same file.

- Any deviations from the specs in prompts 1–2 and why.
- Test output for each command above.
- Conflicts with the existing codebase and how they were resolved.
- Anything deferred (with rationale).
- Follow-up issues to file (v2 items, found-during-implementation TODOs).
