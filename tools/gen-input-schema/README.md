# `@contextractor/gen-input-schema`

Build-time generator that emits all four generated `apps/apify-actor/.actor/`
schema files from the Zod 4 source of truth in `@contextractor/schema`:

- `input_schema.json` — from `ContextractorInput`
- `dataset_schema.json` — from the `ContextractorOutput` discriminated union + `OutputViews`
- `output_schema.json` — from `OutputViews`
- `key_value_store_schema.json` — from `KvsCollections`

(`actor.json` stays hand-written.) The Apify build pipeline runs it via
`pnpm --filter @contextractor/gen-input-schema start` before `tsc`; snapshot
tests in `@contextractor/schema` guard against drift between the Zod schema and
the emitted JSON.

Contextractor is built on
[`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura)
(extraction) and [Crawlee](https://crawlee.dev/) (TypeScript crawler driving
Playwright); this tool keeps the Crawlee-facing Actor schema aligned with the
shared input contract.

## Manual run

- **Node 22+**, **pnpm 10+**.

```bash
pnpm --filter @contextractor/gen-input-schema start
# optional: write to a custom path instead of the canonical one
pnpm --filter @contextractor/gen-input-schema start -- path/to/input_schema.json
```
