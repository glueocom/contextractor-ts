# Contextractor Deduplication Strategy Design

## Bottom line

The best design for Contextractor is not A, B, or C in isolation. It is a layered variant of D:

- Keep Crawlee URL deduplication as the always-on, pre-fetch baseline.
- Extend Contextractor's own post-fetch URL identity deduplication to every handler, not just Playwright.
- Treat Trafilatura deduplication as optional extraction cleanup, not as the main dedup layer.
- Add a separate exact-content dedup layer on normalized extracted text if Contextractor wants unique-content output, with persistence as an explicit choice.
- Keep near-duplicate detection optional and advanced.

In short:

- Crawlee answers "have I already attempted this URL identity?"
- Canonical and redirect-aware dedup answer "did this page resolve to the same page as another URL?"
- Exact content hash answers "did two different pages produce the same extracted content?"
- SimHash answers "did two pages produce almost the same content?"
- Trafilatura dedup answers "should repeated segments inside this extraction be removed before output?"

These are complementary, not interchangeable.

## Current repo reality

### What exists today

- Crawlee request dedup is already active everywhere because all handlers enqueue through Crawlee and therefore go through `RequestQueue` / `uniqueKey` behavior.
- Playwright has an extra canonical URL dedup step in `packages/crawler/src/handler.ts:78-90`.
- Canonical dedup is enabled by default and can be disabled with `ignoreCanonicalUrl`:
  - schema: `packages/schema/src/source-of-truth/input.ts:113-119`
  - CLI: `apps/standalone/src/cliProgram.ts:249-252`
- Trafilatura's `deduplicate` flag exists in the TypeScript wrapper and the Rust binding:
  - TS config type: `packages/extraction/src/index.ts:38-54`
  - Rust binding forwards `deduplicate` to `rs_trafilatura::Options`: `packages/extraction/native/src/lib.rs:225-227`
- The crawler hardcodes Trafilatura dedup off in `packages/crawler/src/createCrawler.ts:92-111`, specifically `deduplicate: false` at `line 102`.
- Contextractor already computes hashes, but only for reporting/output:
  - raw HTML MD5 in handler: `packages/crawler/src/handler.ts:92`, `172`, `226`
  - hash helper: `packages/extraction/src/contentInfo.ts:8-13`
  - per-format hashes are written in sinks, not used for dedup decisions:
    - actor sink: `apps/apify-actor/src/sinks.ts:78-89`
    - standalone sink: `apps/standalone/src/sinks.ts:54-60`

### Current gaps that matter

- Canonical dedup only exists in the Playwright handler. It is absent from:
  - `createCheerioHandler()` in `packages/crawler/src/handler.ts:154-203`
  - `createAdaptiveHandler()` in `packages/crawler/src/handler.ts:205-257`
- The success path does not currently preserve Crawlee's `request.loadedUrl`.
  - `ExtractionResult` only carries `url`, not `loadedUrl`: `packages/crawler/src/sinks/types.ts:5-14`
  - the actor sink writes `loadedUrl: result.url`: `apps/apify-actor/src/sinks.ts:52-59`
  - the standalone dataset sink writes `url: result.url`: `apps/standalone/src/sinks.ts:47-53`
- The current canonical dedup logic uses a regex on raw HTML and stores the raw `href` string. It does not resolve relative canonicals against the loaded URL.
- Contextractor does not currently expose upstream Trafilatura tuning knobs like `dedup_cache_size` or `max_duplicate_ratio`; only the boolean flag is wired through the wrapper.

That means Contextractor today is best described as:

- strong pre-fetch URL dedup via Crawlee
- partial post-fetch canonical dedup via Playwright only
- no exact cross-document content dedup
- no near-duplicate detection
- no redirect-aware success-path dedup because `loadedUrl` is not propagated

## Upstream behavior that should shape the design

### rs-trafilatura

`rs-trafilatura` exposes dedup-related options on `Options`:

- `deduplicate: bool`
- `dedup_cache_size: usize`
- `max_duplicate_ratio: f64`

Docs.rs describes this as an LRU-cache-based duplicate text segment filter, defaulting to:

- `deduplicate = false`
- `dedup_cache_size = 1000`
- `max_duplicate_ratio = 0.5`

Important interpretation:

- this is extraction-time content-segment dedup
- it is not a crawler frontier dedup layer
- it is not a persistent cross-run dedup layer
- it is not near-duplicate detection

So even if enabled, it helps clean extraction output, but it does not remove the need for URL-level and document-level dedup.

### Crawlee

Crawlee's `RequestQueue` deduplicates requests by `uniqueKey`.

- By default, `uniqueKey` is derived from a normalized URL.
- Crawlee docs describe this as lowercasing, query-order normalization, fragment removal, and similar normalizations.
- Duplicate requests are rejected before processing.

Important interpretation:

- this saves fetch cost, browser cost, proxy cost, and extraction cost
- it only knows URL identity, not content identity
- it cannot see canonical tags before fetch
- it cannot decide based on extracted text
- it can be overridden by custom `uniqueKey`, but doing so to weaken dedup would be a deliberate regression for Contextractor

## Option A: combine Trafilatura intra-document dedup with Crawlee URL dedup

### What problem it solves

- Crawlee blocks duplicate normalized URLs before fetch.
- Trafilatura removes repeated text segments within extraction output.
- Together they cover two different layers of duplication:
  - request duplication
  - repeated segments inside one extraction

This is a coherent combination because the two systems do different jobs.

### What it leaves uncovered

- different URLs returning the same extracted content
- redirect aliases unless Contextractor starts using `loadedUrl`
- canonical aliases in Cheerio and Adaptive until the current handler gap is fixed
- near-duplicates such as lightly edited syndicated articles
- cross-run dedup unless state is explicitly persisted somewhere

Option A improves output cleanliness and crawl efficiency, but it does not solve Contextractor's larger duplicate-content problem.

### Implementation complexity

Low to medium.

Low if the change is only:

- change `deduplicate: false` to `true` in `toTrafilaturaConfig()`

Medium if Contextractor also wants:

- a user-facing flag for Trafilatura dedup
- wrapper support for `dedup_cache_size` and `max_duplicate_ratio`
- tests showing what enabling it does on real-world pages

### Performance implications

- Crawlee URL dedup is cheap and saves the most money because it happens before network/browser work.
- Trafilatura dedup adds some CPU and memory inside extraction, but it is bounded and local to the extraction process.
- Neither layer requires additional persistent state beyond the request queue.

### Should it be configurable or always-on?

- Crawlee URL dedup should remain always-on.
- Trafilatura dedup should be user-configurable, not mandatory.

Reason:

- it changes extracted content, not just crawl control
- Contextractor does not currently expose the upstream tuning knobs
- some users may want exact extraction behavior even if repeated blocks remain

### Verdict

Reasonable as a baseline improvement, but insufficient as the whole strategy.

## Option B: use only Trafilatura content dedup and drop reliance on Crawlee URL dedup

### What problem it solves

- repeated segments inside an extraction
- some apparent duplicate-looking output if two pages share exact repeated chunks

### What it leaves uncovered

- duplicate URLs still get fetched
- duplicate URLs still consume browser and proxy resources
- different URLs with different wrappers around the same content still get crawled fully
- cross-run dedup still does not exist
- canonical aliases still need a separate mechanism
- near-duplicates still are not solved

### Implementation complexity

Medium to high, mostly because dropping reliance on Crawlee would mean fighting the framework.

In practice, Contextractor currently uses Crawlee request management everywhere. To weaken or bypass that dedup you would need to deliberately alter `uniqueKey` behavior or change queue strategy. That adds complexity and makes the crawler worse.

### Performance implications

Negative.

- duplicate pages would still be fetched
- duplicate pages would still be rendered in Playwright
- Trafilatura dedup runs after the expensive work has already happened

This is exactly the wrong place to remove dedup if cost matters.

### Should it be configurable or always-on?

Neither. This should not be the strategy.

### Verdict

Not viable.

URL dedup and content dedup are not substitutes. A crawler should reject obvious duplicate requests before paying to load the page.

## Option C: use only Crawlee URL dedup and drop Trafilatura content dedup entirely

### What problem it solves

- repeated normalized URLs are not re-crawled
- duplicate fragments are ignored unless `keepUrlFragments` is enabled
- query-order noise and similar URL variations are normalized away
- this is cheap and happens at the right stage of the pipeline

### What it leaves uncovered

- different URLs with the same article body
- redirect aliases if success-path `loadedUrl` is not used
- canonical aliases outside the Playwright handler
- repeated boilerplate or repeated segments inside extracted content
- near-duplicate content
- cross-run content identity unless the same queue is deliberately reused

### Implementation complexity

Very low. This is close to the current state already.

### Performance implications

- best pre-fetch savings
- minimal memory overhead beyond Crawlee storage
- no additional state management

### Should it be configurable or always-on?

Always-on.

This is the safest, cheapest baseline dedup layer and should not be user-toggled off as part of normal Contextractor behavior.

### Verdict

Necessary, but not sufficient.

If Contextractor only wants "don't crawl the same normalized URL twice," option C is enough. If it wants "don't output the same content multiple times," option C is too weak.

## Option D: layered dedup beyond A/B/C

This is the right direction.

The most practical design is a stack of small, clear layers:

### D0: keep Crawlee URL dedup as the pre-fetch guard

Purpose:

- reject obvious duplicate URLs before fetch

Scope:

- crawler-wide
- backed by Crawlee request storage
- persistent only as long as the underlying queue is preserved/reused

Configurability:

- always-on

### D1: add redirect-aware identity dedup on `loadedUrl`

Purpose:

- catch multiple input URLs that resolve to the same final HTTP destination

Why this matters in Contextractor:

- `request.loadedUrl` exists in Crawlee, but success-path extraction results currently do not carry it
- actor output currently labels `result.url` as `loadedUrl`, which is not the same thing

Implementation:

- extend `ExtractionResult` to include `loadedUrl`
- use `request.loadedUrl ?? request.url` in every handler
- maintain an in-memory `seenLoadedUrls` set per crawl
- optionally emit both `requestedUrl` and `loadedUrl` in output so users can audit what was deduplicated

What it solves:

- redirect chains
- alias URLs that end at the same destination

What it leaves uncovered:

- canonical aliases that do not redirect
- same content under different final URLs
- near-duplicates

Configurability:

- I would keep this always-on once implemented because it reflects actual network identity and has low surprise factor

### D2: extend canonical URL dedup to all handlers

Purpose:

- catch pages that declare the same canonical even when fetched from different URLs

Implementation:

- move canonical extraction into shared code used by Playwright, Cheerio, and Adaptive handlers
- resolve relative canonical `href` values against `request.loadedUrl ?? request.url`
- store normalized absolute canonical URLs in the seen set
- keep the existing `ignoreCanonicalUrl` opt-out

What it solves:

- canonical alias pages across all crawler types
- the current Playwright-only gap

What it leaves uncovered:

- broken canonical tags
- pages with no canonical tag
- content duplicates that intentionally point to different canonicals
- near-duplicates

Performance:

- very cheap
- in-memory set only
- no extra persistence required

Configurability:

- default on, user-configurable off

This matches current product semantics, only with complete handler coverage.

### D3: exact cross-document content hash dedup on normalized extracted text

Purpose:

- catch genuinely identical extracted content across different URLs

Key design choice:

- hash extracted text, not raw HTML

Why not raw HTML MD5?

- Contextractor already computes raw HTML MD5, but that is too sensitive to wrapper noise
- two pages with the same article inside slightly different DOMs will not match

Why not reuse sink hashes as-is?

- they are computed after dedup decisions would need to happen
- they depend on whichever formats the user chose to save

Recommended implementation:

- choose a canonical dedup input, ideally normalized `txt`
- normalize whitespace and trivial formatting noise before hashing
- compute a new exact hash specifically for dedup decisions
- use an in-memory `Set<string>` for within-run dedup
- make cross-run persistence an explicit add-on using named storage

Hash algorithm:

- MD5 is probably acceptable for accidental duplicate detection in a non-adversarial crawl
- for new persisted dedup state, prefer SHA-256 because the performance difference is negligible and the semantics are clearer

What it solves:

- mirrors
- syndicated exact copies
- duplicate printer/mobile variants when extracted text is the same
- duplicate pages that survive URL and canonical dedup

What it leaves uncovered:

- lightly edited duplicates
- same article plus one extra promo block
- legitimate separate URLs that intentionally share identical content

Implementation complexity:

Medium.

Main reason it is not trivial: handlers currently call `extract()` separately per output format. If Contextractor wants hash-on-text even when the user did not request `txt`, it should probably refactor toward a single extraction pass, for example via `extractAllFormats()` or a new single-pass extraction result object.

Performance:

- within-run in-memory exact hash dedup is cheap
- persistent cross-run dedup adds storage I/O and state management
- exact hash lookup is still much cheaper than near-duplicate search

Configurability:

- within-run exact content dedup should be user-configurable
- cross-run persistence should be opt-in

I would not make cross-document content dropping silently always-on in the first release, because it changes the product from "one record per crawled page" toward "one record per unique content body."

### D4: optional SimHash near-duplicate detection

Purpose:

- catch pages that are almost the same, not just exactly the same

What it solves:

- syndicated articles with small edits
- article pages differing only by repeated boilerplate or tiny insertions
- template-heavy duplicates that exact hashes miss

What it leaves uncovered

- semantically similar but heavily rewritten text
- page families where near-duplicate thresholds are hard to tune safely

Implementation complexity:

Medium to high.

- naive comparison against every seen fingerprint does not scale well
- threshold tuning is product-sensitive
- false positives are harder to explain than exact-hash matches

Performance:

- higher CPU than exact hashing
- higher memory footprint if the crawl corpus is large
- may need bucketing/LSH if used at scale

Configurability:

- opt-in only
- expose threshold explicitly

This is the right last layer, not the first one to ship.

## Recommendation

### Recommended architecture

Use a four-layer design:

1. Crawlee `uniqueKey` dedup, always-on
2. Redirect-aware and canonical URL dedup across all handlers, default on
3. Optional exact-content dedup on normalized extracted text
4. Optional near-duplicate detection for advanced use cases

Trafilatura dedup should sit beside layer 3 as extraction cleanup, not replace any of the other layers.

### Recommended defaults

- Crawlee URL dedup: always-on
- redirect-aware `loadedUrl` dedup: always-on
- canonical URL dedup: default on, existing opt-out retained
- Trafilatura `deduplicate`: configurable, default off until validated on representative sites
- exact content hash dedup within run: configurable, default off in the first release
- exact content hash persistence across runs: opt-in
- SimHash near-duplicate dedup: opt-in only

### Why this is the best fit for Contextractor

- It preserves the huge cost win from Crawlee's pre-fetch dedup.
- It fixes a real repo bug/gap: canonical dedup is currently Playwright-only.
- It adds redirect-awareness, which the current success path lacks.
- It uses content hashing only where content hashing is actually the right tool: cross-document identity, not crawl frontier management.
- It avoids overloading Trafilatura with responsibilities it was not designed to own.

## Phased implementation plan

### Phase 1: harden URL identity dedup

- propagate `loadedUrl` through successful extraction results
- fix actor and standalone outputs so requested URL and loaded URL are represented correctly
- add `seenLoadedUrls`
- move canonical extraction into shared handler code
- resolve canonical URLs against `loadedUrl`
- extend canonical dedup to Cheerio and Adaptive

This phase is high value, low risk, and does not need new persistence.

### Phase 2: add exact content dedup

- define a normalized text fingerprint input
- compute exact hash before sink output
- maintain an in-memory seen-hash set for the crawl
- add metrics: total seen, duplicates skipped, duplicates by layer
- optionally refactor extraction to single-pass so the hash does not require extra extraction work

### Phase 3: add persistent exact-content dedup

- add named storage for hash membership
- keep this opt-in so persistence semantics stay explicit
- decide whether duplicates are dropped, tagged, or written as audit records

### Phase 4: evaluate near-duplicate mode

- add SimHash only if users clearly need "same article with small edits" dedup
- ship behind explicit config

## Final assessment of A/B/C/D

- A is useful but incomplete.
- B is a bad trade and should be rejected.
- C is the necessary baseline but not a full dedup strategy.
- D, implemented as a layered system, is the correct design.

If I had to summarize the recommendation in one sentence:

Keep Crawlee for pre-fetch URL dedup, fix and generalize Contextractor's post-fetch URL identity dedup, and add exact-content hashing only as a separate optional document-level layer.

## Sources

### Local code

- `packages/crawler/src/createCrawler.ts`
- `packages/crawler/src/handler.ts`
- `packages/crawler/src/sinks/types.ts`
- `packages/extraction/src/index.ts`
- `packages/extraction/native/src/lib.rs`
- `packages/extraction/src/contentInfo.ts`
- `packages/schema/src/source-of-truth/input.ts`
- `apps/standalone/src/cliProgram.ts`
- `apps/apify-actor/src/sinks.ts`
- `apps/standalone/src/sinks.ts`

### Upstream docs

- rs-trafilatura options:
  - `https://docs.rs/rs-trafilatura/latest/rs_trafilatura/struct.Options.html`
- Crawlee RequestQueue:
  - `https://crawlee.dev/js/api/core/class/RequestQueue`
- Crawlee Request:
  - `https://crawlee.dev/js/api/core/class/Request`
- Crawlee adding URLs / duplicate URL behavior:
  - `https://crawlee.dev/js/docs/introduction/adding-urls`
