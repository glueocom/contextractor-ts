# Storage Feature — Full Implementation

> **TLDR**: Orchestrates a full feature build in seven ordered steps: remove Docker, refactor the schema, add a storage layer and HTTP API, create examples, then verify with two auto-fix passes and a full monorepo test suite.

Run all steps in order. Each step must complete and pass before the next begins. Read each referenced file in full before executing it.

## What this builds

- Unified `save` / `saveDestination` schema fields replacing five boolean save flags; `original` format for raw HTML
- Apify/Crawlee-compatible local storage layer (`Dataset`, `KeyValueStore`), new CLI subcommands (`extract`, `list`, `get`, `kvs`, `purge`, `storage-dir`, `serve`), and an HTTP API mirroring Apify v2
- Four self-contained example projects under `examples/`

Shipping targets: **Apify Actor** and **npm package** (CLI + library). No Docker distribution.

## Step REMOVE-DOCKER: Remove Docker Distribution

Read and execute [`0-remove-docker.md`](./0-remove-docker.md).

Removes the Dockerfile, docker-compose.yml, Docker examples, Docker-mode serve logic, and all Docker references in specs and docs. Simplifies `serve` to npm-only localhost.

Commit when complete.

## Step SCHEMA: Schema Refactor

Read and execute [`1-schema-refactor.md`](./1-schema-refactor.md).

Replaces the five boolean save fields with `save` (enum array) and `saveDestination`, adds the `original` format, restructures `packages/schema/src/` into `source-of-truth/` and `apify/` subdirectories, and adds a new output schema.

Commit when complete.

## Step STORAGE: Storage Layer and Serve

Read and execute [`2-storage.md`](./2-storage.md).

Builds the storage helper module, wires all new CLI subcommands, implements the `serve` HTTP API (npm-only, localhost). Read the five research files in `./research/` before designing anything — they are referenced throughout.

Commit after each discrete implementation task (storage module, CLI wiring, serve, README).

## Step EXAMPLES: Example Projects

Read and execute [`3-examples.md`](./3-examples.md).

Creates four self-contained examples under `examples/`: `library-ts/`, `cli-npm/`, `apify-api-ts/`, `cli-apify/`.

Commit when complete.

## Step VERIFY: Auto-Fix — Implementation

Read and execute [`4-auto-fixing-tests.md`](./4-auto-fixing-tests.md).

Reviews the schema refactor and storage layer implementations, runs `pnpm build && pnpm lint && pnpm test`, verifies all acceptance criteria, and fixes every failure. Writes `report.md` with findings.

Do not proceed to the next step until all criteria pass.

## Step VERIFY-EXAMPLES: Auto-Fix — Examples

Read and execute [`5-auto-fixing-examples.md`](./5-auto-fixing-examples.md).

Reviews every example project for correctness (content, structure, security invariants), runs TypeScript compilation, and fixes every failure. Appends examples findings to `report.md`.

Do not mark complete until all checks pass.

## Step UNIT-TESTS: Full Test Suite

Read and execute [`6-unit-tests.md`](./6-unit-tests.md).

Audits every package and app in the repo for unit test coverage gaps, writes missing tests, and ensures `pnpm build && pnpm lint && pnpm test && cargo test --workspace` all pass green.

Do not mark complete until all checks pass.
