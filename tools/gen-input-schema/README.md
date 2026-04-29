# `@contextractor/gen-input-schema`

Build-time generator that emits
`apps/apify-actor/.actor/input_schema.json` from the Zod 4 schema in
`@contextractor/schema`. The Apify build pipeline runs it via `npm run start -w
@contextractor/gen-input-schema` before `tsc`; the snapshot test in
`@contextractor/schema` guards against drift between the Zod schema and the
emitted JSON.

Contextractor is built on
[`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura)
(extraction) and [Crawlee](https://crawlee.dev/) (TypeScript crawler driving
Playwright); this tool keeps the Crawlee-facing Actor schema aligned with the
shared input contract.

## Manual run

```bash
npm run start -w @contextractor/gen-input-schema
# optional: write to a custom path instead of the canonical one
npm run start -w @contextractor/gen-input-schema -- path/to/input_schema.json
```
