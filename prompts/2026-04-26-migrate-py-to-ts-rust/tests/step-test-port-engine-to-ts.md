# Test — port-engine-to-ts

## TLDR

Review the diff from `implementation/step-port-engine-to-ts.md`. Verify the TS engine API matches the captured Python API (minus `xml`/`xmltei`), is fully typed, has vitest coverage, and `PYTHON_API_REFERENCE.md` is removed. Auto-fix any deviation.

## Inputs

- `../implementation/step-port-engine-to-ts.md`
- `../user-entry-log/entry-qa-xml-formats.md`
- The pre-deletion content of `PYTHON_API_REFERENCE.md` (read from a previous commit if already removed: `git show HEAD~1:packages/contextractor-engine/PYTHON_API_REFERENCE.md`).

## Review

- `packages/contextractor-engine/src/index.ts` exports `ContentExtractor`, `TrafilaturaConfig`, `OutputFormat`, `DEFAULT_CONFIG`, and the result/metadata types.
- `OutputFormat` union is exactly `'txt' | 'markdown' | 'json' | 'html'`.
- For each Python `TrafilaturaConfig` field, a matching camelCase TS field exists with the same default and type semantics.
- For each Python `ContentExtractor` method, a matching TS method exists with the same logical signature (camelCase).
- No `any` in the public API surface.
- `extractAllFormats` default formats are `['txt', 'markdown', 'json']` (drops `xml`).
- `PYTHON_API_REFERENCE.md` no longer exists.
- Agent: delegate TS-specific review to `ts-pro` (type strictness, JSDoc, narrow types).

## Verify

- `pnpm -F @contextractor/engine build` exits 0.
- `pnpm -F @contextractor/engine test` passes.
- `pnpm -F @contextractor/engine lint` (Biome) exits 0.
- `grep -E '\"xml\"\\|\"xmltei\"' packages/contextractor-engine/src/` returns nothing.
- `test -f packages/contextractor-engine/PYTHON_API_REFERENCE.md` returns non-zero (file absent).

## Auto-fix

If a Python field has no TS counterpart, add it. If a TS field has no Python origin, remove it (mirror-only constraint). Rerun until clean.
