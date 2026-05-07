# Example Projects

Create the following examples under `examples/`. Each must be self-contained and runnable. The `saveDestination` field applies only to Apify Actor invocations — do not include it in npm, Docker, or library examples.

## `examples/library-ts/`

Node.js TypeScript project consuming `@contextractor/standalone` as a library (programmatic API, not the CLI binary). Include `package.json`, `tsconfig.json`, and `src/main.ts`. Demonstrate calling `extract` and printing the result to stdout. No `saveDestination`.

## `examples/cli-npm/`

Folder with `run.sh` — shell script showing three npm CLI usage patterns:

- Basic extract: `contextractor extract <url> --save markdown` — writes to default dataset and prints JSON to stdout.
- List stored results: `contextractor list --format json`.
- Serve API: `contextractor serve` — starts the server on `127.0.0.1` and shows `curl` calls to `GET /v2/datasets/default/items`.

No `saveDestination`.

## `examples/cli-docker/`

Folder with `run.sh` — shell script showing three Docker usage patterns:

- Stdout mode: `docker run --rm contextractor extract <url>` — no volume required.
- Volume-backed extract: `docker run --rm -v $(pwd)/storage:/storage contextractor extract <url>` — writes to bound storage dir.
- Serve mode with token: `docker run -d -p 8080:8080 -v $(pwd)/storage:/storage -e CONTEXTRACTOR_API_TOKEN=<token> contextractor serve --host 0.0.0.0` — shows `curl` calls with `Authorization: Bearer`.

No `saveDestination`.

## `examples/docker-compose/`

Folder with `docker-compose.yml` demonstrating both modes:

- `api` service: `serve --host 0.0.0.0 --port 8080`, healthcheck on `/healthz`, `CONTEXTRACTOR_API_TOKEN` from env, named volume `ctx_storage:/storage`, `restart: unless-stopped`.
- `extract` service under `profiles: ["cli"]`, same volume, entrypoint pointed at `extract`.

Show `docker compose up -d api` + `docker compose run --rm extract <url>` + `curl -H 'Authorization: Bearer …' http://localhost:8080/v2/datasets/default/items` round-trip. No `saveDestination`.

## `examples/docker-api-ts/`

Node.js TypeScript project calling Contextractor via the Docker Engine API (no CLI). Use the Docker socket to start a container, pass URL input, and collect output by calling `GET /v2/datasets/default/items` on the running `contextractor serve` container. Include `package.json`, `tsconfig.json`, and `src/main.ts`. No `saveDestination`.

## `examples/apify-api-ts/`

Node.js TypeScript project calling the test Apify actor (`glueo/contextractor-test`) via the Apify API. Use the `apify-client` npm package. Start a run, wait for it to finish, and retrieve dataset results. Include `package.json`, `tsconfig.json`, and `src/main.ts`. Pass `saveDestination: ['dataset']` in the actor input to demonstrate dataset output.

## `examples/cli-apify/`

Folder containing `run.sh` — shell script calling `glueo/contextractor-test` via the Apify CLI (`apify call`). Pass actor input as JSON including `saveDestination`.
