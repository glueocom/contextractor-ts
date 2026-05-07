# Example Projects

Create the following examples under `examples/`. Each must be self-contained and runnable. The `saveDestination` field applies only to Apify Actor invocations — do not include it in npm, Docker, or library examples.

## `examples/library-ts/`

Node.js TypeScript project consuming `@contextractor/standalone` as a library (programmatic API, not the CLI binary). Include `package.json`, `tsconfig.json`, and `src/main.ts`. The example should extract content from a URL and print the result to stdout. No `saveDestination`.

## `examples/cli-npm/`

Folder containing `run.sh` — shell script invoking the `contextractor` CLI from the installed npm package. Show basic usage: one URL, `--save markdown`, `--output-dir ./out`. No `saveDestination`.

## `examples/cli-docker/`

Folder containing `run.sh` — shell script invoking Contextractor via the Docker CLI. Use `docker run` with the published image. Pass URL and save flags as Docker command arguments. No `saveDestination`.

## `examples/docker-api-ts/`

Node.js TypeScript project calling Contextractor via the Docker Engine API (no CLI). Use the Docker socket to start a container, pass input, and collect output. Include `package.json`, `tsconfig.json`, and `src/main.ts`. No `saveDestination`.

## `examples/apify-api-ts/`

Node.js TypeScript project calling the test Apify actor (`glueo/contextractor-test`) via the Apify API. Use the `apify-client` npm package. Start a run, wait for it to finish, and retrieve dataset results. Include `package.json`, `tsconfig.json`, and `src/main.ts`. Pass `saveDestination: ['dataset']` in the actor input to demonstrate dataset output.

## `examples/cli-apify/`

Folder containing `run.sh` — shell script calling `glueo/contextractor-test` via the Apify CLI (`apify call`). Pass actor input as JSON including `saveDestination`.
