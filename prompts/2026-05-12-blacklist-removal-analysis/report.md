# Blacklist Functionality Removal Analysis

Date: 2026-05-12

## What Exists

The repo exposes two blacklist fields across all layers: TypeScript interface, NAPI-RS binding, and Rust wrapper.

### `urlBlacklist: string[] | null`

Declared in:
- `packages/extraction/src/index.ts:54` — `TrafilaturaConfig` interface
- `packages/extraction/src/index.ts:73` — `DEFAULT_CONFIG` (default `null`)
- `packages/extraction/src/index.ts:244` — `toNativeConfig()` passes it through
- `packages/extraction/native/index.d.ts:29` — NAPI-RS binding declaration
- `packages/extraction/native/src/lib.rs:40` — Rust struct field
- `SPEC.md:82` — documented in field table
- `packages/extraction/SPEC.md:28` — referenced

**Status: no-op.** `lib.rs:244–250` explicitly discards it:

```rust
// `with_metadata`, `tei_validation`, `url_blacklist` are accepted but
// not forwarded — rs-trafilatura 0.2.x has no backing fields.
let _ = (
    cfg.with_metadata,
    cfg.tei_validation,
    cfg.url_blacklist.as_ref(),
);
```

rs-trafilatura (`Options` struct) does not expose a `url_blacklist` field at all. The field was added as a forward-compat placeholder anticipating a future rs-trafilatura version that has not arrived.

### `authorBlacklist: string[] | null`

Declared in the same files. **Status: functional.** `lib.rs:236–238` forwards it to rs-trafilatura:

```rust
if let Some(v) = cfg.author_blacklist.as_ref() {
    rs.author_blacklist = Some(v.clone());
}
```

rs-trafilatura `Options.author_blacklist` does the substring-case-insensitive match against extracted author metadata. It clears the `author` field when any provided string matches — it does not drop the document.

## What Each Field Does in Trafilatura

| Field | Python trafilatura | rs-trafilatura (Rust) |
|---|---|---|
| `url_blacklist` | Drops entire document when URL is in set | **Not present** |
| `author_blacklist` | Clears author field (substring, case-insensitive) | Present — same behavior |

## Exposure in This Repo

Neither field is exposed as a named Actor input schema field. Both are only reachable via the `trafilaturaConfig` passthrough object (Apify Actor and standalone CLI). No tests cover either field in the TypeScript layer.

## Recommendation: Remove Both

### Remove `urlBlacklist` — straightforward

It is a complete no-op today and has been since it was added. Callers who pass it get silent incorrect behavior (they think URLs are being excluded; nothing happens). URL filtering already has the correct home: the crawler-layer `excludes` glob field in the Actor input schema, handled by Crawlee before pages even reach the extractor.

Forward-compat argument does not hold: if rs-trafilatura ever adds `url_blacklist`, it will be a different API (e.g., a `Set<String>`, not `Vec<String>`), and we would need to revisit the binding anyway. Keeping a dead no-op adds confusion and false documentation.

### Remove `authorBlacklist` — also recommended

It is functional but the use case is outside the Actor's scope:

- **What it's for:** research corpus pipelines that need clean author attribution — suppressing CMS-generated ghost bylines ("Watermark feed", "Sydneyanglicans net"). Originated in trafilatura PR #110 (Oct 2021) for academic NLP corpus construction.
- **What this Actor is for:** general-purpose web content extraction for LLM context, search indexing, RAG pipelines — use cases that typically don't care about author metadata accuracy at all.
- No tests cover it.
- Not exposed in the Actor schema — callers cannot discover it without reading source.
- Adds API surface area and maintenance burden for a niche research workflow.

If a future use case requires author filtering, it can be added at the time with tests and schema exposure. Keeping it now just for forward-compat with a niche use case that isn't exercised is not worth the dead weight.

## Files to Change

If removing both fields:

- `packages/extraction/native/src/lib.rs` — remove struct fields `url_blacklist` and `author_blacklist`; remove the forwarding block for `author_blacklist`; remove the `let _ = (...)` discard tuple
- `packages/extraction/native/index.d.ts` — remove `urlBlacklist?` and `authorBlacklist?` (auto-generated, but must be regenerated)
- `packages/extraction/src/index.ts` — remove both fields from `TrafilaturaConfig`, `DEFAULT_CONFIG`, and `toNativeConfig()`
- `SPEC.md` — remove both rows from the field table
- `packages/extraction/SPEC.md` — remove the reference in the filter fields sentence
- `packages/extraction/README.md` — remove "URL deny list" and "Author deny list" entries (if present)

No test file changes needed — neither field has tests.

## Verdict

**Yes, safe to remove both.** `urlBlacklist` does nothing. `authorBlacklist` does something narrow that is out of scope for this Actor. Neither is tested, neither is exposed in the Actor schema, and removing them shrinks the API surface without breaking any real use case.
