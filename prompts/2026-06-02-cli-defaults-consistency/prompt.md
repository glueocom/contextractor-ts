> **TLDR**: Make the contextractor CLI, lib, and Apify Actor consistent and clean, and align crawler-layer parameter names with **Crawlee** (the framework underneath) — the source of truth. Rename schema keys deep through the Zod source of truth to match Crawlee's option names (incl. two semantic changes: `maxRequestsPerCrawl` final-page-counting and `renderingTypeDetectionRatio` 0–1), plus the locked extraction/clarity renames; expose the full storage-name trio as flags; delete the low-value `list`/`get`/`kvs`/`storage-dir` subcommands and add a real `export` command that writes stored content to a user output directory; rename the published package to `contextractor`; purge stale docs (deduplication enum, tiered proxy, `--save jsonl`, redundant default flags); then rebuild, regenerate `@generated` docs + the Apify input schema, sync all SPECs, deep-test, and autofix until green.

## Context

`contextractor-ts` is the **single source of truth**. The Zod schema `packages/schema/src/source-of-truth/input.ts` is PRIMARY; the standalone CLI, the library API, and the Apify Actor are all DERIVED from it and must differ only where a surface intrinsically requires it (kebab-case CLI flags vs camelCase schema keys, how start URLs are supplied, platform-managed vs local storage). A deep rename therefore propagates to all three surfaces.

This repo's prompt runs **FIRST**. A companion prompt in the `tools` repo (the website is a synced replica) runs AFTER this is complete, built, and `docs:update`-clean — never the reverse.

This is a breaking change for existing Apify input (renamed schema keys / Actor input fields). That is acceptable.

## Skills and Agents

- `ts-pro` — TypeScript edits to the Zod schema, CLI, config, crawler, sinks
- `apify-schemas` — `gen-input-schema` tooling and `.actor/*.json` regeneration
- `test-runner` — full build, lint, unit + integration tests, smoke run

## Rules in force

- `.claude/rules/native-addon-boundary.md` — extraction-param renames STOP at the TypeScript boundary
- `.claude/rules/spec-maintenance.md`, `.claude/rules/test-maintenance.md` — update SPECs and tests in the same change
- `.claude/rules/minimal-diff.md` — surgical edits; `.claude/rules/preserve-todos.md`
- `.claude/rules/json-config-only.md` — docs reference JSON config only
- Commit messages must NOT mention Claude or add a `Co-Authored-By` footer

## Locked decisions

- **Naming authority — Crawlee FIRST**: contextractor is built on [Crawlee](https://crawlee.dev/) (JS), so Crawlee's option names are the PRIMARY authority for crawler-layer schema keys and library-object property names. Match Crawlee's exact option name wherever Crawlee has a real equivalent — including its generic names and its semantics (see the resolved forks below). For extraction-layer params use the trafilatura/extraction wrapper as the authority; WCC and clig.dev are only tertiary inspiration where neither Crawlee nor the extraction layer applies. The full mapping is in Step CRAWLEE-ALIGN.
- **The Zod schema is not yet shipped**: its keys are being defined now and are freely changeable. Existing Apify input compatibility is explicitly NOT a constraint — the break is accepted. This is why we can adopt Crawlee names (and semantics) directly.
- **Resolved naming forks (locked)**:
  - **Adopt Crawlee's generic names**: `includeUrlGlobs` → `globs`, `excludeUrlGlobs` → `exclude`, `linkSelector` → `selector` (Crawlee `EnqueueLinksOptions`). This SUPERSEDES the earlier `--include-url-globs`/`--exclude-url-globs` flag plan.
  - **Match Crawlee names AND semantics** for the two divergent fields: `maxCrawlPages` → `maxRequestsPerCrawl` (switch to request-counting: retries/redirects count) and `renderingTypeDetectionPercentage` → `renderingTypeDetectionRatio` (switch input to a 0–1 ratio).
  - **Apply the safe Crawlee renames**: `pageLoadTimeoutSecs` → `navigationTimeoutSecs`, `maxScrollHeightPixels` → `maxScrollHeight`, `keepUrlFragments` → `keepUrlFragment`, `ignoreSslErrors` → `ignoreHttpsErrors`. KEEP `initialConcurrency` (clearer than Crawlee's `desiredConcurrency`).
- **Storage flags**: expose all three. Keep `--dataset` → `datasetName`; ADD `--key-value-store <name>` → `keyValueStoreName` and `--request-queue <name>` → `requestQueueName`. This removes the asymmetric CLI/schema coverage.
- **Extraction / clarity renames (locked; not Crawlee — these are extraction-layer or contextractor concepts)**:
  - `--target-language` → `--language`; schema key `targetLanguage` → `languageCode` (`target-` wrongly implies a translation pair; `languageCode` is the metadata field name already used in output records).
  - `--dynamic-content-wait` → `--wait-for-dynamic-content` (consistent with the `--wait-for-selector` family); schema key `dynamicContentWaitSecs` → `waitForDynamicContentSecs`; CLI placeholder `<seconds>`. (No Crawlee equivalent — WCC-layer concept.)

## Enum-casing convention (do not violate)

Contextractor-owned enum values are kebab-case across schema/CLI/lib/Actor (`deduplication: minimal|standard|aggressive`, `crawlerType: playwright-*`, `proxyRotation: per-request|until-failure`). Exceptions: `waitUntil` stays flat lowercase (verbatim Playwright tokens); foreign Apify constants (proxy groups, `READ`/`WRITE`) stay SCREAMING_SNAKE. `deduplication` uses honest level names — `minimal` (Crawlee's built-in URL dedup only, NOT zero), `standard` (default, + canonical URL), `aggressive` (+ content hash); see `prompts/2026-06-02-cli-defaults-consistency/context/deduplication-naming-review.md` for why the mechanism names `none|url|content-hash` were replaced. See `prompts/2026-05-25-enum-casing-audit`.

---

## Step SCHEMA: Rename keys in the Zod source of truth

File: `packages/schema/src/source-of-truth/input.ts`

Apply ALL of these key renames (see Step CRAWLEE-ALIGN for the rationale per field):

- Crawlee-name renames (key only, value/validation unchanged):
  - `includeUrlGlobs` (≈ lines 66-75) → `globs`
  - `excludeUrlGlobs` (≈ lines 77-86) → `exclude`
  - `linkSelector` (≈ lines 88-95) → `selector`
  - `pageLoadTimeoutSecs` (≈ lines 385-393) → `navigationTimeoutSecs`
  - `maxScrollHeightPixels` (≈ lines 462-472) → `maxScrollHeight` (also drop the `unit: 'pixels'` meta — name no longer carries the unit; keep the `<px>` sense in the description prose)
  - `keepUrlFragments` (≈ lines 97-103) → `keepUrlFragment`
  - `ignoreSslErrors` (≈ lines 485-489) → `ignoreHttpsErrors`
- Crawlee-name renames WITH a semantic/validation change:
  - `maxCrawlPages` (≈ lines 162-169) → `maxRequestsPerCrawl`. Update the description to reflect Crawlee's model: it counts **handled page outcomes** (successes and final failures), not retry attempts. Keep the intent (maximum pages to process) but remove any language implying "retries and redirects count as separate requests." The implementation must pass this straight to Crawlee's `BasicCrawlerOptions.maxRequestsPerCrawl`. Keep `.int().min(0).default(0)` (0 = unlimited).
  - `renderingTypeDetectionPercentage` (≈ lines 56-64) → `renderingTypeDetectionRatio`. Change the Zod type from `z.int().min(0).max(100).default(10)` to `z.number().min(0).max(1).default(0.1)`; drop the `unit: '%'` meta; rewrite the description for a 0–1 ratio. The mapping in `createCrawler` must pass the ratio straight to the adaptive crawler's `renderingTypeDetectionRatio` (remove any `/100` conversion).
- Extraction / clarity renames (key only):
  - `targetLanguage` (≈ lines 256-262) → `languageCode`.
  - `dynamicContentWaitSecs` (≈ lines 419-426) → `waitForDynamicContentSecs`.
- Refresh each renamed field's `meta.title`, description, and `enumTitles` to match the new name — REQUIRED, not optional (the first pass left stale titles like `Page load timeout`/`Target language`/`Max pages` that had to be fixed afterward). Apply: `navigationTimeoutSecs`→`Navigation timeout` (desc "page load"→"page navigation"), `keepUrlFragment`→`Keep URL fragment` (singular), `languageCode`→`Language`, `maxRequestsPerCrawl`→`Max requests per crawl`, `waitForDynamicContentSecs`→`Wait for dynamic content`, `ignoreHttpsErrors`→`Ignore HTTPS errors` (desc "SSL"→"HTTPS"). Keep enum *values* unchanged and kebab-cased per the convention above. A title IS the Apify Console label, so propagate each change to the matching CLI flag help in `cliProgram.ts` (`--navigation-timeout`, `--ignore-https-errors`, …) and to any non-`@generated` README prose that names the old label (see Step STALE-PURGE).

The Apify Actor input field names derive from these keys and will change — that is the intended breaking change.

---

## Step CRAWLEE-ALIGN: Match crawler-layer names to Crawlee

Authority order: **Crawlee** (the framework) for crawler-layer params → extraction wrapper for extraction params → WCC/clig.dev only where neither applies. Names verified against the Crawlee JS API docs (`https://crawlee.dev/js/api/`). For each rename applied, produce a row `old → new | surface(s) | Crawlee interface / rationale` in the commit body.

### Rename to Crawlee's exact option name

- `includeUrlGlobs` → `globs` — Crawlee `EnqueueLinksOptions.globs`.
- `excludeUrlGlobs` → `exclude` — Crawlee `EnqueueLinksOptions.exclude`.
- `linkSelector` → `selector` — Crawlee `EnqueueLinksOptions.selector`.
- `pageLoadTimeoutSecs` → `navigationTimeoutSecs` — Crawlee `BrowserCrawlerOptions.navigationTimeoutSecs`. Note: the current implementation also maps the same value to `requestHandlerTimeoutSecs`; preserve both mappings during the rename.
- `maxScrollHeightPixels` → `maxScrollHeight` — Crawlee `infiniteScroll` `maxScrollHeight` (px).
- `keepUrlFragments` → `keepUrlFragment` — Crawlee `RequestOptions.keepUrlFragment` (singular).
- `ignoreSslErrors` → `ignoreHttpsErrors` — maps to Playwright's `launchOptions.ignoreHTTPSErrors` (Crawlee does not expose this option directly on crawler options, only via launch context).

### Rename to Crawlee's name AND adopt its semantics

- `maxCrawlPages` → `maxRequestsPerCrawl` — Crawlee `BasicCrawlerOptions.maxRequestsPerCrawl`. Counts requests (retries + redirects), not pages. Pass through to Crawlee's native option; update the description.
- `renderingTypeDetectionPercentage` → `renderingTypeDetectionRatio` — Crawlee `AdaptivePlaywrightCrawlerOptions.renderingTypeDetectionRatio`. 0–1 ratio (default `0.1`), not a 0–100 percentage. See the Zod type change in Step SCHEMA.

### Already match Crawlee — keep, do NOT rename

`maxConcurrency`, `maxRequestRetries`, `maxSessionRotations`, `maxCrawlDepth`, `respectRobotsTxtFile`, `proxyConfiguration`, `headless`, `userAgent`, and the `waitUntil` values are Crawlee/Playwright names already. The CLI flag `--crawl-depth` → `--max-crawl-depth` rename for the already-aligned `maxCrawlDepth` key still applies (flag clarity; see Step CLI).

### No Crawlee equivalent — keep contextractor/extraction names

These are WCC-layer, contextractor-orchestration, or extraction (trafilatura) concepts with no Crawlee option, so they keep their current names: `maxResultsPerCrawl`, `waitForDynamicContentSecs` (renamed from `dynamicContentWaitSecs` for the `--wait-for-*` family), `sessionPoolName`, `blockMedia`, `closeCookieModals`, `initialCookies`, `customHttpHeaders`, `ignoreCorsAndCsp` (Crawlee only surfaces CSP via `launchOptions.bypassCSP`, not CORS — keep the accurate combined name), `useSitemaps`, `crawlerType`, `storeSkippedUrls`, `initialConcurrency` (kept over Crawlee's `desiredConcurrency` for clarity), `proxyRotation`, `mode`, `includeComments`/`includeTables`/`includeImages`/`includeLinks`, `languageCode`, `save`, `saveDestination`, `deduplication`, `datasetName`/`keyValueStoreName`/`requestQueueName`, `startUrls`, `waitForSelector`, `softWaitForSelector`.

### Output / dataset record shape — no change

The dataset record shape (`url`, `metadata`, `crawl`, per-format `ContentNode`s) and the Apify dataset/output schemas are contextractor-defined — Crawlee does not dictate dataset item structure. Leave them as-is; the metadata field is already `languageCode`, which matches the renamed input key. The four `.actor/*.json` schemas are regenerated from Zod by `gen-input-schema` (Step BUILD-DOCS), so output-side field names track the input rename automatically where they overlap.

### Considered and rejected (do NOT apply — researched)

- `initialConcurrency` → `desiredConcurrency`: REJECTED (per locked fork) — `initialConcurrency` is clearer to users than Crawlee's autoscaler term.
- `--save` → `--format`: REJECTED. The `save` enum includes `original` (raw source), which is NOT a format — folding a raw passthrough into a format enum is a category error with no precedent in comparable tools (ffmpeg keeps `-c copy` separate from `-f`; yt-dlp keeps `--write-pages` separate from `--format`; trafilatura's `--output-format` has no `original` value). Under the verb `--save`, `original` reads correctly. Keep `--save` and its schema key `save` unchanged.
- `--max-retries` → `--max-request-retries`, `--respect-robots-txt` → `--respect-robots-txt-file`: REJECTED — both add length without clarity; `--max-retries` and `--respect-robots-txt` are the idiomatic CLI forms. (The schema keys `maxRequestRetries` / `respectRobotsTxtFile` already match Crawlee and stay; only the CLI flags keep the short idiomatic spelling.)

---

## Step CLI: Rename flags and add storage flags

Files: `apps/standalone/src/cliProgram.ts`, `apps/standalone/src/config.ts`

- In `addExtractionOptions` (≈ lines 142-284), apply these flag renames (CLI flags are a separate kebab-case surface — they mirror the schema key but keep the short idiomatic CLI spelling where one exists):
  - Crawlee-aligned: `--glob` → `--globs` (→ `globs`); `--link-selector` → `--selector` (→ `selector`); `--max-pages` → `--max-requests-per-crawl` (→ `maxRequestsPerCrawl`); `--page-load-timeout <secs>` → `--navigation-timeout <secs>` (→ `navigationTimeoutSecs`); `--keep-url-fragments` → `--keep-url-fragment` (→ `keepUrlFragment`); `--ignore-ssl-errors` → `--ignore-https-errors` (→ `ignoreHttpsErrors`); `--rendering-detection-pct <n>` → `--rendering-type-detection <ratio>` (→ `renderingTypeDetectionRatio`, 0–1). KEEP `--exclude` (now → `exclude`) and `--max-scroll-height` (now → `maxScrollHeight`) — flag names already fine.
  - Clarity (kept from prior decisions): `--ignore-cors` → `--ignore-cors-and-csp` (→ `ignoreCorsAndCsp`); `--crawl-depth` → `--max-crawl-depth` (→ `maxCrawlDepth`).
  - Extraction: `--target-language <lang>` → `--language <lang>` (→ `languageCode`); `--dynamic-content-wait <seconds>` → `--wait-for-dynamic-content <seconds>` (→ `waitForDynamicContentSecs`).
  - KEEP `--max-retries` and `--respect-robots-txt` (idiomatic CLI spellings; schema keys `maxRequestRetries`/`respectRobotsTxtFile` already match Crawlee).
  - Mind commander's derived prop names: `--globs` → `opts.globs`, `--selector` → `opts.selector`, `--max-requests-per-crawl` → `opts.maxRequestsPerCrawl`, `--navigation-timeout` → `opts.navigationTimeout`, `--keep-url-fragment` → `opts.keepUrlFragment`, `--ignore-https-errors` → `opts.ignoreHttpsErrors`, `--rendering-type-detection` → `opts.renderingTypeDetection`, `--ignore-cors-and-csp` → `opts.ignoreCorsAndCsp`, `--language` → `opts.language`, `--wait-for-dynamic-content` → `opts.waitForDynamicContent`.
- On the `extract` command (and `export`, see below) add the storage trio:
  - keep `--dataset <name>` → `datasetName`,
  - add `--key-value-store <name>` → `keyValueStoreName`,
  - add `--request-queue <name>` → `requestQueueName`.
- Update `buildSchemaOverrides()` (≈ lines 317-404) so each renamed flag prop maps to its renamed schema key (e.g. `opts.globs` → `globs`, `opts.selector` → `selector`, `opts.maxRequestsPerCrawl` → `maxRequestsPerCrawl`, `opts.navigationTimeout` → `navigationTimeoutSecs`, `opts.renderingTypeDetection` → `renderingTypeDetectionRatio`), and the new storage flags map to `keyValueStoreName` / `requestQueueName`.
- Update any commander option types / interfaces (`ExtractOpts`, etc.) for the renames.
- In `apps/standalone/src/config.ts` (`buildCrawlConfig`), update the schema-read sites for every renamed key (`input.globs`, `input.exclude`, `input.selector`, `input.maxRequestsPerCrawl`, `input.navigationTimeoutSecs`, `input.maxScrollHeight`, `input.keepUrlFragment`, `input.ignoreHttpsErrors`, `input.renderingTypeDetectionRatio`, `input.languageCode`, `input.waitForDynamicContentSecs`). Adopt the Crawlee names in the internal crawler-layer config/options too (see Step BOUNDARY) so the mapping to Crawlee is a near pass-through; extraction-layer internals (`targetLanguage` feeding the wrapper) stay per the native boundary.

---

## Step DELETE-SUBCOMMANDS: Remove low-value read/storage subcommands

File: `apps/standalone/src/cliProgram.ts`

- Delete `list` (≈ 659-688), `get` (≈ 693-710), the entire `kvs` group (≈ 715-829), and the `storage-dir` subcommand (≈ 859-866).
- KEEP `extract`, `purge`, the `--storage-dir` FLAG (CLI-only orchestration for Crawlee's internal storage), and the re-exports `Dataset`, `KeyValueStore`, `configureStorage`, `resolveStorageDir` (library consumers still use them).
- Remove now-dead helpers/types/imports left behind (`toCsv`, `ListOpts`, `KvsPutOpts`, unused `readFile`/`path`/MIME map, etc.). Run `npx knip --reporter compact` to confirm nothing dangles.

---

## Step EXPORT: Add a fresh `export` command (mirrored into the lib)

No `export` command ever existed — design it fresh. With the default `saveDestination: ['key-value-store']`, content lives as KVS blobs (`markdown-{md5}.md`, `txt-{md5}.txt`, …), NOT in the dataset. The dataset is the human-readable INDEX: each record has `url`, `metadata` (incl. `title`), `crawl`, and per-format `ContentNode`s (see `packages/crawler/src/sinks/storage.ts`). A node carries either `.content` (inline — dataset destination) or `.key` (KVS destination; the key already embeds the extension).

Add an `export` command to `buildProgram()` and expose its action as a reusable exported helper so the library API can call it too. Put the helper in a new module `apps/standalone/src/exportAction.ts` and re-export it from `apps/standalone/src/index.ts`. The helper is library-callable and must NOT call `process.exit` (the thin CLI `.action` wrapper owns exit/summary).

- Signatures:
  - `export interface ExportOpts { outputDir?: string; dataset?: string; keyValueStore?: string; storageDir?: string }`
  - `export interface ExportResult { outputDir: string; filesWritten: number; recordsTotal: number; manifestPath: string }`
  - `export async function runExportAction(opts: ExportOpts): Promise<ExportResult>`
- Flags: `--output-dir <path>` (default `./contextractor-output`), `--dataset <name>` (default `default`), `--key-value-store <name>` (default `default`), `--storage-dir <path>`. With the default destination, content blobs live in the KVS, so export MUST open it to read `.key` blobs. `--request-queue` is NOT relevant to export (queues hold pending URLs, not content) — omit it.
- Algorithm:
  - `configureStorage(resolveStorageDir(opts.storageDir))`; `outputDir = path.resolve(opts.outputDir ?? './contextractor-output')`; `mkdir(outputDir, { recursive: true })`; `Dataset.open(opts.dataset ?? 'default')`; `KeyValueStore.open(opts.keyValueStore ?? 'default')`.
  - Stream records with `ds.forEach` (memory-safe over large datasets). Only **success** records produce content files; failed/skipped records appear in the manifest only.
  - Derive a readable base name by slugifying `metadata.title` (fallback to a slug of `url.host + url.pathname`, then the literal `page`). No slugify util exists in the repo — add a small inline one (NFKD normalize, strip diacritics, lowercase, non-alnum → `-`, trim hyphens, truncate ≈80 chars).
  - For each content node (`txt|markdown|json|html|original`) present on the item: if `node.content` is set, write it directly; else if `node.key` is set, `getValue(node.key)` from the opened KVS and write the blob; else (neither set, e.g. an unsaved `original` node) skip the file. `getValue` returns `string | Buffer | parsed-object | null` — write a Buffer as bytes, a string as utf8, an object as `JSON.stringify(value, null, 2)` (json blobs come back parsed — must re-serialize), and on `null` warn to stderr and skip. Mirror the branching from the (being-deleted) `kvs get` handler.
  - Extension: reuse the kind → ext map from `packages/crawler/src/sinks/storage.ts` (`KVS_SPECS`: `txt→txt, markdown→md, json→json, html→html, original→html`). Prefer exporting a small `extForKind(kind)` helper from `@contextractor/crawler` over duplicating the map (a test already pins these values — avoid drift).
  - Collisions: process kinds in the fixed order `['markdown','txt','json','html','original']` so the primary format keeps the clean `<slug>.<ext>` name. On collision append a kind tag before the ext (`<slug>.html` vs `<slug>.original.html` — resolves the html/original clash, since both map to `.html`); if still colliding across records, append `-${md5(url).slice(0,8)}`; final fallback `-2`/`-3`. Track a `usedNames` set.
  - Write a `manifest.json` of ALL dataset records (incl. failed/skipped) into `outputDir` via `Dataset.exportToJSON` / `crawler.exportData('<output-dir>/manifest.json')`.
  - Print a concise summary (files written, record count, output dir) to stderr; return `ExportResult`.
- Edge cases: empty dataset → still create `outputDir` and write `manifest.json` `[]`, 0 files, no error; missing/absent dataset → treat as empty; `node.key` blob missing from the KVS → warn + skip, still in manifest.
- `--output-dir` is the user-facing OUTPUT directory; keep it distinct from the internal `--storage-dir` (Crawlee storage, never browsed directly by users). See `prompts/2026-05-19-storage-vs-output-plus-func-comparison`.

This replaces the deleted `kvs`/`list`/`get` read paths.

---

## Step BOUNDARY: Crawler-layer matches Crawlee; extraction-layer stays at the wrapper

Two layers, two authorities. Crawler-layer params (those that flow into Crawlee) adopt Crawlee names through to the library-facing options; extraction-layer params (those that flow into the trafilatura wrapper) keep the wrapper's names per `.claude/rules/native-addon-boundary.md` (reinforced by `prompts/2026-06-01-trafilatura-config-wrapper-isolation`).

- **Crawler-layer (match Crawlee end-to-end)**: adopt the Crawlee names in the library-facing crawler options (`ContextractorCrawlerOptions` in `packages/crawler/src/createCrawler.ts`) and the internal `CrawlConfig`, so passing them to Crawlee is a near pass-through. This includes renaming library-layer fields:
  - `maxCrawlingDepth` → `maxCrawlDepth` (to match Crawlee's `BasicCrawlerOptions.maxCrawlDepth`)
  - `excludes` → `exclude` (plural to singular, to match Crawlee's `EnqueueLinksOptions.exclude`)
  - Any other field names that diverge from their Crawlee counterparts — grep the handler and crawler files for names that conflict.
  - In `createCrawler`, map `renderingTypeDetectionRatio` straight to the adaptive crawler's `renderingTypeDetectionRatio` (remove any `/100` conversion) and `maxRequestsPerCrawl` straight to `BasicCrawlerOptions.maxRequestsPerCrawl`.
- **Extraction-layer (do NOT cross the native edge)**: do NOT touch `packages/extraction/native/src/lib.rs` (keeps `target_language`) or the extraction package's `TrafilaturaConfig` (mirrors upstream `targetLanguage`). For `languageCode`: rename the schema key, the CLI flag, the Apify input field, and the schema→config mapping; the translation to the wrapper stays at the existing point — `toTrafilaturaConfig` in `createCrawler.ts` maps the schema-derived option to `TrafilaturaConfig.targetLanguage`; `toNativeConfig` in `packages/extraction/src/index.ts` is untouched.

---

## Step STALE-PURGE: Remove stale docs and stale flag usage

- `apps/standalone/SPEC.md` (≈ line 37): keep the `--deduplication` doc in sync with the schema: `minimal | standard | aggressive` (default `standard`).
- `examples/cli-npm/run.sh`: rewrite so it no longer calls the deleted `list`/`get`/`kvs`/`storage-dir` subcommands. Replace the read demos with an `export` demo. Fix every renamed flag it uses — `--rendering-detection-pct` → `--rendering-type-detection` (value now 0–1), `--dynamic-content-wait` → `--wait-for-dynamic-content`, `--target-language` → `--language` (if shown), `--max-pages` → `--max-requests-per-crawl`, and any other flag in the Step CRAWLEE-ALIGN set (`--save` is UNCHANGED). Replace stale `--ignore-canonical-url` with `--deduplication minimal`. Remove the redundant default `--save-destination key-value-store` line (keep only non-default destination demos). Update the header comment package name to `contextractor`.
- `examples/library-ts/src/main.ts`: fix `--dynamic-content-wait` → `--wait-for-dynamic-content`, `--ignore-canonical-url` → `--deduplication minimal`, and the import path (see PACKAGE-RENAME). The `Dataset`/`KeyValueStore` read-back stays valid.
- `apps/apify-actor/README.md` hand-written prose: the FAQ and feature bullets live OUTSIDE the `@generated` regions, so `pnpm docs:update` will NOT fix them. Update the "How do I remove duplicate pages?" FAQ to the new dedup values (`standard`/`aggressive`/`minimal` — never the old `url`/`content-hash`), and sync any UI-label references to the refreshed field titles (`Dynamic content wait` → `Wait for dynamic content`, `Max crawl pages` → `Max requests per crawl`).
- Tiered proxy (removed in `prompts/2026-05-26-drop-tiered-proxy`): purge `tieredProxyUrls`/`tieredProxyConfig` references from `tools/proxy-rotation-tester/README.md`, `tools/proxy-rotation-tester/src/lib.test.ts`, and `.claude/commands/proxy-test.md`.
- Removed `--save jsonl` format (dropped in `prompts/2026-05-12-remove-jsonl-saving`): purge from `.claude/commands/autonomous/maintenance/sync/docs.md`. Since the `list` subcommand is now deleted, the `list --format jsonl` carve-out in that doc is also moot — remove it.

---

## Step PACKAGE-RENAME: `@contextractor/standalone` → `contextractor`

The published npm package should be `contextractor` (verify ownership at https://www.npmjs.com/package/contextractor before starting); the workspace package name is currently wrong at `@contextractor/standalone`.

- `apps/standalone/package.json`: set `"name": "contextractor"`, remove `"private": true`, keep `version` and `bin.contextractor`.
- Update every internal reference:
  - root `SPEC.md` (≈ line 10),
  - `apps/standalone/README.md` (heading line 1, prose ≈ line 102),
  - `apps/standalone/SPEC.md` (≈ line 102),
  - `tools/gen-md-regions/package.json` (dep key, ≈ line 19) and `tools/gen-md-regions/src/emitters/cli-flags.ts` import (line 1),
  - `examples/library-ts/package.json` (dep key, ≈ line 11) and `examples/library-ts/src/main.ts` import (lines 1-7),
  - `dev-utils/installation/lib/pkg.ts` (`STANDALONE_PKG`, ≈ line 14).
- Workspace dep entries are keyed by package name — update the KEY to `contextractor` while keeping `workspace:*` / `file:` values.

---

## Step BUILD-DOCS: Rebuild and regenerate generated docs + schema

A full build must run first because `gen-md-regions` imports the built CLI.

```bash
pnpm build
pnpm docs:update
```

- Confirm the `@generated` regions in `apps/standalone/README.md` (`cli-flags`, `enum-values`) reflect the renamed flags and the new storage/export flags.
- Confirm `apps/apify-actor/.actor/input_schema.json` (and the Actor README `@generated` regions) show the Crawlee-aligned keys (`globs`, `exclude`, `selector`, `maxRequestsPerCrawl`, `renderingTypeDetectionRatio`, `navigationTimeoutSecs`, `maxScrollHeight`, `keepUrlFragment`, `ignoreHttpsErrors`) plus `languageCode` / `waitForDynamicContentSecs` — and NO old keys.
- A second `pnpm docs:update` must leave NO diff.

---

## Step SPEC-SYNC: Sync all SPEC.md files to the new reality

Update only affected sections (`minimal-diff`):

- root `SPEC.md` — package name, brief surface description.
- `apps/standalone/SPEC.md` — renamed flags, deleted subcommands, new `export` command, new storage flags, corrected `--deduplication` values, package name.
- `apps/apify-actor/SPEC.md` — renamed Actor input fields (Crawlee-aligned keys). Also grep the SPEC *prose* for stale code identifiers, not just field tables — e.g. `excludes` → `exclude` (singular) in the sitemap-filtering sentence.
- `packages/schema/SPEC.md` — renamed keys (Crawlee alignment + the two semantic changes).
- `packages/crawler/SPEC.md` — update the library-facing crawler options (`ContextractorCrawlerOptions`) to the Crawlee-aligned names. Keep the `deduplication` type in sync with the code: it is `'minimal' | 'standard' | 'aggressive'` (default `'standard'`) per the dedup-naming decision (see `createCrawler.ts` and `handler.ts`) — never the older `'minimal' | 'basic' | 'full'` nor the interim `'none' | 'url' | 'content-hash'`.

---

## Step TESTS: Add/update tests in the same change

Per `.claude/rules/test-maintenance.md` (`apps/standalone/src/*.test.ts`):

- Add tests for the new `export` command: KVS-blob path (default destination) and inline `content` path (dataset destination), readable filename derivation, manifest emission, collision handling (`html` vs `original` → `.html`), and the empty-dataset case.
- Update flag tests for all renames (the Step CRAWLEE-ALIGN set + the extraction/clarity renames) plus the new storage flags (`--key-value-store`, `--request-queue`).
- Add/adjust tests for the two semantic changes: `renderingTypeDetectionRatio` accepts a 0–1 value (and rejects >1) and `maxRequestsPerCrawl` maps to Crawlee's request count.
- Remove tests for the deleted `list`/`get`/`kvs`/`storage-dir` subcommands.
- Update any schema/snapshot tests referencing the renamed keys.

---

## Step VERIFY: Definition of done (deep test + autofix loop)

Run and make all pass; fix every failure and re-run until green — do not stop with known failures:

```bash
pnpm build
pnpm test
pnpm lint
pnpm docs:update   # must leave NO diff
cargo build --workspace
cargo clippy --workspace --all-targets -- -D warnings
npx knip --reporter compact   # confirm no dead code left by the deleted subcommands
```

Catch-all grep for stragglers — must return ONLY the intentional native-boundary keepers (`packages/extraction/native`, `TrafilaturaConfig`, `toTrafilaturaConfig`, `toNativeConfig` keep `targetLanguage`):

```bash
rg -n 'targetLanguage|dynamicContentWaitSecs|renderingTypeDetectionPercentage|includeUrlGlobs|excludeUrlGlobs|linkSelector|maxCrawlPages|pageLoadTimeoutSecs|maxScrollHeightPixels|keepUrlFragments|ignoreSslErrors|--target-language|--dynamic-content-wait|--rendering-detection-pct|--max-pages|--page-load-timeout|--ignore-ssl-errors|--keep-url-fragments|--link-selector|@contextractor/standalone'
```

Also sweep the stragglers that codegen will NOT fix — these were the exact gaps the first pass missed (`pnpm docs:update` only rewrites `@generated` regions, so hand-written README/FAQ prose must be checked manually):

```bash
# tiered-proxy leftovers (Step STALE-PURGE) — expect zero outside prompts/
rg -n 'tieredProxy' -g '!node_modules' -g '!prompts'
# old dedup enum values — expect zero outside prompts/ and the superseded section of the dedup-naming review
rg -n 'content-hash|ignoreCanonicalUrl|ignore-canonical-url' -g '!node_modules' -g '!prompts'
# stale UI-title strings left after key renames (hand-written README/CLI prose) — expect zero (extraction package keeps targetLanguage)
rg -n 'Page load timeout|Target language|Dynamic content wait|Keep URL fragments|Ignore SSL|Max pages' -g '*.md' -g '*.ts' -g '!prompts' -g '!node_modules' -g '!packages/extraction'
```

Also grep `apps/apify-actor/src` for any read sites of the renamed keys and update any Actor-side input mapping to the new Crawlee-aligned keys (and `languageCode` / `waitForDynamicContentSecs`).

End-to-end smoke (real content files must appear):

```bash
npx contextractor extract https://example.com
npx contextractor export --output-dir ./contextractor-output
ls -1 ./contextractor-output    # expect human-named .md/.txt/... files + manifest.json
```

- Confirm `apps/apify-actor/.actor/input_schema.json` reflects the renamed keys.
- If any proxy code was touched (this change is docs-only for proxy), run `/proxy-test`.

Then commit on the `dev` branch (no Claude / `Co-Authored-By` footer). Do NOT push to Apify production.

---

## Step COMMIT: Commit and push

Run `/git:commit` to commit all changes on the `dev` branch and push to the remote. Commit messages must NOT mention Claude or add a `Co-Authored-By` footer. Do NOT push to Apify production.

---

## Step MAINTENANCE: Run the full maintenance pipeline

Run `.claude/commands/autonomous/maintenance-all-shell.md` — the full autonomous/maintenance pipeline — auto-fixing any failures and iterating until all steps pass.
