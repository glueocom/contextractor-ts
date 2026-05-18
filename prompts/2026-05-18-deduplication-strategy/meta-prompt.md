see thosse ressearches 
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-18-deduplication-strategy/context/research-claude-code.md`
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-18-deduplication-strategy/context/research-claude-desktop.md`

save a prompt to one file at `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-18-deduplication-strategy/prompt.md

The prompt must: 
- implement or fix deduplication in contextractor CLI NPM lib and apify actor
- add a parameter to clI. Decite if the parameter should be just boolean like or if it should be some enumeration like "none" "basic" "full" (figure out the enumeration names, those are examples only)
- update all the docs SPEC.md and readme files, update the messages in the CLI what is writting to the user

# Contextractor Deduplication Strategy Design

**Project**: [Contextractor](https://www.contextractor.com/) — Apify Actor + standalone CLI built on:
- [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura) — Rust extraction engine
- [Crawlee](https://crawlee.dev/) — Playwright/Cheerio crawler

## Verified: Both libraries have deduplication, but of different kinds

**Trafilatura deduplication** (content-level, intra-document):
- LRU cache frequency counter — exact text match, not fuzzy/near-duplicate
- Drops repeated paragraphs/elements within a single extraction call (not cross-document)
- Controlled via `Options { deduplicate: bool, dedup_cache_size: usize, max_duplicate_ratio: f64 }`
- Default: disabled (`deduplicate: false`)

**Crawlee deduplication** (URL-level):
- RequestQueue deduplicates on `uniqueKey` (normalized URL by default — lowercase, ordered query params, fragment stripped)
- Always on — duplicate URLs are silently dropped before crawling

**What Contextractor already adds on top**:
- Canonical URL deduplication: reads `<link rel="canonical">`, tracks seen canonicals in a `Set<string>`, skips pages whose canonical was already extracted
- Enabled by default; disabled by `--ignore-canonical-url`
- **Gap**: only implemented in the Playwright handler — not in Cheerio or Adaptive handlers

## Design Task

Design an integrated deduplication strategy for Contextractor. Deeply investigate each option:

**A)** Combine Trafilatura's intra-document content deduplication with Crawlee's URL deduplication — enable both, investigate how they complement each other and what each covers

**B)** Use only Trafilatura's content deduplication, drop reliance on Crawlee's URL deduplication

**C)** Use only Crawlee's URL deduplication, drop Trafilatura's content deduplication entirely

**D)** Something else? (e.g., cross-document content hash deduplication using already-computed MD5 hashes per extraction, SimHash near-duplicate detection, extending canonical URL dedup to all handler types)

For each option assess: what problem it solves, what it leaves uncovered, implementation complexity, performance implications (in-memory vs persistent, per-document vs crawler-wide), and whether it should be user-configurable or always-on.
