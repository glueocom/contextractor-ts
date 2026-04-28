# Step port-engine-to-ts

## TLDR

Implement `packages/contextractor-engine/src/index.ts` mirroring the Python `ContentExtractor` / `TrafilaturaConfig` API. The TS engine wraps the napi-rs binding from `step-build-napi-binding`. Drop `xml`, `xmltei`, `pruneXpath`, `dateExtractionParams`. Add vitest tests against the source repo's HTML fixtures.

## Skills and Agents

- Agents: `ts-pro`, then `code-reviewer`.

## Reference reading

- `packages/contextractor-engine/PYTHON_API_REFERENCE.md` (created in `step-build-napi-binding`).
- `../migrate-py-to-ts-rust-v2-notes/rs-trafilatura-0.2.md` (mapping table; metadata superset).
- `../user-entry-log/entry-qa-config-field-scope.md` (drop only `pruneXpath` and `dateExtractionParams`; keep `teiValidation` and `withMetadata`).
- `../user-entry-log/entry-initial-prompt.md` ("XML and XML-TEI temporarily unsupported pending upstream `rs-trafilatura` work").
- Source: `/Users/miroslavsekera/r/contextractor/packages/contextractor_engine/src/contextractor_engine/{__init__.py, models.py, extractor.py, utils.py}`.

## Actions

### Package skeleton

- `packages/contextractor-engine/package.json`:
  - `"name": "@contextractor/engine"`.
  - `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"`.
  - `"scripts"`: `build` runs `tsc -p tsconfig.json`; `test` runs `vitest run`; `lint` runs `biome check .`.
  - Deps: `"@contextractor/engine-native": "workspace:*"`. Dev deps: `vitest`, `typescript`, `@types/node`.
- `packages/contextractor-engine/tsconfig.json` extends the root config; `outDir: "dist"`, `rootDir: "src"`.

### TS API surface

- `OutputFormat = 'txt' | 'markdown' | 'json' | 'html'`.
- `interface TrafilaturaConfig` with camelCase fields mirroring `models.py:TrafilaturaConfig`, except:
  - **Drop:** `pruneXpath`, `dateExtractionParams`.
  - **Keep:** every other field, including `teiValidation` and `withMetadata` (forward-compat placeholders accepted by the napi-rs binding but not forwarded into rs-trafilatura).
- `const DEFAULT_CONFIG: Readonly<TrafilaturaConfig>` exported from the index, frozen, with the same defaults as `models.py:TrafilaturaConfig.__init__`.
- `interface ExtractionResult { content: string; format: OutputFormat }`.
- `interface Metadata` with the **superset** of fields rs-trafilatura returns: `title`, `author`, `date`, `description`, `sitename`, `language`, `categories?`, `tags?`, `license?`, `image?`, `pageType?`. Document the categories/tags/license/image/pageType fields as "rs-trafilatura-only — not present in the Python source".
- `class ContentExtractor`:
  - `constructor(config?: Partial<TrafilaturaConfig>)` — merges over `DEFAULT_CONFIG`.
  - `extract(html: string, opts: { url?: string; format: OutputFormat }): ExtractionResult` — delegates to `native.extract`.
  - `extractMetadata(html: string, url?: string): Metadata` — delegates to `native.extractMetadata`.
  - `extractAllFormats(html: string, opts?: { url?: string; formats?: OutputFormat[] }): Record<OutputFormat, ExtractionResult>` — defaults to `['txt', 'markdown', 'json', 'html']` (drops `xml` from the Python default).
- Re-export `Metadata`, `ExtractionResult`, `OutputFormat`, `TrafilaturaConfig`, `DEFAULT_CONFIG` so consumers do not import the native package directly.
- Add JSDoc on every public symbol. Reference the Python source field on each interface field for traceability.

### Tests

- `packages/contextractor-engine/src/index.test.ts` (vitest) using one or two HTML fixtures from `tools/generated-unit-tests/fixtures/` (these are copied in `step-port-tools-tests` — coordinate so this step can run after the fixtures land, or use a small HTML literal for now and cross-link).
- Tests:
  - `extract` returns non-empty `content` for each `OutputFormat`.
  - `extractMetadata` returns metadata with at least `title` populated for a fixture with a `<title>` tag.
  - `extractAllFormats` returns exactly the four formats `txt | markdown | json | html`.
  - Construct with a partial config and verify the merged values via behavior (e.g. `includeComments: false` actually drops a comment node).
- Metadata title assertions match a regex / substring, not exact strings (rs-trafilatura's heuristic differs from Python — see `rs-trafilatura-0.2.md`).

### Cleanup

- Delete `packages/contextractor-engine/PYTHON_API_REFERENCE.md` once the port lands and tests pass.

## Constraints

- No `any` in the public API; lean on the napi-rs–generated types.
- Do not export `xml` / `xmltei` anywhere.
- Do not introduce new public fields beyond what the Python source had **plus** the rs-trafilatura metadata superset; keep the surface tight.
- Do not change `tsconfig.json` to enable `exactOptionalPropertyTypes` — incompatible with napi-rs (see `napi-rs-monorepo-prebuilds.md`).

## Done when

- `npm run build -w @contextractor/engine` succeeds.
- `npm run test -w @contextractor/engine` passes.
- `grep -ri 'xml\|xmltei\|pruneXpath\|dateExtractionParams' packages/contextractor-engine/src/` returns nothing.
- `PYTHON_API_REFERENCE.md` deleted.
- `packages/contextractor-engine/dist/index.d.ts` exposes the documented surface (no `any`).
- The matching `../tests/step-test-port-engine-to-ts.md` passes.
