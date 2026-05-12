# sync-gui Report
**Date:** 2026-05-12

## Files Read

| Surface | File |
|---------|------|
| Zod schema (canonical) | `packages/schema/src/source-of-truth/input.ts` |
| TS engine (canonical) | `packages/extraction/src/index.ts` |
| napi-rs binding | `packages/extraction/native/src/lib.rs` |
| Standalone CLI | `apps/standalone/src/cliProgram.ts`, `apps/standalone/src/config.ts`, `apps/standalone/src/cli.ts` |
| Apify schemas | `apps/apify-actor/.actor/input_schema.json`, `output_schema.json`, `dataset_schema.json`, `actor.json` |
| Apify Actor TS | `apps/apify-actor/src/{main.ts,run.ts,extraction.ts,sinks.ts,config.ts}` |

## Checks Run

### Zod schema ⇄ generated INPUT_SCHEMA.json — PASS

`pnpm --filter @contextractor/schema test` passed all 43 tests, including the snapshot test that
compares `toApifyInputSchema(ContextractorInput)` byte-for-byte against
`apps/apify-actor/.actor/input_schema.json`. The JSON was NOT regenerated — the on-disk file was
already in sync.

### docs:update — PASS

`pnpm docs:update` updated 0 files. `git diff --exit-code -- '**/*.md'` is clean.

### TS engine ⇄ napi-rs binding — PASS

All 15 `TrafilaturaConfig` fields in the TS engine have matching `#[napi(object)]` fields in
`lib.rs` (snake_case in Rust, auto-converted to camelCase by napi-derive). Function signatures
match for `extract`, `extractMetadata`, `extractAllFormats`.

Fields forwarded all the way to rs-trafilatura: `fast`, `favorPrecision`, `favorRecall`,
`includeComments`, `includeTables`, `includeImages`, `includeFormatting`, `includeLinks`,
`deduplicate`, `onlyWithMetadata`, `targetLanguage`, `authorBlacklist`.

Fields accepted by napi-rs binding but intentionally not forwarded to rs-trafilatura 0.2.x:
`withMetadata`, `teiValidation`, `urlBlacklist` (documented in `build_rs_options` comments).

### Default values — PASS

`DEFAULT_CONFIG` in TS is always passed explicitly through `toNativeConfig`, so Rust's
`RsOptions::default()` is always overridden by the TS-side defaults. No ambiguity.

### OutputFormat union — PASS

TS engine: `'txt' | 'markdown' | 'json' | 'html'`
napi-rs: `Txt | Markdown | Json | Html` (strings "txt" | "markdown" | "json" | "html")
`FORMAT_EXTENSIONS` (crawler package): `{txt: '.txt', markdown: '.md', json: '.json', html: '.html'}`

No `xml` or `xmltei` present anywhere except in the napi-rs test that explicitly confirms they
are rejected.

### No-op fields — PASS

`pruneXpath` and `dateExtractionParams` do not appear anywhere in the codebase.

### Actor metadata — PASS

- `actor.json.name`: `"contextractor-test"` ✅
- `actor.json.dockerContextDir`: `"../../.."` ✅
- `actor.json.description`: mentions both "rs-trafilatura" and "Crawlee" ✅

### Workspace deps — PASS

Both apps declare `@contextractor/extraction: "workspace:*"` and `@contextractor/schema: "workspace:*"`.

## Auto-fixes Applied

None. All surfaces were already consistent; no regeneration was needed.

## Issues for Human Review

See `autonomous-task-output/sync-gui/prompts/sync-gui-prompt.md` for the full prompt.

### Issue A — `jsonl` format: CLI supports it, Zod schema and Apify Actor do not

**Where:** `apps/standalone/src/config.ts:SaveFormat`, `apps/standalone/src/cliProgram.ts` (`--save` help text)

**Detail:** The CLI's `--save` flag accepts `jsonl` (handled via `resolveCliOnly`), but the Zod
schema's `save` field is `z.array(z.enum(['txt', 'markdown', 'json', 'html', 'original']))` — no
`jsonl`. Consequence: `--save jsonl` works fine from CLI flags, but `save: ["jsonl"]` in a JSON
config file (via `--config`) fails Zod validation with an unrecognized enum error.

**Decision needed:** Either add `jsonl` to the Zod schema (making it available in config files and
Apify Actor input), or document that `jsonl` is CLI-flags-only and cannot appear in a JSON config
file.

### Issue B — Five Zod schema fields have no CLI flags

| Zod field | Reason missing |
|-----------|----------------|
| `pseudoUrls` | Apify Actor UI editor-type specific; not meaningful for CLI URL inputs |
| `keyValueStoreName` | Apify Actor-specific storage reference |
| `requestQueueName` | Apify Actor-specific storage reference |
| `debugLog` | `--verbose` sets `LOG_LEVEL=DEBUG` with similar effect but different code path (`run.ts` reads `input.debugLog` while CLI uses env var) |
| `browserLog` | No CLI equivalent |

These omissions may be intentional. Confirming that is all that's needed — no code change
required unless the CLI should support these fields via `--config` input files (in which case
they'd work automatically since they're already in the Zod schema).

### Issue C — `urlBlacklist` is forwarded from TS engine to napi-rs but silently dropped

**Where:** `packages/extraction/native/src/lib.rs:build_rs_options`

The TS engine's `DEFAULT_CONFIG` has `urlBlacklist: null` and `normalizeConfigKeys` can populate
it from user input. The value is forwarded in `toNativeConfig` to the napi-rs binding. The
binding accepts it but discards it (same group as `withMetadata` and `teiValidation`). This is
documented with a comment. Unlike `authorBlacklist`, which IS forwarded to rs-trafilatura.

No action needed unless rs-trafilatura 0.2.x gains URL blacklist support, at which point
`build_rs_options` should wire it through.
