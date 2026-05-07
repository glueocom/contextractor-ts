# Example Projects

Create the following examples under `examples/`. Each must be self-contained and runnable. The `saveDestination` field applies only to Apify Actor invocations — do not include it in npm, Docker, or library examples.

## `examples/library-ts/`

Node.js TypeScript project consuming `@contextractor/standalone` as a library (programmatic API, not the CLI binary). Include `package.json`, `tsconfig.json`, and `src/main.ts`. Demonstrate calling `extract` and printing the result to stdout. No `saveDestination`.

## `examples/cli-npm/`

Folder with `run.sh` — shell script demonstrating the full npm CLI surface:

- Single URL extract: `contextractor extract <url> --save txt` — writes to default dataset and prints JSON to stdout.
- Single URL force NDJSON: `contextractor extract <url> --ndjson` — forces NDJSON output even for a single URL.
- Multi-URL extract (NDJSON): `contextractor extract <url1> <url2> --save markdown` — emits one JSON record per line on stdout.
- Named dataset: `contextractor extract <url> -o my-archive` — routes to `datasets/my-archive/`.
- Storage-only (no stdout): `contextractor extract <url> --no-stdout` — writes to storage, silent on stdout.
- Input file: `contextractor extract --input-file urls.txt` — reads URLs line by line.
- List default dataset: `contextractor list --format json --limit 10`.
- List named dataset: `contextractor list my-archive --format jsonl --desc` — named dataset, NDJSON output, descending order.
- Get a specific item: `contextractor get default 1`.
- KVS file write: `contextractor kvs put my-key ./file.json`.
- KVS stdin write with explicit MIME: `echo '{"ok":true}' | contextractor kvs put my-key - --content-type application/json`.
- KVS get: `contextractor kvs get my-key`.
- KVS list: `contextractor kvs ls --limit 20`.
- KVS delete: `contextractor kvs rm my-key`.
- Print resolved storage path: `contextractor storage-dir`.
- Purge default storage: `contextractor purge`.
- Purge all (including named datasets): `contextractor purge --all`.
- Serve API (loopback only): `contextractor serve --port 8080`; show `curl` calls to `GET /v2/datasets/default/items` and `POST /v2/extract`.
- Show npm host rejection: `contextractor serve --host 0.0.0.0` — prints the error message explaining that only `127.0.0.1` is allowed in the npm distribution.
- Custom storage dir: `CONTEXTRACTOR_STORAGE_DIR=./my-storage contextractor extract <url>`.

No `saveDestination`.

## `examples/cli-docker/`

Folder with `run.sh` demonstrating Docker usage. Requires Docker Engine ≥24.0.6 (containerd #8643 — see research/02 §2). Show cross-platform path variants in comments:

```sh
# macOS / Linux bash
-v "$(pwd)/storage:/storage"
# Linux sh / CI
-v "${PWD}/storage:/storage"
# Windows cmd
-v "%cd%/storage:/storage"
# Windows PowerShell
-v "${PWD}/storage:/storage"
```

Usage patterns to show:

- Stdout mode (no volume required): `docker run --rm <image> extract <url>`.
- Volume-backed extract: `docker run --rm -v "$(pwd)/storage:/storage" <image> extract <url>`.
- Storage-only (batch, silent stdout): `docker run --rm -v "$(pwd)/storage:/storage" <image> extract <url> --no-stdout`.
- Large outputs (avoid log-driver double-write): `docker run --rm --log-driver=none <image> extract <url>` — see research/02 §7.
- Linux UID safety (avoid root-owned output files): `docker run --rm --user "$(id -u):$(id -g)" -v "$(pwd)/storage:/storage" <image> extract <url>`.
- Serve with token (`0.0.0.0` requires `CONTEXTRACTOR_API_TOKEN`): `docker run -d -p 8080:8080 -v "$(pwd)/storage:/storage" -e CONTEXTRACTOR_API_TOKEN=<token> <image> serve --host 0.0.0.0`; show `curl` calls with `Authorization: Bearer` to `GET /v2/datasets/default/items` and `POST /v2/extract`.
- Check health: `curl http://localhost:8080/healthz` — unauthenticated; verifies the container is up and shows `storageDir` and dataset count.
- Show token enforcement: `docker run -d -p 8080:8080 <image> serve --host 0.0.0.0` (no `CONTEXTRACTOR_API_TOKEN`) — the process must refuse to start with a clear error; demonstrate this exit behavior.

No `saveDestination`.

## `examples/docker-compose/`

Folder with `docker-compose.yml` demonstrating both modes:

- `api` service: `serve --host 0.0.0.0 --port 8080`, healthcheck on `/healthz`, `CONTEXTRACTOR_API_TOKEN` from env, named volume `ctx_storage:/storage`, `restart: unless-stopped`.
- `extract` service under `profiles: ["cli"]`, same volume, entrypoint pointed at `extract`. Document the `docker compose run --rm extract <url>` invocation.
- `dev` service (optional, for local development): same image with `--insecure` flag and a fixed token; print the loud stderr warning this produces.

Show the full round-trip: `docker compose up -d api` + `curl http://localhost:8080/healthz` + `docker compose run --rm extract <url>` + `curl -H 'Authorization: Bearer …' http://localhost:8080/v2/datasets/default/items` + `curl -H 'Authorization: Bearer …' -X POST http://localhost:8080/v2/extract -d '{"url":"<url>"}' -H 'Content-Type: application/json'`. No `saveDestination`.

## `examples/docker-api-ts/`

Node.js TypeScript project calling Contextractor via the Docker Engine API (no CLI). Use the Docker socket to start a container running `contextractor serve`, call `GET /healthz` to confirm readiness, trigger extraction via `POST /v2/extract`, and retrieve results via `GET /v2/datasets/default/items`. Include `package.json`, `tsconfig.json`, and `src/main.ts`. No `saveDestination`.

## `examples/apify-api-ts/`

Node.js TypeScript project calling the test Apify actor (`glueo/contextractor-test`) via the Apify API. Use the `apify-client` npm package. Start a run, wait for it to finish, and retrieve dataset results. Include `package.json`, `tsconfig.json`, and `src/main.ts`. Pass `saveDestination: ['dataset']` in the actor input to demonstrate dataset output.

## `examples/cli-apify/`

Folder containing `run.sh` — shell script calling `glueo/contextractor-test` via the Apify CLI (`apify call`). Pass actor input as JSON including `saveDestination`.
