# sync-gui consistency report — 2026-05-12

All surfaces are internally consistent. No auto-fixes were applied. No issues require human review.

## Surfaces checked

- Zod schema (canonical) — `packages/schema/src/source-of-truth/input.ts`
- Generated INPUT_SCHEMA — `apps/apify-actor/.actor/input_schema.json`
- TS engine (canonical) — `packages/extraction/src/index.ts`
- napi-rs binding — `packages/extraction/native/src/lib.rs`
- Standalone CLI — `apps/standalone/src/cliProgram.ts`, `apps/standalone/src/config.ts`
- Apify Actor — `apps/apify-actor/src/{main,run,extraction,sinks,config}.ts`
- Actor metadata — `apps/apify-actor/.actor/actor.json`

---

## Check results

### Zod schema ⇄ generated INPUT_SCHEMA.json

**PASS** — `pnpm --filter @contextractor/schema test` ran all 79 tests green.  
The snapshot test at `packages/schema/test/to-apify-schema.test.ts:39` compares `toApifyInputSchema(ContextractorInput, { title: 'Contextractor' })` with the on-disk JSON byte-for-byte; it passed, so the generated file is in sync with the Zod schema.

### Zod schema ⇄ Commander program

**PASS** — All 38 `ContextractorInput` fields are reachable from the CLI:

| Field | CLI surface |
|---|---|
| `startUrls` | positional args, `--start-url`, or via `--config` |
| `crawlerType` | `--crawler-type` |
| `renderingTypeDetectionPercentage` | `--rendering-detection-pct` |
| `globs` | `--globs` |
| `excludes` | `--excludes` |
| `pseudoUrls` | via `--config` JSON (no flag; Apify-specific legacy) |
| `linkSelector` | `--link-selector` |
| `keepUrlFragments` | `--keep-url-fragments` |
| `useSitemaps` | `--use-sitemaps` |
| `ignoreCanonicalUrl` | `--ignore-canonical-url` |
| `respectRobotsTxtFile` | `--respect-robots-txt` |
| `initialCookies` | `--cookies` |
| `customHttpHeaders` | `--headers` |
| `maxPagesPerCrawl` | `--max-pages` |
| `maxResultsPerCrawl` | `--max-results` |
| `maxCrawlingDepth` | `--crawl-depth` |
| `initialConcurrency` | `--initial-concurrency` |
| `maxConcurrency` | `--max-concurrency` |
| `maxRequestRetries` | `--max-retries` |
| `trafilaturaConfig` | `--fast`, `--precision`, `--recall`, `--no-links`, `--no-comments`, `--include-tables`, `--no-tables`, `--include-images`, `--include-formatting`, `--no-formatting`, `--deduplicate`, `--target-language`, `--with-metadata`, `--no-metadata` |
| `save` | `--save` |
| `saveDestination` | `--save-destination` |
| `datasetName` | `--dataset` (extract subcommand only) |
| `keyValueStoreName` | via `--config` JSON |
| `requestQueueName` | via `--config` JSON |
| `storeSkippedUrls` | `--store-skipped-urls` |
| `proxyConfiguration` | via `--config` JSON (Apify platform only) |
| `proxyRotation` | `--proxy-rotation` |
| `pageLoadTimeoutSecs` | `--page-load-timeout` |
| `blockMedia` | `--block-media` / `--no-block-media` |
| `waitForSelector` | `--wait-for-selector` |
| `softWaitForSelector` | `--soft-wait-for-selector` |
| `dynamicContentWaitSecs` | `--dynamic-content-wait` |
| `waitUntil` | `--wait-until` |
| `headless` | `--headless` / `--no-headless` |
| `ignoreCorsAndCsp` | `--ignore-cors` |
| `closeCookieModals` | `--close-cookie-modals` |
| `maxScrollHeightPixels` | `--max-scroll-height` |
| `userAgent` | `--user-agent` |
| `ignoreSslErrors` | `--ignore-ssl-errors` |
| `debugLog` | `--verbose` sets `process.env.LOG_LEVEL = 'DEBUG'` (intentional alias) |
| `browserLog` | via `--config` JSON (Actor debug feature) |

### docs:update

**PASS** — `pnpm docs:update` reported 0 file(s) updated; no markdown drift.

### TS engine ⇄ napi-rs binding

**PASS** — All 13 `TrafilaturaConfig` fields in `index.ts` have matching `#[napi(object)]` fields in `lib.rs` (snake_case auto-converted to camelCase by napi-derive):

| TS (`TrafilaturaConfig`) | Rust (`TrafilaturaConfig`) |
|---|---|
| `fast` | `fast: Option<bool>` |
| `favorPrecision` | `favor_precision: Option<bool>` |
| `favorRecall` | `favor_recall: Option<bool>` |
| `includeComments` | `include_comments: Option<bool>` |
| `includeTables` | `include_tables: Option<bool>` |
| `includeImages` | `include_images: Option<bool>` |
| `includeFormatting` | `include_formatting: Option<bool>` |
| `includeLinks` | `include_links: Option<bool>` |
| `deduplicate` | `deduplicate: Option<bool>` |
| `targetLanguage` | `target_language: Option<String>` |
| `withMetadata` | `with_metadata: Option<bool>` (forward-compat, ignored) |
| `onlyWithMetadata` | `only_with_metadata: Option<bool>` |
| `teiValidation` | `tei_validation: Option<bool>` (forward-compat, ignored) |

Function signatures match: `extract` / `extract_metadata` / `extract_all_formats`.  
`Metadata` struct matches `Metadata` interface (including `page_type` → `pageType` camelCase auto-conversion).

### Default values

**PASS** — Defaults are consistent across surfaces:

| Field | DEFAULT_CONFIG (TS) | Rust default | Zod `.default()` | input_schema.json `default` |
|---|---|---|---|---|
| `fast` | `false` | `None` (not forwarded) | — | — |
| `favorPrecision` | `false` | `None` | — | — |
| `includeComments` | `true` | `None` (rs-trafilatura default) | — | — |
| `headless` | — | — | `true` | `true` |
| `crawlerType` | — | — | `'playwright:adaptive'` | `"playwright:adaptive"` |
| `maxConcurrency` | — | — | `50` | `50` |
| `closeCookieModals` | — | — | `true` | `true` |
| `maxScrollHeightPixels` | — | — | `5000` | `5000` |
| `save` | — | — | `['markdown']` | `["markdown"]` |

### OutputFormat union

**PASS** — `txt | markdown | json | html` on all four surfaces. No `xml` or `xmltei` anywhere in the codebase.

### No-op fields

**PASS** — `pruneXpath` and `dateExtractionParams` are absent from all files.

### Actor metadata

**PASS**:
- `name`: `"contextractor-test"` (correct for test deploys)
- `dockerContextDir`: `"../../.."` ✓
- `description`: `"Crawls websites and extracts main-content text. Built on rs-trafilatura and Crawlee."` ✓

### Workspace deps

**PASS** — Both apps declare `workspace:*` for all three internal packages:
- `"@contextractor/crawler": "workspace:*"`
- `"@contextractor/extraction": "workspace:*"`
- `"@contextractor/schema": "workspace:*"`

---

## Auto-fixes applied

None — all surfaces were in sync.

## Issues requiring human review

None.
