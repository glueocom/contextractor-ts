# Contextractor Deduplication — Research Context

Generated: 2026-05-18

---

## Current State in Codebase

### Canonical URL Deduplication (implemented, partial)

**File:** `packages/crawler/src/handler.ts`

- Only the **Playwright handler** implements canonical URL deduplication (lines 78–90).
- Parses `<link rel="canonical">` from raw HTML with a regex. Uses a `Set<string>` (`seenCanonicals`) closed over by the handler function — shared across all pages in the same crawl run.
- Skips the page if canonical differs from the fetched URL and has already been seen.
- **Gap:** The **Cheerio handler** and **Adaptive handler** have no canonical deduplication at all.
- Configured via `ignoreCanonicalUrl` (schema: `packages/schema/src/source-of-truth/input.ts` lines 113–119). Default: `false` (deduplication enabled).
- CLI flag: `--ignore-canonical-url` (`apps/standalone/src/cliProgram.ts` line 250).

### Trafilatura Intra-Document Deduplication (disabled)

**File:** `packages/crawler/src/createCrawler.ts` line 102

```typescript
deduplicate: false,  // hardcoded off in toTrafilaturaConfig
```

The `deduplicate` flag is threaded through `TrafilaturaConfig` → `toNativeConfig` → `lib.rs` → `rs-trafilatura`, but it is hardcoded to `false` in the crawler's config builder. No user-facing option exposes it.

### Crawlee URL Deduplication (always on, automatic)

All three handlers call `context.enqueueLinks()` (Playwright: line 139, Cheerio: line 276, Adaptive: line 321). Crawlee's `RequestQueue` deduplicates on `uniqueKey` automatically — no explicit code needed in Contextractor.

### MD5 Hashes (computed, not used for deduplication)

MD5 hashes are already computed for raw HTML in all three handlers:

```typescript
// handler.ts lines 92, 172, 226
const { hash: rawHtmlHash, length: rawHtmlLength } = computeContentInfo(html);
```

`computeContentInfo` (`packages/extraction/src/contentInfo.ts`) returns `{ hash: string, length: number }` where hash is the MD5 hex digest. These hashes are included in the output record but are not checked against a seen-hashes set — they are not currently used for cross-document deduplication.

---

## Library Facts (Verified from Source)

### Trafilatura Deduplication — Corrected Details

The prompt mentions `dedup_cache_size` and `max_duplicate_ratio` — **these are not real parameter names**. Actual internals from `trafilatura/deduplication.py`:

- **What it operates on:** LXML elements (paragraph/heading/div level), not sentences.
- **Matching:** Exact string match on `trim()` of full element text. No fuzzy matching.
- **Cache size:** `LRU_SIZE = 4096` entries (from `settings.py`). Controlled by `LRU_TEST = LRUCache(maxsize=LRU_SIZE)`.
- **Skip threshold:** `min_duplcheck_size = 100` characters — elements shorter than this are not checked.
- **Drop threshold:** `max_repetitions = 2` — element is dropped when seen more than twice.
- **Scope:** The LRU cache is a **global singleton** shared across all extraction calls within a process. It is NOT reset between pages — if a paragraph text appears on pages 1 and 2 of a crawl, the second occurrence is dropped as a duplicate (cross-document side effect).
- **Thread safety:** Protected by `RLock`.

#### Trafilatura Simhash (separate feature)

`trafilatura.deduplication.Simhash` and `content_fingerprint()` implement document-level fingerprinting:
- Tokenizes text, hashes tokens with `blake2b`, builds a 64-bit vote vector.
- `similarity(other)` returns float 0.0–1.0 via Hamming distance: `(64 - hamming) / 64`.
- This is **not exposed** to rs-trafilatura's current API — it is a Python-side tool for post-crawl deduplication workflows.
- Example: "This is a text." vs "This is a test." → similarity 0.84375.

### Crawlee RequestQueue — Verified Normalization

`Request.computeUniqueKey` source (`packages/core/src/request.ts`):

```typescript
static computeUniqueKey({ url, method = 'GET', payload, keepUrlFragment = false, useExtendedUniqueKey = false }) {
  const normalizedUrl = normalizeUrl(url, keepUrlFragment) || url;
  if (!useExtendedUniqueKey) return normalizedUrl;
  const payloadHash = payload ? Request.hashPayload(payload) : '';
  return `${normalizedMethod}(${payloadHash}):${normalizedUrl}`;
}
```

Normalizations applied by `normalizeUrl` (from `@apify/utilities`):
- Scheme lowercased
- Host lowercased
- Trailing slash removed
- Query parameters kept and **lexically sorted**
- Fragment removed by default (`keepUrlFragment = false`)
- UTM/tracking parameters **not stripped** (kept as-is)
- Session IDs **not stripped**

**Critical:** Crawlee does NOT resolve redirects. Confirmed by maintainer in Discussion #1359: "Only the original URL is considered for request deduplication, so the handlePageFunction will be executed multiple times even if the redirects point to the same URL in the end." This means short URLs / redirecting mirrors produce duplicate fetches.

Customization:
- Set `request.uniqueKey` manually to override normalization.
- `useExtendedUniqueKey: true` distinguishes POST bodies to the same URL.
- `keepUrlFragment: true` includes `#fragment` in the key.

---

## Option-by-Option Analysis

### Option A — Trafilatura intra-document + Crawlee URL deduplication (combined)

**What it solves:**
- Crawlee: prevents re-fetching the same normalized URL within a run.
- Trafilatura `deduplicate=true`: removes repeated elements (navbars, footers, boilerplate paragraphs) within a single page extraction, potentially improving extracted content quality.

**What it leaves uncovered:**
- Different URLs resolving to the same content (mirrors, redirects, CDN URLs, UTM variants).
- Near-duplicate pages (same content, different template or slight rewording).
- Trafilatura dedup has a cross-page side effect: its global LRU cache accumulates across pages in a crawl. A paragraph on page 1 that reappears on page 5 will be silently dropped from page 5's extraction — desirable for boilerplate (footers, navbars), but possibly wrong for legitimately repeated content blocks.

**Implementation complexity:** Low. Enable `deduplicate: true` in `toTrafilaturaConfig`. Expose a user-facing config option `deduplicateContent` (schema + CLI).

**Performance:** Trafilatura's LRU is pure in-memory, negligible CPU cost. The global-cache cross-page side effect has O(1) lookup and bounded memory (4096 entries × ~100 bytes average ≈ ~400 KB).

**Configurability:** Both layers should be user-configurable independently. Trafilatura's dedup should default to `true` (most sites benefit from boilerplate removal). Crawlee's URL dedup is always on and not configurable (correct default).

---

### Option B — Trafilatura content deduplication only (drop reliance on Crawlee URL dedup)

**What it solves:**
- Removes duplicate elements within a page.
- The global LRU provides weak cross-page deduplication as a side effect.

**What it leaves uncovered:**
- Duplicate URLs are fetched and fully processed (page load, JS execution, extraction) before the content-level check fires — wasted work. Crawlee's URL dedup prevents the fetch entirely.
- The LRU cache is bounded at 4096 entries and is content-addressed, not URL-addressed — it cannot substitute for frontier deduplication.

**Verdict:** Not viable as a standalone strategy. URL deduplication is fundamentally different from content deduplication and they are not substitutable. Dropping Crawlee's URL dedup adds cost with no benefit.

---

### Option C — Crawlee URL deduplication only (disable Trafilatura content dedup)

**What it solves:**
- Prevents re-fetching already-seen URLs. Effective for exact URL duplicates.

**What it leaves uncovered:**
- UTM/tracking parameter variants (`?utm_source=twitter` vs `?utm_source=email`) are treated as different URLs and both fetched.
- Short URLs, redirect chains, and canonical-different pages all produce duplicate content in the dataset.
- No intra-document boilerplate removal.

**Verdict:** This is the current state (minus the canonical URL dedup layer). Sufficient for many crawls but leaves content duplicates in the dataset.

---

### Option D — Cross-document content hash + canonical URL dedup extended to all handlers + selective SimHash

This is the most complete option. Broken into sub-strategies:

#### D1: Cross-document content hash deduplication (exact, post-extraction)

**How:** After extracting text, compute SHA-256 (or reuse existing MD5) of extracted content and check against a `Set<string>`. Skip writing to dataset if hash is seen.

**What it solves:** Catches content-identical pages that arrive at different URLs (mirrors, redirect targets, CDN hostnames, UTM variants, paginated duplicates with identical content).

**Memory at scale:**
- 10k pages: `Set<string>` of 64-char hex strings ≈ 640 KB strings + Set overhead → well under 10 MB. No Bloom filter needed.
- 100k pages: under 10 MB. Still feasible in-process.
- Cross-run persistence: serialize the set to Apify key-value store after the run; load on next run.

**Note:** The MD5 of raw HTML is already computed (`rawHtmlHash`). A hash of **extracted text** (not raw HTML) is more appropriate — same content in different HTML wrappers will collide correctly.

**Implementation complexity:** Low. Add a `seenContentHashes = new Set<string>()` shared across handlers, check before pushing to sink.

**Configurability:** Should be opt-in (default on, disable with `--skip-content-dedup`). Cross-run persistence should be a separate opt-in flag.

#### D2: Extend canonical URL deduplication to Cheerio and Adaptive handlers

**What it solves:** The Cheerio and Adaptive handlers currently have no canonical dedup. A page fetched via Adaptive that has a canonical pointing to an already-seen page will still be extracted and written to the dataset.

**Implementation:** Move the `seenCanonicals` `Set` and canonical-check logic out of the Playwright-specific block into a shared utility callable from all three handler paths. For Cheerio, canonical extraction from raw HTML is already possible (Cheerio can parse it). For Adaptive, the HTML is available in both modes.

**Failure modes to guard against:**
- Self-referencing canonical (page canonical == fetched URL) — already handled: skip check only when `canonical !== url`.
- Pagination: `page=2` canonicalizing to `page=1` would cause page 2 to be skipped, missing its content. Mitigation: only skip if the canonical URL has already been seen AND the fetched URL differs, which is already the current logic.
- JavaScript-injected canonicals: Cheerio cannot see these. Acceptable — document as a known limitation.
- HTTP `Link:` header canonical: not currently checked. Low priority, only affects edge cases.
- Multiple canonical tags: use the first one found (current regex behavior).

**Implementation complexity:** Low-medium. Refactor `seenCanonicals` into `HandlerOpts` and call the check from all three handler paths.

#### D3: SimHash near-duplicate detection (optional, advanced)

**What it solves:** Pages with very similar but not identical content (A/B test variants, personalized pages, localized content, pagination with minor differences, boilerplate-heavy sites where the "unique" content differs by one paragraph).

**Algorithm:** 64-bit Charikar SimHash. Compare with Hamming distance ≤ 3 (Google's production threshold).

**Performance:**
- Computation: microseconds per page (tokenize + hash tokens + vote vector). Real-time compatible.
- Storage: 8 bytes per fingerprint × 10,000 pages = 80 KB.
- Lookup: O(N) naive scan sufficient up to ~50k pages. Above 50k: band-partitioned LSH index needed.

**Node.js libraries:** No actively maintained TypeScript library exists. The algorithm is ~30 lines — implement directly using Node.js `crypto` module for token hashing, store fingerprints as `bigint`.

**Configurability:** Opt-in only — near-duplicate detection has false positives (two pages that are legitimately very similar). User should control the Hamming distance threshold.

**Verdict for Contextractor:** Low priority for an initial implementation, but architecturally compatible with D1+D2. If implemented, should be post-extraction, in-memory, opt-in, with a configurable threshold.

---

## Production Crawler Best Practices (Reference)

Production crawlers (Scrapy, Apache Nutch, Common Crawl) universally layer deduplication:

- **Tier 1 — URL normalization (pre-fetch):** Scrapy uses `w3lib.url.canonicalize_url` (sort params, lowercase host/scheme). Nutch uses a Bloom filter with MurmurHash + JenkinsHash for fast pre-fetch rejection.
- **Tier 2 — Request fingerprint (pre-fetch):** Scrapy `RFPDupeFilter` hashes `(method, canonical_url, body)` into a `set`. Distributed crawlers move this to Redis.
- **Tier 3 — Exact content hash (post-fetch):** Apache Nutch ships `MD5Signature` (128-bit). Common Crawl deduplicates by MD5 of text content across the full crawl.
- **Tier 4 — Near-duplicate detection (post-fetch):** Apache Nutch `TextProfileSignature` (shingling-based fuzzy hash). Common Crawl uses 64-bit SimHash with chatnoir-copycat.

For Contextractor's scale and use case, Tiers 1–3 are appropriate. Tier 4 is optional and adds complexity.

---

## Recommended Strategy

A three-layer approach covering all practical duplication patterns without unnecessary complexity:

### Layer 1 — URL-level (already working)
Crawlee `RequestQueue` handles normalized-URL deduplication automatically. No changes needed. Document the limitation: tracking parameters (UTM, `ref`, `fbclid`) are not stripped — URLs with different tracking params are treated as different pages.

### Layer 2 — Canonical URL (extend to all handlers)
Move `seenCanonicals` into `CrawlContext` or `HandlerOpts` so it is shared across handler instances. Add the canonical-check path to the Cheerio and Adaptive handlers. Guard against pagination false-positives (already handled by `canonical !== url` check).

This is the highest-value fix: low complexity, high impact on sites that use canonicals (most CMS-driven sites).

### Layer 3 — Extracted content hash (new, cross-document)
Compute SHA-256 (or reuse MD5) of the extracted **text** (not raw HTML) after `extractor.extract()` returns. Check against a `Set<string>` before writing to sinks. Skip the sink write if hash is seen.

Place the `Set` in `CrawlContext` alongside `seenCanonicals`. Default on, disable with `--skip-content-dedup`. For cross-run deduplication, serialize the set to the Apify key-value store at run end and load at run start.

### Trafilatura `deduplicate` flag (enable by default)
Change `deduplicate: false` to `deduplicate: true` in `toTrafilaturaConfig` (or expose as a user option). This removes repeated boilerplate elements within each page's extraction. The cross-page LRU side effect is desirable for most crawl targets (footer/nav content gets dropped from later pages).

Add a user-facing `deduplicateContent` boolean to the schema (default `true`), wired to Trafilatura's `deduplicate` option. Document the cross-page behavior.

### SimHash (defer)
Not recommended for the initial implementation. Add as a future opt-in if users report near-duplicate content in their datasets. The in-process 64-bit SimHash approach is feasible when needed — no external dependencies required.
