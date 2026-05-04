# sync-gui report — 2026-05-03

## Checks run

- Schema snapshot test (`pnpm --filter @contextractor/schema test`)
- Docs drift (`pnpm docs:update` + `git diff --exit-code -- '**/*.md'`)
- Zod schema ⇄ `input_schema.json`
- Zod schema ⇄ Commander flags
- TS engine (`TrafilaturaConfig`) ⇄ napi-rs binding
- Default values across surfaces
- OutputFormat union coverage
- No-op field regression (`pruneXpath`, `dateExtractionParams`)
- Actor metadata (`actor.json`)
- Workspace deps

---

## Results

### PASS — Schema snapshot test

19/19 vitest tests pass. `toApifyInputSchema(ContextractorInput)` matches `input_schema.json` exactly. No regeneration needed.

### PASS — Docs drift

`pnpm docs:update` produced 0 file updates. `git diff` is clean across all `*.md` files.

### PASS — Zod schema ⇄ `input_schema.json`

All 35 fields in the Zod schema appear in the generated JSON with correct types, defaults, descriptions, and Apify editor metadata.

### PASS — Zod schema ⇄ Commander flags

Every `ContextractorInput` field is reachable either as a direct CLI flag or via `--config` (JSON file). Apify-specific fields (`datasetName`, `keyValueStoreName`, `requestQueueName`, `proxyConfiguration`, `saveExtracted*ToKeyValueStore`) have no direct CLI flag by design; `--config` covers them. The `trafilaturaConfig` shorthands (`--precision`, `--recall`, `--fast`, `--no-links`, `--no-comments`, etc.) are present and mapped through `buildSchemaOverrides`.

Minor gap flagged below: `waitUntil` has a CLI flag and schema mapping but its value is never forwarded to the crawler.

### PASS — TS engine ⇄ napi-rs binding

All 15 `TrafilaturaConfig` fields have a matching `#[napi(object)]` field (snake_case → camelCase via napi-derive):

| TS field | Rust field |
|---|---|
| `fast` | `fast` |
| `favorPrecision` | `favor_precision` |
| `favorRecall` | `favor_recall` |
| `includeComments` | `include_comments` |
| `includeTables` | `include_tables` |
| `includeImages` | `include_images` |
| `includeFormatting` | `include_formatting` |
| `includeLinks` | `include_links` |
| `deduplicate` | `deduplicate` |
| `targetLanguage` | `target_language` |
| `withMetadata` | `with_metadata` |
| `onlyWithMetadata` | `only_with_metadata` |
| `teiValidation` | `tei_validation` |
| `urlBlacklist` | `url_blacklist` |
| `authorBlacklist` | `author_blacklist` |

Three exported functions match: `extract`, `extractMetadata`, `extractAllFormats`.

### PASS — Default values

`DEFAULT_CONFIG` in the TS engine is the ground truth for extraction defaults. The napi-rs struct derives `Default` (all `Option::None`), but the TS layer always passes concrete values via `toNativeConfig`—it never relies on Rust-side defaults. Zod schema defaults govern input parsing independently. No cross-surface disagreement.

### PASS — OutputFormat union

`txt | markdown | json | html` is exact and consistent across:

- TS `OutputFormat` union (`packages/extraction/src/index.ts`)
- Rust `OutputFormat` enum (`packages/extraction/native/src/lib.rs`)
- `FORMAT_EXTENSIONS` record (`packages/crawler/src/sinks/file.ts`)
- CLI `SaveFormat` type (superset: adds `jsonl` which is CLI-only, not an extraction format)

`cli.test.ts` asserts `Object.keys(FORMAT_EXTENSIONS).sort()` equals `['html', 'json', 'markdown', 'txt']`. No `xml` or `xmltei` as functional values (only in code comments marking forward-compat placeholders).

### PASS — No-op field regression

`pruneXpath` and `dateExtractionParams` produce zero grep hits across all source `.ts` and `.rs` files.

### PASS — Actor metadata

- `actor.json.name`: `contextractor-test` ✓
- `actor.json.dockerContextDir`: `"../../.."` ✓
- `actor.json.description`: "Crawls websites and extracts main-content text. Built on rs-trafilatura and Crawlee." ✓

### PASS — Workspace deps

Both apps declare `@contextractor/extraction: workspace:*` and `@contextractor/schema: workspace:*`. No `vendor/` directory.

---

## Issues requiring human review

See `autonomous-task-output/sync-gui/prompts/sync-gui-prompt.md` for the actionable prompt.

### Issue 1 — `waitUntil` is schema-wired but never reaches the crawler (Medium)

**Surfaces that have it:**
- Zod schema: `waitUntil: z.enum(['NETWORKIDLE', 'LOAD', 'DOMCONTENTLOADED']).default('LOAD')`
- `input_schema.json`: field present with correct enum
- Standalone CLI: `--wait-until <event>` flag, `WAIT_UNTIL_MAP` in `config.ts`, `CrawlConfig.waitUntil`
- `buildSchemaOverrides` in `cliProgram.ts:223`: maps flag to `out.waitUntil`

**Surfaces that are missing it:**
- `ContextractorCrawlerOptions` (`packages/crawler/src/createCrawler.ts`): no `waitUntil` field
- `createContextractorCrawler` call in `cliProgram.ts` (action handler): `waitUntil` from `cfg` is not passed
- `buildCrawlerOpts` in `apps/apify-actor/src/config.ts`: not returned

**Effect:** The `waitUntil` setting has zero runtime effect in both the standalone CLI and the Apify Actor. Users who set `--wait-until networkidle` will not see the browser wait for network idle.

**Options:**
- Add `waitUntil?: 'networkidle' | 'load' | 'domcontentloaded'` to `ContextractorCrawlerOptions`, pass through to Playwright's `page.goto()` options in the handler.
- Or remove the field from the schema and CLI to match the actual capability.

### Issue 2 — `proxyRotation` and `proxyUrls` are dead in the standalone CLI (Low)

**What exists:** `--proxy-rotation <strategy>` and `--proxy-urls <urls>` flags are in `cliProgram.ts`, parsed correctly, and stored in `CliOnlyOverrides`. They are not passed to `createContextractorCrawler` (which only accepts a full `proxyConfiguration: ProxyConfiguration` object from Crawlee/Apify).

**Effect:** Both flags are silently ignored. The standalone CLI has no working proxy support.

**Options:**
- Remove `--proxy-urls` and `--proxy-rotation` from the standalone CLI (and its documentation) to avoid misleading users.
- Or implement proxy support using Crawlee's `ProxyConfiguration.newWithTieredProxyUrls()` or similar — then also add `proxyConfiguration` to `ContextractorCrawlerOptions`.

### Issue 3 — `html` format not available as an Apify Actor output (Informational)

The engine supports `html` as an `OutputFormat` and the standalone CLI supports `--save html`. The Apify Actor has no `saveExtractedHtmlToKeyValueStore` input field; `buildCrawlerOpts` never pushes `html` to `formats`; `FORMAT_SPECS` in `apps/apify-actor/src/sinks.ts` has no html entry.

This is internally consistent (the schema doesn't promise it), but users migrating from the standalone CLI to the Apify Actor will find `html` output unavailable.

**Options:** Add `saveExtractedHtmlToKeyValueStore: z.boolean().default(false)` to the schema and wire it through `buildCrawlerOpts` and `FORMAT_SPECS`. Or document the gap explicitly.

---

## Auto-fixes applied

None. All automatically fixable checks (schema snapshot, docs regions) were already clean.
