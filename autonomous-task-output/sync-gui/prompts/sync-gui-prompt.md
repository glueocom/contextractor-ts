# Human Review Needed — sync-gui

Three items surfaced during the sync-gui consistency check on 2026-05-12.
All other checks passed cleanly; no auto-fixes were applied.

---

## Decision A — `jsonl` save format: add to Zod schema or document as CLI-only?

**Background:** The CLI's `--save` flag lists `markdown,html,txt,json,jsonl,original,all` in its
help text and processes `jsonl` via `resolveCliOnly` (bypasses Zod). The Zod schema's `save` field
only accepts `['txt', 'markdown', 'json', 'html', 'original']`.

**Consequence:** `--save jsonl` works fine from CLI flags. But `save: ["jsonl"]` in a JSON config
file (`--config config.json`) fails Zod validation with an unrecognized enum error, and
`save: ["jsonl"]` in Apify Actor input would also fail.

**Options:**

**Option 1 — Add `jsonl` to the Zod schema** (`packages/schema/src/source-of-truth/input.ts`)
- Change `z.enum(['txt', 'markdown', 'json', 'html', 'original'])` to include `'jsonl'`
- Regenerate `apps/apify-actor/.actor/input_schema.json` via `pnpm --filter @contextractor/gen-input-schema start`
- Pros: Config files and Actor input accept `jsonl`
- Cons: Apify Actor would expose `jsonl` as a valid save format in the UI, but the Actor's `sinks.ts` doesn't implement JSONL output — it would silently produce nothing

**Option 2 — Document `jsonl` as CLI-flags-only** (no code change)
- Update the `--save` help text to note "jsonl is CLI-only and cannot be set via JSON config"
- Pros: Simple; no schema change needed
- Cons: The discrepancy between CLI flag help and config file behavior remains

**Recommendation:** Option 2 is safer until the Apify Actor sink also gains JSONL output. If you
want JSONL from both Actor and CLI, implement it in `apps/apify-actor/src/sinks.ts` first, then
add it to the Zod schema.

---

## Decision B — Five Zod fields with no CLI flags: intentional or gaps?

These Zod schema fields have no corresponding `--flag` in `addExtractionOptions`:

| Field | Notes |
|-------|-------|
| `pseudoUrls` | Apify Actor pseudo-URL pattern editor. CLI uses glob-based `--globs` instead. |
| `keyValueStoreName` | Lets Actor target a specific KVS. CLI has a `kvs` subcommand for manual operations. |
| `requestQueueName` | Lets Actor target a specific request queue. CLI doesn't use named queues. |
| `debugLog` | Actor reads `input.debugLog`; CLI reads `LOG_LEVEL` env var via `--verbose`. Different code paths with same effect. |
| `browserLog` | No CLI equivalent. |

**If these are intentional omissions:** No action needed. A comment in `buildSchemaOverrides`
documenting that these fields are Actor-only would help future readers.

**If `debugLog`/`browserLog` should be reachable via `--config` file:** They already are, since
the config file is parsed by `ContextractorInput.safeParse`. Passing `{"debugLog": true}` in a
JSON config file works today. The missing part is only a `--debug-log`/`--browser-log` shorthand
CLI flag.

---

## Note C — `urlBlacklist` accepted but dropped (informational, no action needed)

`TrafilaturaConfig.urlBlacklist` exists in the TS engine and napi-rs binding and is forwarded by
`toNativeConfig`, but `build_rs_options` in `lib.rs` explicitly discards it (same group as
`withMetadata` and `teiValidation`) because rs-trafilatura 0.2.x has no backing field. This is
documented in the Rust code with a comment.

`authorBlacklist` by contrast IS forwarded to rs-trafilatura.

When rs-trafilatura gains URL blacklist support, the only change needed is in `build_rs_options` —
add `if let Some(v) = cfg.url_blacklist.as_ref() { rs.url_blacklist = Some(v.clone()); }`.
