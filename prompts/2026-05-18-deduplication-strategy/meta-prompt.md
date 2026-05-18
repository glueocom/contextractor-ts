see those researches
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-18-deduplication-strategy/context/research-claude-code.md`
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-18-deduplication-strategy/context/research-claude-desktop.md`

save a prompt to one file at `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-18-deduplication-strategy/prompt.md`

The prompt must:
- implement or fix deduplication in contextractor CLI NPM lib and Apify Actor
- add a parameter to CLI — decide if it should be a boolean or an enumeration like `"none" | "basic" | "full"` (figure out the right names)
- update all docs: SPEC.md files, READMEs, and CLI user-facing messages

# Contextractor Deduplication — Context

Three deduplication layers exist today:

- **Crawlee URL dedup** — always on, deduplicates by normalized URL (`uniqueKey`) before fetch
- **Canonical URL dedup** — enabled by default via `--ignore-canonical-url`; reads `<link rel="canonical">`, tracks seen canonicals in a `Set<string>`; **gap: Playwright handler only** — not in Cheerio or Adaptive
- **Trafilatura intra-document dedup** — disabled (`deduplicate: false` hardcoded); drops repeated elements (nav, footer) within a single page extraction via LRU cache

MD5 hashes of raw HTML are already computed in all three handlers but are not used for cross-document deduplication.
