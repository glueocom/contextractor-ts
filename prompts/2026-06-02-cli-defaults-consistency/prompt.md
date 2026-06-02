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
- **Param audit**: apply EVERY rename justified by Apify WCC / industry / internal consistency — not only the three named below. Document a rationale table for each rename applied.
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

## Step PARAM-AUDIT: Review every param against WCC, then industry standards

Reference order: the Apify `apify/website-content-crawler` (WCC) actor input keys FIRST (the schema already aligns `maxCrawlPages`, `maxCrawlDepth`, `includeUrlGlobs`, `excludeUrlGlobs`), then general industry / clig.dev conventions. WCC is INSPIRATION, not a hard rule — where a stronger best practice or internal consistency wins (e.g. the `--wait-for-*` family vs WCC's `dynamicContentWaitSecs`), it is fine to diverge; document the rationale.

- Walk every field in the schema and every CLI flag in `addExtractionOptions`.
- The CLI flag and the schema key may legitimately differ within their own surface (e.g. `--glob` → `includeUrlGlobs`); keep each consistent internally.
- Apply every clearly-justified rename (full-audit mode). For each rename produce a row: `old → new | surface(s) | rationale (WCC key / industry convention / internal consistency)`. Put this table in the PR/commit body.
- Avoid abbreviations and unit suffixes in flag NAMES (carry units in the `<placeholder>`); avoid misleading prefixes.

---

## Step CLI: Rename flags and add storage flags

Files: `apps/standalone/src/cliProgram.ts`, `apps/standalone/src/config.ts`

- In `addExtractionOptions` (≈ lines 142-284):
  - `--target-language <lang>` → `--language <lang>`.
  - `--dynamic-content-wait <seconds>` → `--wait-for-dynamic-content <seconds>`.
  - `--rendering-detection-pct <n>` → `--rendering-type-detection <percentage>`.
  - Apply audit-justified flag renames.
- On the `extract` command (and `export`, see below) add the storage trio:
  - keep `--dataset <name>` → `datasetName`,
  - add `--key-value-store <name>` → `keyValueStoreName`,
  - add `--request-queue <name>` → `requestQueueName`.
- Update `buildSchemaOverrides()` (≈ lines 317-404) so each renamed flag maps to its renamed schema key, and the new storage flags map to `keyValueStoreName` / `requestQueueName`.
- Update any commander option types / interfaces (`ExtractOpts`, etc.) for the renames.

---

## Step DELETE-SUBCOMMANDS: Remove low-value read/storage subcommands

File: `apps/standalone/src/cliProgram.ts`

- Delete `list` (≈ 659-688), `get` (≈ 693-710), the entire `kvs` group (≈ 715-829), and the `storage-dir` subcommand (≈ 859-866).
- KEEP `extract`, `purge`, the `--storage-dir` FLAG (CLI-only orchestration for Crawlee's internal storage), and the re-exports `Dataset`, `KeyValueStore`, `configureStorage`, `resolveStorageDir` (library consumers still use them).
- Remove now-dead helpers/types/imports left behind (`toCsv`, `ListOpts`, `KvsPutOpts`, unused `readFile`/`path`/MIME map, etc.). Run `npx knip --reporter compact` to confirm nothing dangles.

---

## Step EXPORT: Add a fresh `export` command (mirrored into the lib)

No `export` command ever existed — design it fresh. With the default `saveDestination: ['key-value-store']`, content lives as KVS blobs (`markdown-{md5}.md`, `txt-{md5}.txt`, …), NOT in the dataset. The dataset is the human-readable INDEX: each record has `url`, `metadata` (incl. `title`), `crawl`, and per-format `ContentNode`s (see `packages/crawler/src/sinks/storage.ts`). A node carries either `.content` (inline — dataset destination) or `.key` (KVS destination; the key already embeds the extension).

Add an `export` command to `buildProgram()` and expose its action as a reusable exported helper so the library API can call it too.

- Flags: `--output-dir <path>` (default `./contextractor-output`), `--dataset <name>` (default `default`), `--storage-dir <path>`.
- Algorithm:
  - `configureStorage(resolveStorageDir(opts.storageDir))`, then `Dataset.open(opts.dataset ?? 'default')`.
  - For each item: derive a readable base name by slugifying `metadata.title` (fallback `url`); slugify to a safe filename.
  - For each content node (`txt|markdown|json|html|original`) present on the item: if `node.content` is set, write it directly; else if `node.key` is set, `KeyValueStore.open(...).getValue(node.key)` and write the blob. Filename = `<slug>.<ext>` where `<ext>` comes from the KVS key suffix (or the format → ext map for inline content). Resolve collisions deterministically (append a short suffix).
  - Write a `manifest.json` of the dataset records into `--output-dir` via `Dataset.exportToJSON` / `crawler.exportData('<output-dir>/manifest.json')`.
  - Print a concise summary (files written, output dir) to stderr.
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
- `examples/cli-npm/run.sh`: rewrite so it no longer calls the deleted `list`/`get`/`kvs`/`storage-dir` subcommands. Replace the read demos with an `export` demo. Fix renamed flags (`--rendering-detection-pct` → `--rendering-type-detection`, `--dynamic-content-wait` → `--wait-for-dynamic-content`, `--target-language` → `--language` if shown). Replace stale `--ignore-canonical-url` with `--deduplication none`. Remove the redundant default `--save-destination key-value-store` line (keep only non-default destination demos). Update the header comment package name to `contextractor`.
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

- Add tests for the new `export` command: KVS-blob path (default destination) and inline `content` path (dataset destination), readable filename derivation, manifest emission, collision handling.
- Update flag tests for the three renames + storage flags (`--key-value-store`, `--request-queue`).
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
```

End-to-end smoke (real content files must appear):

```bash
npx contextractor extract https://example.com
npx contextractor export --output-dir ./contextractor-output
ls -1 ./contextractor-output    # expect human-named .md/.txt/... files + manifest.json
```

- Confirm `apps/apify-actor/.actor/input_schema.json` reflects the renamed keys.
- If any proxy code was touched (this change is docs-only for proxy), run `/proxy-test`.

Then commit on the `dev` branch (no Claude / `Co-Authored-By` footer). Do NOT push to Apify production.
