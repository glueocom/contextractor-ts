> **TLDR**: Make the contextractor CLI, lib, and Apify Actor consistent and clean. Rename three poorly-named flags (and any others the audit justifies) deep through the Zod source of truth; expose the full storage-name trio as flags; delete the low-value `list`/`get`/`kvs`/`storage-dir` subcommands and add a real `export` command that writes stored content to a user output directory; rename the published package to `contextractor`; purge stale docs (deduplication enum, tiered proxy, `--save jsonl`, redundant default flags); then rebuild, regenerate `@generated` docs + the Apify input schema, sync all SPECs, deep-test, and autofix until green.

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

- **Storage flags**: expose all three. Keep `--dataset` → `datasetName`; ADD `--key-value-store <name>` → `keyValueStoreName` and `--request-queue <name>` → `requestQueueName`. This removes the asymmetric CLI/schema coverage.
- **Param audit**: apply the renames justified by industry / clig.dev conventions and internal consistency — not only the three named below. The decided set is enumerated in Step PARAM-AUDIT; document a rationale table for each rename applied.
- **WCC is inspiration only**: Apify's `website-content-crawler` (WCC) is a reference point we may borrow from, NOT a spec we must comply with. Where a stronger industry convention or internal consistency wins, diverge freely.
- **The Zod schema is not yet shipped**: its keys are being defined now and are freely changeable. Choose the clearest name on each surface; schema keys and CLI flags can both move. (Existing Apify input compatibility is explicitly not a constraint — the break is accepted.)
- **Three explicit renames**:
  - `--target-language` → `--language`; schema key `targetLanguage` → `languageCode` (matches Apify first-party `languageCode`; `target-` wrongly implies a translation pair).
  - `--dynamic-content-wait` → `--wait-for-dynamic-content` (consistent with the `--wait-for-selector` family); schema key `dynamicContentWaitSecs` → `waitForDynamicContentSecs`; CLI placeholder `<seconds>`.
  - `--rendering-detection-pct` → `--rendering-type-detection <percentage>`. The schema key STAYS `renderingTypeDetectionPercentage` (camelCase API identifier). Rationale (researched): well-designed CLIs name *what*, not *units* — the unit lives in the value placeholder (curl `--max-time <seconds>`, modern kubectl `--cpu=80%` deprecating `--cpu-percent`, clig.dev). The `<percentage>` metavar both carries the unit and prevents the flag reading as a boolean toggle.

## Enum-casing convention (do not violate)

Contextractor-owned enum values are kebab-case across schema/CLI/lib/Actor (`deduplication: none|url|content-hash`, `crawlerType: playwright-*`, `proxyRotation: per-request|until-failure`). Exceptions: `waitUntil` stays flat lowercase (verbatim Playwright tokens); foreign Apify constants (proxy groups, `READ`/`WRITE`) stay SCREAMING_SNAKE. Never revert `deduplication` to the old `minimal`/`basic`/`full`. See `prompts/2026-05-25-enum-casing-audit`.

---

## Step SCHEMA: Rename keys in the Zod source of truth

File: `packages/schema/src/source-of-truth/input.ts`

- `targetLanguage` (≈ lines 256-262) → `languageCode`.
- `dynamicContentWaitSecs` (≈ lines 419-426) → `waitForDynamicContentSecs`.
- Keep `renderingTypeDetectionPercentage` (≈ lines 56-64) as-is.
- Apply any additional schema-key renames decided in Step PARAM-AUDIT.
- Update field titles/descriptions/`enumTitles` prose accordingly; keep enum *values* unchanged and kebab-cased per the convention above.

The Apify Actor input field names derive from these keys and will change — that is the intended breaking change.

---

## Step PARAM-AUDIT: Review every param against industry standards (WCC as inspiration)

Reference: general industry / clig.dev conventions FIRST, with Apify's `apify/website-content-crawler` (WCC) input keys as a secondary inspiration where they happen to align. WCC is NOT a spec to comply with — where a stronger best practice or internal consistency wins (e.g. the `--wait-for-*` family over WCC's `dynamicContentWaitSecs`), diverge freely and document why. The Zod schema is unshipped and its keys are freely changeable, so pick the clearest name on each surface.

- Walk every field in the schema and every CLI flag in `addExtractionOptions`.
- The CLI flag and the schema key may legitimately differ within their own surface (e.g. `--include-url-globs` → `includeUrlGlobs`); keep each consistent internally.
- Apply every rename in the decided set below (locked). For each rename produce a row: `old → new | surface(s) | rationale (industry convention / internal consistency)`. Put this table in the commit body.
- Avoid abbreviations and unit suffixes in flag NAMES (carry units in the `<placeholder>`); avoid misleading prefixes. Prefer the shortest idiomatic name when context is unambiguous (clig.dev).

### Decided renames (CLI flag only; schema keys already match)

- `--ignore-cors` → `--ignore-cors-and-csp` (maps to schema `ignoreCorsAndCsp`) — current name is misleading; it also disables CSP.
- `--glob` → `--include-url-globs` (maps to schema `includeUrlGlobs`) — clarity + symmetry with the exclude flag.
- `--exclude` → `--exclude-url-globs` (maps to schema `excludeUrlGlobs`) — "exclude what?" is vague; symmetry with include.
- `--max-pages` → `--max-crawl-pages` (maps to schema `maxCrawlPages`) — match the schema key; disambiguate from result/output counts.
- `--crawl-depth` → `--max-crawl-depth` (maps to schema `maxCrawlDepth`) — match the schema key; the value is a maximum, so add `max-`.

These are CLI-flag-only renames — their schema keys already match, so they add NO schema-key renames beyond the locked `languageCode` / `waitForDynamicContentSecs`. Enum VALUES stay locked kebab-case.

### Considered and rejected (do NOT apply — researched)

- `--max-retries` → `--max-request-retries`: REJECTED. `--max-retries` is the idiomatic form (curl `--retry`, wget `--tries`, kubectl `--retries`, AWS SDK `max_attempts`); the longer form adds no clarity and violates clig.dev "prefer shorter when unambiguous." Keep `--max-retries`.
- `--respect-robots-txt` → `--respect-robots-txt-file`: REJECTED. No CLI tool appends `-file` to a robots flag (wget2 `--robots`/`--no-robots`; Scrapy `ROBOTSTXT_OBEY`); `respectRobotsTxtFile` exists only as Crawlee's internal object key, not a CLI convention. Keep `--respect-robots-txt`.
- `--save` → `--format`: REJECTED. The `save` enum includes `original` (raw source), which is NOT a format — folding a raw passthrough into a format enum is a category error with no precedent in comparable tools (ffmpeg keeps `-c copy` separate from `-f`; yt-dlp keeps `--write-pages` separate from `--format`; trafilatura's `--output-format` has no `original` value). Under the verb `--save`, `original` reads correctly. Keep `--save` and its schema key `save` unchanged.

---

## Step CLI: Rename flags and add storage flags

Files: `apps/standalone/src/cliProgram.ts`, `apps/standalone/src/config.ts`

- In `addExtractionOptions` (≈ lines 142-284):
  - `--target-language <lang>` → `--language <lang>`.
  - `--dynamic-content-wait <seconds>` → `--wait-for-dynamic-content <seconds>`.
  - `--rendering-detection-pct <n>` → `--rendering-type-detection <percentage>`.
  - Apply every flag rename in the Step PARAM-AUDIT decided set. Mind commander's derived prop names: e.g. `--include-url-globs` → `opts.includeUrlGlobs`, `--exclude-url-globs` → `opts.excludeUrlGlobs`, `--max-crawl-pages` → `opts.maxCrawlPages`, `--max-crawl-depth` → `opts.maxCrawlDepth`, `--ignore-cors-and-csp` → `opts.ignoreCorsAndCsp`, `--language` → `opts.language`, `--wait-for-dynamic-content` → `opts.waitForDynamicContent`, `--rendering-type-detection` → `opts.renderingTypeDetection`.
- On the `extract` command (and `export`, see below) add the storage trio:
  - keep `--dataset <name>` → `datasetName`,
  - add `--key-value-store <name>` → `keyValueStoreName`,
  - add `--request-queue <name>` → `requestQueueName`.
- Update `buildSchemaOverrides()` (≈ lines 317-404) so each renamed flag prop maps to its schema key (e.g. `opts.includeUrlGlobs` → `includeUrlGlobs`, `opts.excludeUrlGlobs` → `excludeUrlGlobs`, `opts.maxCrawlPages` → `maxCrawlPages`, `opts.ignoreCorsAndCsp` → `ignoreCorsAndCsp`), and the new storage flags map to `keyValueStoreName` / `requestQueueName`.
- Update any commander option types / interfaces (`ExtractOpts`, etc.) for the renames.
- In `apps/standalone/src/config.ts` (`buildCrawlConfig`), change the schema-read sites for the locked schema-key renames — `input.targetLanguage` → `input.languageCode` (≈ line 146) and `input.dynamicContentWaitSecs` → `input.waitForDynamicContentSecs` (≈ line 137). KEEP the internal `CrawlConfig` field names unchanged (`targetLanguage`, `dynamicContentWaitSecs`) so the crawler/native boundary stays untouched — see Step BOUNDARY.

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

## Step BOUNDARY: Keep extraction-param renames on the TypeScript side

Per `.claude/rules/native-addon-boundary.md` (reinforced by `prompts/2026-06-01-trafilatura-config-wrapper-isolation`):

- Do NOT touch `packages/extraction/native/src/lib.rs` (keeps `target_language`) or the extraction package's `TrafilaturaConfig` (mirrors upstream `targetLanguage`).
- For `languageCode`: rename the schema key, the CLI flag, the Apify input field, and the schema→config mapping. The translation to the wrapper stays at the existing point — `toTrafilaturaConfig` in `packages/crawler/src/createCrawler.ts` maps the schema-derived option to `TrafilaturaConfig.targetLanguage`; `toNativeConfig` in `packages/extraction/src/index.ts` is untouched.

---

## Step STALE-PURGE: Remove stale docs and stale flag usage

- `apps/standalone/SPEC.md` (≈ line 37): the `--deduplication` doc shows stale `minimal`/`basic`/`full` (default `basic`). Replace with the real schema: `none | url | content-hash` (default `url`).
- `examples/cli-npm/run.sh`: rewrite so it no longer calls the deleted `list`/`get`/`kvs`/`storage-dir` subcommands. Replace the read demos with an `export` demo. Fix every renamed flag it uses — `--rendering-detection-pct` → `--rendering-type-detection`, `--dynamic-content-wait` → `--wait-for-dynamic-content`, `--target-language` → `--language` (if shown), `--max-pages` → `--max-crawl-pages`, and any other flag in the Step PARAM-AUDIT decided set (`--save` is UNCHANGED). Replace stale `--ignore-canonical-url` with `--deduplication none`. Remove the redundant default `--save-destination key-value-store` line (keep only non-default destination demos). Update the header comment package name to `contextractor`.
- `examples/library-ts/src/main.ts`: fix `--dynamic-content-wait` → `--wait-for-dynamic-content`, `--ignore-canonical-url` → `--deduplication none`, and the import path (see PACKAGE-RENAME). The `Dataset`/`KeyValueStore` read-back stays valid.
- Tiered proxy (removed in `prompts/2026-05-26-drop-tiered-proxy`): purge `tieredProxyUrls`/`tieredProxyConfig` references from `tools/proxy-rotation-tester/README.md`, `tools/proxy-rotation-tester/src/lib.test.ts`, and `.claude/commands/proxy-test.md`.
- Removed `--save jsonl` format (dropped in `prompts/2026-05-12-remove-jsonl-saving`): purge from `.claude/commands/autonomous/maintenance/sync/docs.md`. Since the `list` subcommand is now deleted, the `list --format jsonl` carve-out in that doc is also moot — remove it.

---

## Step PACKAGE-RENAME: `@contextractor/standalone` → `contextractor`

The published npm package is `contextractor` (https://www.npmjs.com/package/contextractor); the workspace package name was wrong.

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
- Confirm `apps/apify-actor/.actor/input_schema.json` (and the Actor README `@generated` regions) show `languageCode`, `waitForDynamicContentSecs`, and any audit renames — and no old keys.
- A second `pnpm docs:update` must leave NO diff.

---

## Step SPEC-SYNC: Sync all SPEC.md files to the new reality

Update only affected sections (`minimal-diff`):

- root `SPEC.md` — package name, brief surface description.
- `apps/standalone/SPEC.md` — renamed flags, deleted subcommands, new `export` command, new storage flags, corrected `--deduplication` values, package name.
- `apps/apify-actor/SPEC.md` — renamed Actor input fields.
- `packages/schema/SPEC.md` — renamed keys.
- `packages/crawler/SPEC.md` — the `deduplication?: 'minimal' | 'basic' | 'full'` at ≈ line 62 describes the INTERNAL crawler API, not the user schema. Read the code before editing; change it ONLY if the internal API actually changed.

---

## Step TESTS: Add/update tests in the same change

Per `.claude/rules/test-maintenance.md` (`apps/standalone/src/*.test.ts`):

- Add tests for the new `export` command: KVS-blob path (default destination) and inline `content` path (dataset destination), readable filename derivation, manifest emission, collision handling (`html` vs `original` → `.html`), and the empty-dataset case.
- Update flag tests for all renames (the three locked renames + the Step PARAM-AUDIT decided set) plus the new storage flags (`--key-value-store`, `--request-queue`).
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

Catch-all grep for stragglers — must return ONLY the intentional native-boundary keepers (`packages/extraction/native`, `TrafilaturaConfig`, `toTrafilaturaConfig`, `toNativeConfig`):

```bash
rg -n 'targetLanguage|dynamicContentWaitSecs|--target-language|--dynamic-content-wait|--rendering-detection-pct|@contextractor/standalone'
```

Also grep `apps/apify-actor/src` for `targetLanguage` / `dynamicContentWaitSecs` read sites and update any Actor-side input mapping to the renamed keys (`languageCode` / `waitForDynamicContentSecs`).

End-to-end smoke (real content files must appear):

```bash
npx contextractor extract https://example.com
npx contextractor export --output-dir ./contextractor-output
ls -1 ./contextractor-output    # expect human-named .md/.txt/... files + manifest.json
```

- Confirm `apps/apify-actor/.actor/input_schema.json` reflects the renamed keys.
- If any proxy code was touched (this change is docs-only for proxy), run `/proxy-test`.

Then commit on the `dev` branch (no Claude / `Co-Authored-By` footer). Do NOT push to Apify production.
