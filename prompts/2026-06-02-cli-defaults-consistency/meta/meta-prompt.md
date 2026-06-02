> **TLDR**: Meta-prompt that generates two implementation prompts — one for `contextractor-ts` (the source of truth) and one for `tools` (the synced website replica) — to make the contextractor CLI, lib, and Apify Actor consistent and clean: rename poorly-named flags through the Zod schema, drop redundant default flags from docs/examples, delete the `list`/`get`/`kvs`/`storage-dir` subcommands and add a real `export` command, rename the published package to `contextractor`, and purge stale docs. `contextractor-ts` runs FIRST; `tools` propagates after.

# Meta-Prompt: CLI Defaults & Naming Consistency

## What this generates

This meta-prompt produces two implementation prompt files:

- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-06-02-cli-defaults-consistency/prompt.md` — the `contextractor-ts` prompt (source of truth).
- A prompt in a subfolder of `/Users/miroslavsekera/r/tools/prompts` — the `tools` repo prompt (synced website replica).

## Order of operations

`contextractor-ts` is the source of truth and its prompt must be completed FIRST (schema/CLI/lib/Actor renames, then `pnpm build` + `pnpm docs:update`). The `tools` prompt runs AFTER and propagates the result by fixing the generators + sync command definitions and re-running the `sync-all` pipeline — never the reverse.

## Source-of-truth architecture

The Zod schema `packages/schema/src/source-of-truth/input.ts` is the single PRIMARY source of truth; the CLI, the lib, and the Apify Actor are all DERIVED from it and must differ ONLY where a surface intrinsically requires it (kebab-case CLI flags vs camelCase schema keys, how start URLs are supplied, platform-managed vs local storage). Every config param therefore lives in the schema, and a deep rename must propagate to all three surfaces.

Only genuinely CLI-only orchestration flags live OUTSIDE the schema and have no key to rename: `--config`, `--storage-dir`, `--output-dir`, `--verbose`, `--clean`, `--input-file`, and the `all` shorthand of `--save` (see `prompts/2026-04-27-zod-schema-unification`). `--dataset` is NOT CLI-only — it maps to the schema key `datasetName` and must stay in sync with it.

## Drop redundant default flags

Review CLI commands, documentation, and README files for default values that are not required and should be omitted from examples:

- `--save-destination <dest>` — `Where to save: key-value-store|dataset (repeatable) (default: ["key-value-store"])`. This is the default and can be omitted, but some places still supply it (e.g. the contextractor-site playground, see `prompts/2026-06-02-cli-defaults-consistency/meta/contextractor-playground-generated-commands.png`). Fix this and check all related `README.md` files, `SPEC.md` files, and examples (`/Users/miroslavsekera/r/contextractor-ts/examples`).
- `--save <format>` — `Output format: markdown, txt, json, html, original, all (repeatable) (default: ["markdown"])`. Same case as `--save-destination`.
- Check for other optional params with default values (e.g. `--storage-dir`); none of these should be supplied in examples.

## Flag/param renames

Flag/param renames must go deep through the Zod source of truth `packages/schema/src/source-of-truth/input.ts`, not just the CLI flag surface: rename the schema key too, which also renames the Apify Actor input field. This is a breaking change for existing Apify input — that is acceptable.

- `--target-language` → `--language` (Apify input-schema key `targetLanguage` → `languageCode`). This matches Apify first-party actors (which use `languageCode`) and general CLI industry standards (`--language`); the `target-` prefix wrongly implies a translation source/target pair. Ignore trafilatura naming — follow Apify/Crawlee/industry conventions.
- `--dynamic-content-wait <seconds>` → `--wait-for-dynamic-content` (schema key `dynamicContentWaitSecs` → `waitForDynamicContentSecs`). Renamed for consistency with the existing `--wait-for-selector` flag.
- `--rendering-detection-pct` → `--rendering-type-detection-percentage` (or another clear, consistent name) to match its schema key `renderingTypeDetectionPercentage`. The current name abbreviates "pct" and drops "type". Treat this as a concrete case of the param-naming review below.

Review every single param: is it a meaningful name, is the name according to best practices and industry standards, is it consistent with the Apify/Crawlee ecosystem?

### Naming reference: Apify WCC

The concrete Apify/Crawlee naming reference is the `apify/website-content-crawler` (WCC) actor — the schema already aligns field names to it (`maxCrawlPages`, `maxCrawlDepth`, `includeUrlGlobs`, `excludeUrlGlobs`). Review every param against WCC's input keys first, then general industry standards. The CLI flag and the schema key may legitimately differ (e.g. `--glob` → `includeUrlGlobs`); keep each consistent within its own surface. Apify/Crawlee ecosystem naming is INSPIRATION, not a hard rule — where a stronger best practice or internal consistency wins (e.g. the `--wait-for-*` family), it is fine to diverge from WCC (which uses `dynamicContentWaitSecs`); just document the rationale.

### Enum-casing convention

Follow the established enum-casing convention (kebab-case "Variant B", see `prompts/2026-05-25-enum-casing-audit`): contextractor-owned enum values are kebab-case across schema/CLI/lib/Actor (`deduplication: none|url|content-hash`, `crawlerType: playwright-*`, `proxyRotation: per-request|until-failure`), with two exceptions — `waitUntil` stays flat lowercase (verbatim Playwright tokens) and foreign Apify constants (proxy groups, `READ`/`WRITE`) stay SCREAMING_SNAKE. Any new/renamed enum must follow this; do not revert `deduplication` to the old `minimal`/`basic`/`full`.

### Extraction-param boundary

Extraction-param renames must STOP at the TypeScript boundary (`.claude/rules/native-addon-boundary.md`, reinforced by `prompts/2026-06-01-trafilatura-config-wrapper-isolation`). For `--target-language` → `--language`: rename the CLI flag, the Zod schema key (`targetLanguage`), the Apify input field, and the schema→config mapping — but do NOT touch `packages/extraction/native/src/lib.rs` (keeps trafilatura's `target_language`) or the extraction package's `TrafilaturaConfig` (mirrors upstream naming). The translation lives in `packages/extraction/src/index.ts` (`toNativeConfig`).

### Regenerate after renames

After any flag/param rename, run `pnpm build` then `pnpm docs:update` to regenerate the `@generated` regions in `apps/standalone/README.md` and the Apify input schema `apps/apify-actor/.actor/input_schema.json` (both derive from the Zod source of truth) so docs and schema stay in sync. A full `pnpm build` must run first because `gen-md-regions` imports the built CLI.

## CLI↔schema coverage audit

Audit CLI↔schema coverage for unnecessary divergence: the schema exposes a storage-name trio (`datasetName`, `keyValueStoreName`, `requestQueueName`) but the CLI surfaces only `--dataset` (→ `datasetName`); the other two are reachable only via `--config`. Either expose all three consistently as flags or document the omission — asymmetric coverage is exactly the kind of avoidable CLI/lib/Actor difference this cleanup should remove.

## Delete subcommands, add `export`

Delete the `list`, `get`, `kvs`, and `storage-dir` subcommands from the NPM CLI — they are not useful. Instead add an `export` command that writes the extracted content from storage to a directory. No `export` command ever existed (verified git history) — design it fresh.

With the default `--save-destination key-value-store`, the actual content lives as KVS files (keys `markdown-{md5}.md`, `txt-{md5}.txt`, …), NOT in the dataset, so `export` must read the KVS (`KeyValueStore.open()` + iterate keys + `getValue`) and write each blob to `--output-dir` as a real file with a readable name derived from the URL/title (not the md5 key). It should also emit the dataset metadata records as a manifest (`Dataset.exportToJSON` / `crawler.exportData`). This replaces the deleted `kvs`/`list`/`get` read paths.

The `export` command writes to a user-facing OUTPUT directory via a CLI-only `--output-dir <path>` flag, kept distinct from the internal `--storage-dir` (Crawlee's storage; never browsed directly by users). For the optional dataset-records manifest, Crawlee's `crawler.exportData('./contextractor-output/run-*.json')` / `Dataset.exportToJSON` is the canonical mechanism (storage-vs-output investigation, `prompts/2026-05-19-storage-vs-output-plus-func-comparison`); the content files themselves come from the KVS as described above.

All changes requested for the NPM CLI must be mirrored to the NPM lib where applicable.

## Package rename

The published NPM package is `contextractor` (https://www.npmjs.com/package/contextractor), but the workspace package is named `@contextractor/standalone` (`private: true`, v0.1.0). Rename it to `contextractor`, remove `private`, and update every internal reference:

- root `SPEC.md`
- `apps/standalone/README.md`, `apps/standalone/SPEC.md`
- the `gen-md-regions` dependency + import (`tools/gen-md-regions`)
- `examples/library-ts` (package.json dep + import)
- `dev-utils/installation/lib/pkg.ts` (`STANDALONE_PKG`)
- the tools-repo site content pages (`html.md`, `trafilatura*.md`, site `SPEC.md`, `main.tsx` descriptions)

## Website: restore the npm help page

The page `https://www.contextractor.com/help/npm/` was replaced with a stale "no longer maintained" stub (not deleted — the route still resolves); restore the full content (look at git history). The npm package (`contextractor`) is still published and live, so there must be no deprecation, no stub, no deletion. Split that page into two — one for NPM standalone (CLI) and one for NPM lib.

## Website: fix all generated variants

The `npm install @contextractor/standalone` in the playground (see `contextractor-playground-generated-commands.png`) is wrong — the package name is `contextractor`. This is end-user documentation; the NPM package lives at https://www.npmjs.com/package/contextractor.

The website fixes apply to ALL generated variants, not just "macOS / Linux — run.sh": also fix the "Windows — run.cmd" template, the TypeScript library example (import + setup comment), the `main.tsx` UI descriptions, and the site `SPEC.md` in `tools/apps/contextractor-site` — each currently uses `@contextractor/standalone` and/or the `list` command. Remove the "Zero-to-data" fluff comments from both scripts, and do not include any call to the `list` command — instead include a command that exports data from storage for the user.

The intended playground / run.sh flow after these changes (so the generated script is coherent): `npm install contextractor` → `npx playwright install chromium` → `npx contextractor extract <url>` (no redundant default flags) → `npx contextractor export --output-dir ./contextractor-output`. No `list` call, no fluff comments, correct package name.

## Website is a synced replica (CRITICAL)

The `tools` repo website + docs are a SYNCED REPLICA of `contextractor-ts`, not a source of truth. The `tools/.claude/commands/projects/contextractor/` sync pipeline (`sync-all` → `sync-gui`, `sync-docs`, `sync-snippets`) regenerates the help pages, the playground command generators (`generate-commands.ts`), and types from the `contextractor-ts` source of truth — so any hand-edit to the website output is OVERWRITTEN on the next sync. The tools-repo prompt must fix the GENERATORS and the sync command definitions themselves, then re-run sync — not just patch the emitted scripts/pages.

In particular, `sync-docs.md` currently encodes stale decisions ("npm CLI = deprecated", keep `npm.md` as a deprecation stub, "do not recreate pypi/docker") — update it so `contextractor` is the live npm standalone and `/help/npm/` becomes two maintained pages (standalone + lib). Fix the package name and remove the `list` command in the generator helpers, not just in the output.

## Sync stale SPEC docs to the schema

`apps/standalone/SPEC.md` documents `--deduplication` with stale values `minimal`/`basic`/`full` (default `basic`); the actual schema is `none`/`url`/`content-hash` (default `url`). Sync all SPEC.md docs to the schema source of truth.

## Purge stale references to removed features

Audit and PURGE stale references to already-removed features (same class as the stale `--deduplication` doc):

- Tiered proxy (`tieredProxyUrls`/`tieredProxyConfig`, dropped in `prompts/2026-05-26-drop-tiered-proxy`) still lingers in `tools/proxy-rotation-tester/README.md`, `tools/proxy-rotation-tester/src/lib.test.ts`, and `.claude/commands/proxy-test.md`.
- The removed `--save jsonl` format (dropped in `prompts/2026-05-12-remove-jsonl-saving`) still appears in `.claude/commands/autonomous/maintenance/sync/docs.md`. Note `list --format jsonl` (dataset read format) was intentionally kept and is unrelated.

## Sync all docs

Update ALL applicable docs in both repos: every affected `README.md`, `SPEC.md`, `@generated` region, JSDoc, help page, and inline comment must be brought in sync with the changes — leave nothing stale.

## Verification (definition of done)

In `contextractor-ts`:

- Run `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm docs:update` (the last must leave NO diff).
- Exercise the CLI end-to-end: `contextractor extract <url>` then `contextractor export --output-dir ./out`, and confirm real content files appear.
- Confirm `apps/apify-actor/.actor/input_schema.json` reflects the renamed keys.

In `tools`:

- Run `sync-all` and run the site locally to confirm the playground generates the corrected `contextractor` commands.

If proxy code is touched, run `/proxy-test`.

Both prompts must end with DEEP TESTING and AUTOFIXING: run the full build, lint, unit + integration tests, regenerate docs, and a smoke/end-to-end run; fix every failure found and re-run until everything passes — do not stop with known failures.
