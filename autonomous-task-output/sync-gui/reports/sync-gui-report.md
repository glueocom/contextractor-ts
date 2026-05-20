# sync-gui Report

**Date**: 2026-05-20  
**Status**: All checks pass — no inconsistencies found, no auto-fixes required.

## Surfaces Audited

| Surface | File |
|---|---|
| Zod input schema (canonical) | `packages/schema/src/source-of-truth/input.ts` |
| Generated INPUT_SCHEMA.json | `apps/apify-actor/.actor/input_schema.json` |
| TS engine | `packages/extraction/src/index.ts` |
| napi-rs binding | `packages/extraction/native/src/lib.rs` |
| Standalone CLI | `apps/standalone/src/cliProgram.ts`, `config.ts` |
| Apify Actor TS | `apps/apify-actor/src/{main.ts,run.ts,extraction.ts,sinks.ts,config.ts}` |
| Actor metadata | `apps/apify-actor/.actor/actor.json` |

---

## Check Results

### Zod schema ⇄ INPUT_SCHEMA.json

**PASS** — Snapshot test at `packages/schema/test/to-apify-schema.test.ts:39-43` confirms byte-identical match between `toApifyInputSchema(ContextractorInput)` and the on-disk JSON. All 85 schema tests pass.

Command run: `pnpm --filter @contextractor/schema test`

### Zod schema ⇄ Commander program

**PASS** — Every `ContextractorInput` field is reachable via a CLI flag or via JSON config (`--config`). Mapping:

| Zod field | CLI flag | Notes |
|---|---|---|
| `startUrls` | positional `[urls...]` + `--input-file` | |
| `crawlerType` | `--crawler-type` | |
| `renderingTypeDetectionPercentage` | `--rendering-detection-pct` | |
| `globs` | `--glob` (repeatable) | |
| `excludes` | `--exclude` (repeatable) | |
| `linkSelector` | `--link-selector` | |
| `keepUrlFragments` | `--keep-url-fragments` | |
| `useSitemaps` | `--use-sitemaps` | |
| `deduplication` | `--deduplication` | |
| `respectRobotsTxtFile` | `--respect-robots-txt` | |
| `initialCookies` | `--cookies` (JSON array) | |
| `customHttpHeaders` | `--headers` (JSON object) | |
| `maxPagesPerCrawl` | `--max-pages` | |
| `maxResultsPerCrawl` | `--max-results` | |
| `maxCrawlingDepth` | `--crawl-depth` | |
| `initialConcurrency` | `--initial-concurrency` | |
| `maxConcurrency` | `--max-concurrency` | |
| `maxRequestRetries` | `--max-retries` | |
| `mode` | `--mode` | |
| `includeComments` | `--no-comments` | Commander boolean negation |
| `includeTables` | `--no-tables` | Commander boolean negation |
| `includeImages` | `--images` / `--no-images` | |
| `includeLinks` | `--no-links` | Commander boolean negation |
| `targetLanguage` | `--target-language` | |
| `save` | `--save` (repeatable) | |
| `saveDestination` | `--save-destination` (repeatable) | |
| `datasetName` | `--dataset` (extract subcommand) | |
| `keyValueStoreName` | JSON config only | intentional — storage routing |
| `requestQueueName` | JSON config only | intentional — storage routing |
| `storeSkippedUrls` | `--store-skipped-urls` | |
| `proxyConfiguration` | JSON config only | Apify Platform-specific |
| `proxyRotation` | `--proxy-rotation` | |
| `tieredProxyUrls` | JSON config only | complex structured data |
| `tieredProxyConfig` | JSON config only | complex structured data |
| `sessionPoolName` | `--session-pool-name` | |
| `maxSessionRotations` | `--max-session-rotations` | |
| `pageLoadTimeoutSecs` | `--page-load-timeout` | |
| `blockMedia` | `--block-media` / `--no-block-media` | |
| `waitForSelector` | `--wait-for-selector` | |
| `softWaitForSelector` | `--soft-wait-for-selector` | |
| `dynamicContentWaitSecs` | `--dynamic-content-wait` | |
| `waitUntil` | `--wait-until` | |
| `headless` | `--headless` / `--no-headless` | |
| `ignoreCorsAndCsp` | `--ignore-cors` | |
| `closeCookieModals` | `--close-cookie-modals` | |
| `maxScrollHeightPixels` | `--max-scroll-height` | |
| `userAgent` | `--user-agent` | |
| `ignoreSslErrors` | `--ignore-ssl-errors` | |

Fields only accessible via `--config` JSON (`keyValueStoreName`, `requestQueueName`, `proxyConfiguration`, `tieredProxyUrls`, `tieredProxyConfig`) are intentionally omitted from CLI flags — complex or platform-specific fields that are better expressed as config.

### docs:check

**PASS** — `pnpm docs:update` produced 0 file updates. `git diff --exit-code -- '**/*.md'` exited 0.

### TS engine ⇄ napi-rs binding

**PASS** — All 13 `TrafilaturaConfig` fields present in the TS interface have a corresponding `#[napi(object)]` field in the Rust struct (snake_case auto-converts to camelCase via napi-derive):

| TS field | Rust field | Type |
|---|---|---|
| `fast` | `fast` | `bool` |
| `favorPrecision` | `favor_precision` | `bool` |
| `favorRecall` | `favor_recall` | `bool` |
| `includeComments` | `include_comments` | `bool` |
| `includeTables` | `include_tables` | `bool` |
| `includeImages` | `include_images` | `bool` |
| `includeFormatting` | `include_formatting` | `bool` |
| `includeLinks` | `include_links` | `bool` |
| `deduplicate` | `deduplicate` | `bool` |
| `targetLanguage` | `target_language` | `String` |
| `withMetadata` | `with_metadata` | `bool` (forward-compat, ignored) |
| `onlyWithMetadata` | `only_with_metadata` | `bool` |
| `teiValidation` | `tei_validation` | `bool` (forward-compat, ignored) |

Function signatures match:
- `extract(html, options?)` → `extract(html: String, options: Option<ExtractOptions>)` ✓
- `extractMetadata(html, url?)` → `extract_metadata(html: String, url: Option<String>)` ✓
- `extractAllFormats(html, options?)` → `extract_all_formats(html: String, options: Option<ExtractOptions>)` ✓

### Default values

**PASS** — Extraction-related field defaults agree across surfaces:

| Field | Zod schema | TS engine DEFAULT_CONFIG |
|---|---|---|
| `includeComments` | `true` | `true` ✓ |
| `includeTables` | `true` | `true` ✓ |
| `includeImages` | `false` | `false` ✓ |
| `includeLinks` | `true` | `true` ✓ |
| `targetLanguage` | `''` (empty = none) | `null` (null = none) ✓ |

`targetLanguage: ''` (Zod) vs `null` (engine) are semantically equivalent empty representations at different layers — both mean "no language filter". No action required.

`includeFormatting: true` in the engine has no corresponding Zod schema field (it is an internal rs-trafilatura option, not exposed to users). No action required.

The napi-rs `TrafilaturaConfig` uses `Option<T>` (all fields default to `None`). The TS engine always passes explicit values via `toNativeConfig()`, so rs-trafilatura's own C-level defaults are never used. Internally consistent.

### OutputFormat union

**PASS** — All surfaces use exactly `txt | markdown | json | html`:

- TS engine: `export type OutputFormat = 'txt' | 'markdown' | 'json' | 'html'` ✓
- Rust: `OutputFormat { Txt, Markdown, Json, Html }` mapping to `"txt"`, `"markdown"`, `"json"`, `"html"` ✓
- CLI `SaveFormat`: `'markdown' | 'html' | 'txt' | 'json' | 'original'` — `original` is a CLI-only save concept (raw HTML), not an engine format ✓
- No `xml` or `xmltei` anywhere ✓

### No-op fields

**PASS** — `pruneXpath` and `dateExtractionParams` absent from all surfaces (Zod schema, napi-rs, TS engine, CLI, Actor). ✓

### Actor metadata

**PASS**:
- `actor.json.name` = `contextractor-test` ✓ (correct test target)
- `actor.json.dockerContextDir` = `"../../.."` ✓
- `actor.json.description` = `"Crawls websites and extracts main-content text. Built on rs-trafilatura and Crawlee."` ✓

### Workspace deps

**PASS** — Both apps declare workspace deps correctly:

| App | `@contextractor/extraction` | `@contextractor/schema` |
|---|---|---|
| `@contextractor/standalone` | `workspace:*` ✓ | `workspace:*` ✓ |
| `@contextractor/apify` | `workspace:*` ✓ | `workspace:*` ✓ |

No `vendor/` directory. ✓

---

## Auto-fixes Applied

None — all surfaces were internally consistent.

## Issues Requiring Human Review

None.
