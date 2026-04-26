# Test step port-engine-to-ts

## TLDR

Reviews `../implementation/step-port-engine-to-ts.md`. Verifies the TS engine API surface mirrors the Python original (minus dropped fields), builds, tests, and exports no `any`.

## Inputs

- `../implementation/step-port-engine-to-ts.md`.
- `../user-entry-log/entry-qa-config-field-scope.md`.
- `../migrate-py-to-ts-rust-v2-notes/rs-trafilatura-0.2.md`.

## Verification

- `pnpm -F @contextractor/engine build` succeeds. `dist/index.d.ts` exposes `ContentExtractor`, `TrafilaturaConfig`, `DEFAULT_CONFIG`, `OutputFormat`, `Metadata`, `ExtractionResult`.
- `OutputFormat` is exactly `'txt' | 'markdown' | 'json' | 'html'`.
- `TrafilaturaConfig` fields: every Python field except `pruneXpath` and `dateExtractionParams`. `teiValidation` and `withMetadata` are present.
- `DEFAULT_CONFIG` is exported as `Readonly<TrafilaturaConfig>`.
- `Metadata` interface includes `categories?`, `tags?`, `license?`, `image?`, `pageType?` (the rs-trafilatura superset).
- `pnpm -F @contextractor/engine test` passes. Tests assert metadata via regex/substring (not exact equality) per the rs-trafilatura title pitfall.
- `grep -ri 'xml\|xmltei\|pruneXpath\|dateExtractionParams' packages/contextractor-engine/src/` returns nothing.
- `grep -ri ': any\b\|<any>' packages/contextractor-engine/src/index.ts` returns nothing in public exports.
- `PYTHON_API_REFERENCE.md` is deleted.

## Auto-fix examples

- Missing field in `TrafilaturaConfig` — add it with the Python default.
- Public type uses `any` — replace with the napi-rs-generated type or a derived alias.
- Test asserts exact title — change to regex/substring.
- `xml` enum value found — remove it; rerun build.

## Done when

The engine builds, tests, and the public surface matches the documented shape.
