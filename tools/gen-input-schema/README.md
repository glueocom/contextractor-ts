# `@contextractor/gen-input-schema`

Build-time generator that emits
`apps/apify-actor/.actor/input_schema.json` from the Zod 4 schema in
`@contextractor/schema`. The Apify build pipeline runs it via
`pnpm --filter @contextractor/gen-input-schema start` before `tsc`; the snapshot test in
`@contextractor/schema` guards against drift between the Zod schema and the
emitted JSON.

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
