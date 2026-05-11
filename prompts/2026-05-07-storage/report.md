# Storage Feature — Implementation Report

Date: 2026-05-12

## Summary

Steps 0–3 of the storage feature (`master.md`) implemented successfully. All acceptance criteria pass.

## Schema refactor (step 1)

### Status: complete

- `save` (formats array) and `saveDestination` (sinks array) added to `packages/schema/src/source-of-truth/input.ts`.
- Five old boolean fields (`saveRawHtmlToKeyValueStore`, etc.) absent from schema and generated JSON.
- `packages/schema/src/source-of-truth/output.ts` exists and exports the dataset item shape.
- `apps/apify-actor/.actor/dataset_schema.json` generated and valid.
- `txt` used as format identifier consistently; `'text'` does not appear as a format value.
- `packages/schema/SPEC.md` updated to reflect new output settings fields.

### Deviations

None.

## Storage layer (step 2)

### Status: complete

- `apps/standalone/src/storage/resolve-storage-dir.ts` — five-level precedence implemented.
- `apps/standalone/src/storage/index.ts` — `configureStorage` sets `purgeOnStart: false` and `localDataDirectory` before any Crawlee storage call.
- `crawlee ^3.16.0` added to `apps/standalone/package.json`.
- All subcommands wired: `extract`, `list`, `get`, `kvs put/get/ls/rm`, `purge`, `storage-dir`.
- Library re-exports from `@contextractor/standalone`: `Dataset`, `KeyValueStore`, `Configuration`, `configureStorage`, `resolveStorageDir`, `DatasetContent` (inline interface).
- `configureStorage` called before storage access in every subcommand action.

### Deviations

- `DatasetContent` defined as an inline interface rather than re-exported from `@crawlee/core` — `@crawlee/core` is not a direct dependency and its internal type `DatasetDataPage` is not re-exported through the `crawlee` facade. The interface matches the shape exactly.

### Issues resolved during implementation

- `.gitignore` had bare `storage` entry (meant for Crawlee's `./storage/` runtime data directory) which was silently ignoring `apps/standalone/src/storage/` source files. Fixed by changing to `storage/` + `!apps/standalone/src/storage/` negation.

## Examples (step 3)

### Status: complete

- `examples/library-ts/` — programmatic API, Dataset/KeyValueStore re-exports.
- `examples/cli-npm/run.sh` — 18 command patterns, executable.
- `examples/apify-api-ts/` — apify-client calling `glueo/contextractor-test`, `saveDestination: ['dataset']`.
- `examples/cli-apify/run.sh` — Apify CLI call, executable.

All examples use `txt` (not `text`), `glueo/contextractor-test`, secrets from env vars, `--dataset` for named datasets.

## Verification commands

```
pnpm build    → 10/10 tasks
pnpm lint     → 8/8 tasks (1 pre-existing warning in apify sinks.test.ts)
pnpm test     → 13/13 tasks (26 standalone tests, 13 gen-md-regions tests)
```

## Examples verification (step 3)

### Status: complete

- All four examples created: `library-ts/`, `cli-npm/`, `apify-api-ts/`, `cli-apify/`.
- `run.sh` files in `cli-npm/` and `cli-apify/` are executable.
- `saveDestination` / `--save-destination` present in all three expected files.
- `glueo/contextractor-test` used consistently; no bare `glueo/contextractor` reference.
- All 18 command patterns present in `cli-npm/run.sh`.
- No hardcoded tokens; all from env vars.
- `txt` used throughout; no `text` format values.
- Both TypeScript examples compile without errors after `npm install`.

### Deviations

- `library-ts/package.json` uses `"file:../../apps/standalone"` instead of `"^0.1.0"` so the example compiles against the local source rather than requiring an npm publish. A published user would use the semver range — this is a monorepo dev concern only.
- `library-ts` uses `buildProgram().parseAsync()` as the programmatic API. A higher-level `extract(url, opts)` function would be a cleaner library surface for a v2.

### Deferred

- `apify-api-ts` and `cli-apify` cannot be fully validated without a live Apify environment and a valid `APIFY_TOKEN`. Type-checking passes; runtime behaviour deferred to integration/platform test.

## Follow-up (not blocking this PR)

- `apps/apify-actor/src/sinks.test.ts:93` — `noTemplateCurlyInString` warning on a test description string. Pre-existing, cosmetic only.
- `examples/library-ts` — calls `buildProgram().parseAsync()` as the programmatic API. A higher-level `extract(url, opts)` helper function would be a nicer library surface for v2.
