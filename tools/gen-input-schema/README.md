# `@contextractor/gen-input-schema`

Build-time generator that emits
`apps/contextractor-apify/.actor/input_schema.json` from the Zod 4 schema in
`@contextractor/schema`. The Apify build pipeline runs it via `pnpm -F
@contextractor/gen-input-schema start` before `tsc`; the snapshot test in
`@contextractor/schema` guards against drift between the Zod schema and the
emitted JSON.

## Manual run

```bash
pnpm -F @contextractor/gen-input-schema start
# optional: write to a custom path instead of the canonical one
pnpm -F @contextractor/gen-input-schema start path/to/input_schema.json
```
