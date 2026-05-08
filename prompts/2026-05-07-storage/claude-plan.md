# Execute master.md — Storage Feature Full Implementation

## Context

The user wants to run `prompts/2026-05-07-storage/master.md`, which orchestrates a 6-step feature build on the `dev` branch. The previous commit (`7802a48`) already added the unit test instructions to steps 1–3 and created `6-unit-tests.md` — those prompt file changes are done. What remains is executing the implementation described by all six steps.

**Nothing from the implementation exists yet** — no schema subdirs, no storage module, no CLI subcommands, no `examples/` directory, no Dockerfile/docker-compose.

---

## Step SCHEMA — Schema Refactor (`1-schema-refactor.md`)

**Agent:** `ts-pro`

### Files to change

- `packages/schema/src/input.ts` — remove the 5 boolean save fields; add `save` (enum array, default `['markdown']`) and `saveDestination` (enum array, default `['key-value-store']`); add `'original'` to format enum
- **Move** `packages/schema/src/input.ts` → `packages/schema/src/source-of-truth/input.ts`
- **Move** `packages/schema/src/apify-meta.ts` → `packages/schema/src/apify/apify-meta.ts`
- **Move** `packages/schema/src/to-apify-schema.ts` → `packages/schema/src/apify/to-apify-schema.ts`
- `packages/schema/src/index.ts` — update all import paths after the move
- `packages/schema/src/source-of-truth/output.ts` (new) — Zod schema for Actor dataset output items; field names aligned with `rs-trafilatura` output (`title`, `author`, `url`, `hostname`, `description`, `sitename`, `date`, `categories`, `tags`, `fingerprint`, `id`, `license`, `text`, `comments`)
- `tools/gen-input-schema/` — extend to also generate `apps/apify-actor/.actor/dataset_schema.json` from `output.ts`
- `apps/apify-actor/src/config.ts` — replace 4-boolean format derivation with `input.save.filter(f => f !== 'original')`; fallback to `['markdown']` when array is empty
- `apps/apify-actor/src/sinks.ts` — rename `saveHtml` → `saveOriginal`; add `saveDestination` routing (KVS vs dataset)
- `apps/apify-actor/src/run.ts` — update `createApifySink` call to pass `saveOriginal` and `saveDestination`
- `apps/standalone/src/cliProgram.ts` — remove `--format` option (redundant alias of `--save`); add `'original'` to `--save` help text
- `apps/standalone/src/config.ts` — add `'original'` to `SaveFormat`; remove `'text'`→`'txt'` alias
- `apps/standalone/src/sinks.ts` — add `original` sink writing raw Playwright HTML (not `result.formats.html`) to `${slug}-raw.html`
- Update all consumers of moved/renamed schema exports

### Unit tests to write (same response as implementation)

- `packages/schema/src/source-of-truth/input.test.ts` — `save` default/enum/rejection; `saveDestination` default/enum/rejection; removed boolean fields absent from type
- `apps/apify-actor/src/config.test.ts` — `save: ['original']` → falls back to `['markdown']`; mixed arrays filter correctly
- `apps/apify-actor/src/sinks.test.ts` — KVS vs dataset routing; `saveOriginal` uses `${keyBase}-original.html` key

### Commit

Single commit when all tests pass.

---

## Step STORAGE — Storage Layer, CLI Subcommands, Serve, Docker (`2-storage.md`)

**Agent:** `ts-pro`

Read the five research files in `prompts/2026-05-07-storage/research/` before designing anything.

### Storage module location

The storage helper belongs in `apps/standalone/src/storage/` (pure TS, standalone-specific, no shared consumers yet). If during implementation the crawler package would benefit from it, move it — but don't pre-optimize.

### Files to create/change (in commit order)

**Task STORAGE-MODULE:**
- `apps/standalone/src/storage/dataset.ts` — `Dataset` class with atomic writes (write `.tmp` → `rename`), nine-digit zero-padded file names, `__metadata__.json` coordination
- `apps/standalone/src/storage/key-value-store.ts` — `KeyValueStore` class; MIME→extension via `mime-types`
- `apps/standalone/src/storage/resolve-storage-dir.ts` — four-level precedence: `--storage-dir` flag → `CONTEXTRACTOR_STORAGE_DIR` → `./storage` (if `.actor/` or existing `./storage/`) → XDG fallback
- `apps/standalone/src/storage/index.ts` — re-export
- Tests: `dataset.test.ts`, `key-value-store.test.ts`, `resolve-storage-dir.test.ts` (all using `fs.mkdtempSync` temp dirs)

**Task CLI-SUBCOMMANDS:**
- `apps/standalone/src/cliProgram.ts` — refactor to Commander.js subcommand structure: `extract`, `list`, `get`, `kvs put/get/ls/rm`, `purge`, `storage-dir`, `serve`; preserve bare-URL shorthand if it exists; all log → stderr, data → stdout
- `apps/standalone/src/sinks.ts` — wire `extract` to also write to storage (`Dataset.pushData`)
- Unit tests for each subcommand using temp storage dirs

**Task SERVE:**
- `apps/standalone/src/serve/server.ts` — Hono server (or existing router if already present); all Apify v2 endpoints; npm/Docker security split via `isRunningInDocker()` using `CONTEXTRACTOR_DOCKER=1` env var (set by Dockerfile)
- `apps/standalone/src/serve/serve.test.ts` — use `hono/testing` `app.request()`; covers healthz, pagination headers, NDJSON format, auth enforcement in both modes
- `/openapi.json` + `/docs` Swagger UI

**Task DOCKERFILE:**
- `apps/standalone/Dockerfile` — multi-stage: `node:22-slim` build → `mcr.microsoft.com/playwright:v<X>-noble` runtime; non-root user `ctx` (UID 1000); `ENV CONTEXTRACTOR_STORAGE_DIR=/storage CONTEXTRACTOR_DOCKER=1 PORT=8080`; `EXPOSE 8080`; no `VOLUME` declaration; `ENTRYPOINT ["node", "/app/dist/cli.js"]`; `CMD ["--help"]`
- Playwright version pinned to match `packages/crawler/package.json`

**Task DOCKER-COMPOSE:**
- `apps/standalone/docker-compose.yml` — `api` service (serve, healthcheck, token from env, named volume `ctx_storage:/storage`, `restart: unless-stopped`); `extract` service under `profiles: ["cli"]`

**Task README:**
- Update `apps/standalone/README.md` — document all new subcommands, storage dir resolution, npm-vs-Docker split, cross-platform path variants, `--log-driver=none`, min Docker Engine 24.0.6

### Commit after each discrete task above.

---

## Step EXAMPLES — Example Projects (`3-examples.md`)

**Agent:** `ts-pro`

Create `examples/` at repo root with seven subdirectories:

- `examples/library-ts/` — `package.json`, `tsconfig.json`, `src/main.ts` (programmatic API, no `saveDestination`)
- `examples/cli-npm/run.sh` — 20 command patterns from the prompt; executable; no `saveDestination`
- `examples/cli-docker/run.sh` — Docker usage with all four cross-platform path variants; `--log-driver=none`, `--user`; Docker Engine ≥24.0.6 note; executable; no `saveDestination`
- `examples/docker-compose/docker-compose.yml` — `api`, `extract` (profile cli), `dev` services; full round-trip commands documented
- `examples/docker-api-ts/` — Docker Engine API via Docker socket; `package.json`, `tsconfig.json`, `src/main.ts`; no CLI subprocess; no `saveDestination`
- `examples/apify-api-ts/` — `apify-client`; targets `glueo/contextractor-test`; `saveDestination: ['dataset']`; `package.json`, `tsconfig.json`, `src/main.ts`
- `examples/cli-apify/run.sh` — `apify call glueo/contextractor-test`; includes `saveDestination`; executable

Single commit when complete.

---

## Step VERIFY — Auto-Fix Implementation (`4-auto-fixing-tests.md`)

**Agents:** `ts-pro` for fixes, `test-runner` to run checks

Run in a loop until all pass:

```bash
pnpm --filter @contextractor/gen-input-schema start
pnpm build
pnpm lint
pnpm test
pnpm test -- --update-snapshots   # verify schema snapshot has save/saveDestination
```

**Key checks:**
- No `'text'` format value in TypeScript source (grep for `'text'` in format contexts)
- No old boolean field names anywhere in packages/ and apps/
- `apps/apify-actor/.actor/input_schema.json` has `save`/`saveDestination`, not old fields
- `apps/apify-actor/.actor/dataset_schema.json` exists and is valid JSON
- Storage layout byte-compatible with Crawlee `@crawlee/memory-storage` JSON layout
- `serve` host-binding enforcement (npm loopback-only; Docker requires token for non-loopback)
- Pagination headers on `GET /v2/datasets/:name/items`

Write findings to `prompts/2026-05-07-storage/report.md`.

Do not proceed until all `pnpm build && pnpm lint && pnpm test` pass.

---

## Step VERIFY-EXAMPLES — Auto-Fix Examples (`5-auto-fixing-examples.md`)

**Agents:** `ts-pro` for fixes, `code-reviewer` for content review

Validation commands:

```bash
cd examples/library-ts && npx tsc --noEmit
cd examples/docker-api-ts && npx tsc --noEmit
cd examples/apify-api-ts && npx tsc --noEmit
docker compose -f examples/docker-compose/docker-compose.yml config --quiet
test -x examples/cli-npm/run.sh
test -x examples/cli-docker/run.sh
test -x examples/cli-apify/run.sh
grep -rl 'saveDestination' examples/library-ts/ examples/cli-npm/ examples/cli-docker/ examples/docker-compose/ examples/docker-api-ts/  # must be empty
grep -l 'saveDestination' examples/apify-api-ts/src/main.ts examples/cli-apify/run.sh  # both must appear
grep -rn 'glueo/contextractor[^-]' examples/  # must be empty
```

Append findings to `prompts/2026-05-07-storage/report.md`.

---

## Step UNIT-TESTS — Full Monorepo Test Coverage (`6-unit-tests.md`)

**Agents:** `ts-pro` for TypeScript tests, `rust-pro` for Rust tests, `test-runner` for final run

**Audit targets:**
- `packages/extraction/src/` — extraction, format handling, metadata, errors
- `packages/crawler/src/` — crawler construction, sink composition (currently zero tests)
- `packages/schema/src/` — schema parsing, `toApifySchema`, `save`/`saveDestination` validation
- `apps/standalone/src/` — CLI parsing, `validateSaveFormats`, config merging, storage integration, `original` format
- `apps/apify-actor/src/` — Actor config derivation, sink routing, `isRunningInDocker`
- `packages/extraction/native/src/` — Rust unit tests in `#[cfg(test)] mod tests`

**Final suite:**

```bash
pnpm build && pnpm lint && pnpm test && cargo test --workspace && cargo clippy --workspace --all-targets -- -D warnings
```

All must exit 0. No skipped or todo tests for functionality added in steps 1–3.

---

## Verification

The full suite is green when:

```bash
pnpm build && pnpm lint && pnpm test && cargo test --workspace
```

…all exit 0, plus:
- `docker compose -f examples/docker-compose/docker-compose.yml config --quiet` exits 0
- TypeScript examples compile without errors
- `report.md` exists with findings from steps 4 and 5
