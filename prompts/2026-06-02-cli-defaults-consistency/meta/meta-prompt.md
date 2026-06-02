This is a meta prompt: 
 - fixes two repositories `contextractor-ts` and `tools`
 - this metaprompt  must generate two prompt files - `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-06-02-cli-defaults-consistency/prompt.md` and a prompt at a subfolder of `/Users/miroslavsekera/r/tools/prompts` for the tools repo.


review CLI commands and documentation and also documentation and readme files: with default values that are not required like:
    - `  --save-destination <dest>            Where to save: key-value-store|dataset (repeatable)(default: ["key-value-store"])` - this is the default parameter and could be omitted. The problem is that in some places this param is still supplied, e.g. contextractor-site `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-06-02-cli-defaults-consistency/meta/contextractor-playground-generated-commands.png`. Fix this and check all the related README.md files SPEC.md files examples `/Users/miroslavsekera/r/contextractor-ts/examples` etc. Such params (check for other optional params with default values, like --storage-dir) should not be supplied. 
    - `  --save <format>                      Output format: markdown, txt, json, html, original, all (repeatable) (default: ["markdown"])`  - same case like `--save-destination`
    
    


    - `  --dynamic-content-wait <seconds>     Seconds to wait for network idle after navigation (0 = disabled)` - consider renaming to `--wait-for-dynamic-content`, because there is another parameter `--wait-for-selector` so let's make it consistent

- do not put any fluff text to the code examples at "macOS / Linux — run.sh": `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-06-02-cli-defaults-consistency/meta/contextractor-playground-generated-commands.png` - do not put any calling of the list command. instead put there a command that exports data from the storage for the user. also `npm install @contextractor/standalone
` seems wrong, the package name is contextractor. it is the documentation for end users, the NPM package is living at https://www.npmjs.com/package/contextractor

- rename `--target-language` to `--language` (Apify input-schema key `languageCode`) - this matches Apify first-party actors (which use `languageCode`) and general CLI industry standards (`--language`); the `target-` prefix wrongly implies a translation source/target pair. Ignore trafilatura naming - follow Apify/Crawlee/industry conventions.

- review every single param: is it meaningful name, is the name according to best practices industry standards, consistent with Apify/Crawlee ecosystem?

- this page `https://www.contextractor.com/help/npm/` was replaced with a stale "no longer maintained" stub (not deleted - the route still resolves), must restore the full content (look on git history). The npm package (`contextractor`) is still published and live, so there must be no deprecation, no stub, no deletion. Also split that page to two - one for NPM standalone and one for NPM lib.

- delete the `list`, `get`, `kvs`, and `storage-dir` subcommands from the NPM CLI - they are not useful. Instead add an `export` command that exports the extracted data from storage to a directory. No `export` command ever existed (verified git history) - design it fresh using Crawlee's mechanism (`Dataset.exportToJSON` / `Dataset.exportToCSV`, or `Dataset.open()` + `getData()` + write to the target dir). Match how crawlee.dev implements dataset export.

- all changes requested for the NPM CLI must be mirrored to the NPM lib where applicable.

- the published NPM package is `contextractor`, but the workspace package is named `@contextractor/standalone` (`private: true`, v0.1.0). Rename it to `contextractor`, remove `private`, and update every internal reference: root `SPEC.md`, `apps/standalone/README.md`, `apps/standalone/SPEC.md`, the `gen-md-regions` dependency + import (`tools/gen-md-regions`), `examples/library-ts` (package.json dep + import), `dev-utils/installation/lib/pkg.ts` (`STANDALONE_PKG`), and the tools-repo site content pages (`html.md`, `trafilatura*.md`, site `SPEC.md`, `main.tsx` descriptions).

- the website fixes above apply to ALL generated variants, not just "macOS / Linux — run.sh": also fix the "Windows — run.cmd" template, the TypeScript library example (import + setup comment), the `main.tsx` UI descriptions, and the site `SPEC.md` in `tools/apps/contextractor-site` - each currently uses `@contextractor/standalone` and/or the `list` command. Remove the "Zero-to-data" fluff comments from both scripts.

- flag/param renames must go deep through the Zod source of truth `packages/schema/src/source-of-truth/input.ts`, not just the CLI flag surface: rename the schema key too (e.g. `targetLanguage` -> `languageCode`, `dynamicContentWaitSecs` -> `waitForDynamicContentSecs`), which also renames the Apify Actor input field. This is a breaking change for existing Apify input - that is acceptable.

- after any flag/param rename, run `pnpm build` then `pnpm docs:update` to regenerate the `@generated` regions in `apps/standalone/README.md` and the Apify input schema `apps/apify-actor/.actor/input_schema.json` (both derive from the Zod source of truth) so docs and schema stay in sync. A full `pnpm build` must run first because `gen-md-regions` imports the built CLI.

- `apps/standalone/SPEC.md` documents `--deduplication` with stale values `minimal`/`basic`/`full` (default `basic`); the actual schema is `none`/`url`/`content-hash` (default `url`). Sync all SPEC.md docs to the schema source of truth.

- rename `--rendering-detection-pct` (it abbreviates "pct" and drops "type") to match its schema key `renderingTypeDetectionPercentage` - e.g. `--rendering-type-detection-percentage`, or another clear, consistent name. Treat this as a concrete case of the param-naming review above.

- CRITICAL - the `tools` repo website + docs are a SYNCED REPLICA of `contextractor-ts`, not a source of truth. The `tools/.claude/commands/projects/contextractor/` sync pipeline (`sync-all` -> `sync-gui`, `sync-docs`, `sync-snippets`) regenerates the help pages, the playground command generators (`generate-commands.ts`), and types from the `contextractor-ts` source of truth - so any hand-edit to the website output is OVERWRITTEN on the next sync. The tools-repo prompt must fix the GENERATORS and the sync command definitions themselves, then re-run sync - not just patch the emitted scripts/pages. In particular `sync-docs.md` currently encodes stale decisions ("npm CLI = deprecated", keep `npm.md` as a deprecation stub, "do not recreate pypi/docker") - update it so `contextractor` is the live npm standalone and `/help/npm/` becomes two maintained pages (standalone + lib). Fix the package name and remove the `list` command in the generator helpers, not just in the output.

- the concrete Apify/Crawlee naming reference is the `apify/website-content-crawler` (WCC) actor - the schema already aligns field names to it (`maxCrawlPages`, `maxCrawlDepth`, `includeUrlGlobs`, `excludeUrlGlobs`). Review every param against WCC's input keys first, then general industry standards. Note the CLI flag and the schema key may legitimately differ (e.g. `--glob` -> `includeUrlGlobs`); keep each consistent within its own surface.

- follow the established enum-casing convention (kebab-case "Variant B", see `prompts/2026-05-25-enum-casing-audit`): contextractor-owned enum values are kebab-case across schema/CLI/lib/Actor (`deduplication: none|url|content-hash`, `crawlerType: playwright-*`, `proxyRotation: per-request|until-failure`), with two exceptions - `waitUntil` stays flat lowercase (verbatim Playwright tokens) and foreign Apify constants (proxy groups, `READ`/`WRITE`) stay SCREAMING_SNAKE. Any new/renamed enum must follow this; do not revert `deduplication` to the old `minimal`/`basic`/`full`.

- extraction-param renames must STOP at the TypeScript boundary (`.claude/rules/native-addon-boundary.md`, reinforced by `prompts/2026-06-01-trafilatura-config-wrapper-isolation`). For `--target-language` -> `--language`: rename the CLI flag, the Zod schema key (`targetLanguage`), the Apify input field, and the schema->config mapping - but do NOT touch `packages/extraction/native/src/lib.rs` (keeps trafilatura's `target_language`) or the extraction package's `TrafilaturaConfig` (mirrors upstream naming). The translation lives in `packages/extraction/src/index.ts` (`toNativeConfig`).

- the deep-rename rule applies ONLY to schema-backed params. CLI-only orchestration flags live OUTSIDE the Zod schema (see `prompts/2026-04-27-zod-schema-unification`) and have no schema key to rename: `--config`, `--storage-dir`, `--output-dir`, `--verbose`, `--clean`, `--input-file`, `--dataset`, and the `all` shorthand of `--save`. Rename these on the CLI surface only.

- the new `export` command should write to a user-facing OUTPUT directory via a CLI-only `--output-dir <path>` flag, kept distinct from the internal `--storage-dir` (Crawlee's storage; never browsed directly by users). The storage-vs-output investigation (`prompts/2026-05-19-storage-vs-output-plus-func-comparison`) already identified Crawlee's `crawler.exportData('./contextractor-output/run-*.json')` (and `Dataset.exportToJSON`) as the canonical single-file export mechanism - use it.

- audit and PURGE stale references to already-removed features (same class as the stale `--deduplication` doc): tiered proxy (`tieredProxyUrls`/`tieredProxyConfig`, dropped in `prompts/2026-05-26-drop-tiered-proxy`) still lingers in `tools/proxy-rotation-tester/README.md`, `tools/proxy-rotation-tester/src/lib.test.ts`, and `.claude/commands/proxy-test.md`; and the removed `--save jsonl` format (dropped in `prompts/2026-05-12-remove-jsonl-saving`) still appears in `.claude/commands/autonomous/maintenance/sync/docs.md`. Note `list --format jsonl` (dataset read format) was intentionally kept and is unrelated.