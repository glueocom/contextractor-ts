# Step port-engine-to-ts

## TLDR

Rewrite `packages/contextractor-engine/src/index.ts` mirroring the Python `ContentExtractor` / `TrafilaturaConfig` API. The TS engine wraps the napi-rs binding from the previous step; consumers (`apps/contextractor-apify`, `apps/contextractor-standalone`, `tools/generated-unit-tests`) import from `@contextractor/engine`.

## Skills and agents

- Agent: `ts-pro`, then `code-reviewer`.

## Inputs

- Read `packages/contextractor-engine/PYTHON_API_REFERENCE.md` (created in `step-rename-engine-package`).
- Read `../migrate-py-to-ts-rust-notes/rs-trafilatura.md` (mapping table).
- Read `../user-entry-log/entry-qa-xml-formats.md` (supported formats: `txt`, `markdown`, `json`, `html`).

## Actions

- Define `OutputFormat = 'txt' | 'markdown' | 'json' | 'html'` (no `xml`, no `xmltei`).
- Define `TrafilaturaConfig` interface mirroring the Python dataclass field-by-field, camelCase. Default values come from a frozen `DEFAULT_CONFIG` object, also exported.
- Implement `class ContentExtractor`:
  - constructor `(config?: Partial<TrafilaturaConfig>)`.
  - `extract(html: string, opts: { url?: string; format: OutputFormat }): ExtractionResult` — delegates to native binding.
  - `extractMetadata(html: string, url?: string): Metadata` — delegates.
  - `extractAllFormats(html: string, opts?: { formats?: OutputFormat[] }): Record<OutputFormat, ExtractionResult>` — defaults to `['txt', 'markdown', 'json']` (drops `xml` from the Python default).
- Re-export native types so consumers don't need to import the native package directly.
- Add JSDoc on every public symbol.
- Add `packages/contextractor-engine/src/index.test.ts` with vitest tests using one of the source repo's HTML fixtures (the `step-port-tools-tests` step copies them).
- Delete `PYTHON_API_REFERENCE.md` once the port is complete and verified.

## Constraints

- Do not introduce new fields not present in the Python original — mirror only.
- Do not export `xml` / `xmltei` anywhere.
- No `any` in the public API; lean on napi-rs–generated types.

## Done when

- `pnpm -F @contextractor/engine build` succeeds.
- `pnpm -F @contextractor/engine test` passes.
- `grep -ri 'xml\|xmltei' packages/contextractor-engine/src/` returns nothing relevant.
- `PYTHON_API_REFERENCE.md` deleted.
- The matching `tests/step-test-port-engine-to-ts.md` passes.
