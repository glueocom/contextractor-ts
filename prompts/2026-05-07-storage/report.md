# Examples Verification Report

Date: 2026-05-08

## Structure Checks

All seven example directories exist:

- `examples/library-ts/` — `package.json`, `tsconfig.json`, `src/main.ts` present
- `examples/cli-npm/` — `run.sh` present and executable
- `examples/cli-docker/` — `run.sh` present and executable
- `examples/docker-compose/` — `docker-compose.yml` present
- `examples/docker-api-ts/` — `package.json`, `tsconfig.json`, `src/main.ts` present
- `examples/apify-api-ts/` — `package.json`, `tsconfig.json`, `src/main.ts` present
- `examples/cli-apify/` — `run.sh` present and executable

## Validation Results

### TypeScript Compilation

- `library-ts`: PASS (`npx tsc --noEmit`)
- `docker-api-ts`: PASS (`npx tsc --noEmit`)
- `apify-api-ts`: PASS (`npx tsc --noEmit`)

### docker-compose Validation

- `docker-compose/docker-compose.yml`: PASS (`docker compose config --quiet`)

### File Permissions

- `cli-npm/run.sh`: executable — PASS
- `cli-docker/run.sh`: executable — PASS
- `cli-apify/run.sh`: executable — PASS

### Content Checks

- No `saveDestination` in non-Apify examples: PASS
- `saveDestination` present in `apify-api-ts/src/main.ts` and `cli-apify/run.sh`: PASS
- No bare `glueo/contextractor` (production) reference: PASS
- No `--format` flag outside `contextractor list` commands: PASS
- No `text` format value (correct `txt` used throughout): PASS
- No hardcoded credentials (all tokens from env vars or placeholder demo values): PASS

### cli-npm/run.sh: 20 Command Patterns

All 20 patterns present: single URL extract, force NDJSON, multi-URL extract, named dataset, storage-only, input file, list default dataset, list named dataset, get item, KVS put file, KVS put stdin, KVS get, KVS list, KVS delete, storage-dir, purge default, purge all, serve with curl calls, npm host rejection, custom storage dir.

### cli-docker/run.sh: Docker Patterns

All patterns present: four cross-platform path variant comments, stdout mode, volume-backed extract, storage-only batch, `--log-driver=none`, Linux UID safety with `--user "$(id -u):$(id -g)"`, serve with token + `Authorization: Bearer` curl calls, health check on `/healthz`, token enforcement demo.

### docker-compose/docker-compose.yml: Services

`api` service: `serve --host 0.0.0.0 --port 8080`, healthcheck on `/healthz`, `CONTEXTRACTOR_API_TOKEN` from env, named volume `ctx_storage:/storage`, `restart: unless-stopped` — PASS

`extract` service: under `profiles: ["cli"]`, same volume, entrypoint pointing at `extract` — PASS

`dev` service: `--insecure` flag, fixed `dev-token`, `profiles: ["dev"]` — PASS

## Fix Applied

### docker-api-ts: Rewrote to Use Docker Engine API

The original `examples/docker-api-ts/src/main.ts` used `execSync` from `node:child_process` to call `docker run`, `docker exec`, and `docker stop` CLI subprocesses. This violated the spec requirement of "Docker Engine API — no CLI subprocess calls".

Fix: rewrote `src/main.ts` to use Node.js's built-in `http` module with `socketPath: '/var/run/docker.sock'` to call the Docker Engine HTTP API directly:

- Container creation: `POST /containers/create`
- Container start: `POST /containers/{id}/start`
- In-container command execution: `POST /containers/{id}/exec` + `POST /exec/{id}/start` (Detach mode)
- Container stop/removal: `POST /containers/{id}/stop` + `DELETE /containers/{id}`
- Health polling: `GET /healthz` on the contextractor serve port via native `fetch`
- Dataset retrieval: `GET /v2/datasets/default/items` via native `fetch`

No `node:child_process` import remains. TypeScript compilation passes.

## Deviations from `3-examples.md`

### Named dataset flag: `--dataset` vs `-o`

The spec says `contextractor extract <url> -o my-archive`. In the actual CLI, `-o` is the short form of `--output-dir` (filesystem output directory), not `--dataset`. Using `-o my-archive` would set the output directory, not route to a named dataset. The implementation correctly uses `--dataset my-archive`. This is a spec error — the implementation is correct.

### get item index: 0 vs 1

The spec says `contextractor get default 1`. The `get` command uses 0-based indexing. Index `0` retrieves the first item. The implementation uses `0` which is the natural default for a demonstration. The spec's `1` would skip the first item.

### POST /v2/extract not implemented

The spec for `docker-api-ts` says "trigger extraction via `POST /v2/extract`". This endpoint exists but returns HTTP 500 with `NOT_IMPLEMENTED` — extraction requires the Playwright crawler which is too heavy for an inline HTTP handler in v1. The docker-api-ts example uses the Docker Engine exec API (`POST /containers/{id}/exec`) to run `contextractor extract` inside the container instead. The doc comment in `src/main.ts` notes this explicitly.

## Deferred Checks (Live Environment Required)

- `docker-api-ts`: end-to-end execution requires Docker Engine running, the `contextractor:latest` image built, and Playwright browser available. TypeScript compilation passes; runtime behavior is deferred.
- `cli-docker/run.sh`: all Docker commands require Docker Engine ≥24.0.6. Validated structurally; runtime deferred.
- `docker-compose/docker-compose.yml`: validated with `docker compose config --quiet`; full service startup deferred.
- `apify-api-ts`: requires a valid `APIFY_TOKEN` env var and network access to `api.apify.com`. TypeScript compilation passes; runtime behavior deferred.
- `cli-apify/run.sh`: requires `apify-cli` installed and an authenticated Apify account. Validated structurally; runtime deferred.

## Follow-up Issues

- `POST /v2/extract` is documented as not implemented across multiple examples. Implementing this endpoint would simplify the `docker-api-ts` example and unlock the programmatic extraction flow described in `3-examples.md`.
- The spec's named dataset example (`-o my-archive`) should be corrected to `--dataset my-archive` in `3-examples.md`.
- The spec's `get` example index should be updated from `1` to `0` to reflect 0-based indexing.
