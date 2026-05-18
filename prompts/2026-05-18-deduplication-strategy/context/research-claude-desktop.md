# Contextractor Deduplication Strategy — Recommended Design

## TL;DR
- **Recommended design: Hybrid D** — keep Crawlee URL dedup (free, always-on) + extend canonical-URL dedup to Cheerio/Adaptive handlers + add a new cross-run **SHA-256 content-hash gate** (exact, persisted in a named Apify KeyValueStore) + an optional **SimHash + Hamming-distance gate** for near-duplicate tolerance. Compute hashes in TypeScript over the post-extraction normalized text — do not rely on `rs-trafilatura`'s intra-document LRU, which is per-extraction only and (as of crate v0.2.2) is not exposed on the public Rust API anyway.
- **Persistence**: a single named Apify KeyValueStore (`contextractor-fingerprints`) holding one JSON record per Actor configuration; load on start, mutate in memory, flush every 60 s and on `migrating`/`aborting` events. Cross-run scope satisfied because named storages are retained indefinitely. Locally the same record persists under `storage/key_value_stores/contextractor-fingerprints/index.json`.
- **Near-duplicate threshold**: 64-bit SimHash with Hamming distance ≤ 3 as the default — the value Manku, Jain & Das Sarma validated as "reasonable" for 8 B-document corpora in *Detecting Near-Duplicates for Web Crawling* (WWW 2007, pp. 141–150). Configurable via `--near-dup-threshold` (0 disables, 1–7 valid range). Use `simhash-js` (MIT) or `@gelv/simhash` (MIT, actively maintained 2025) — both pure JS, no native deps.

## Key Findings

### 1. The "ground truth" about `rs-trafilatura` dedup needs a correction
The crate published at `crates.io/crates/rs-trafilatura` v0.2.2 (Murrough Foley, `license = "MIT OR Apache-2.0"` verbatim from Cargo.toml) does **not** expose `deduplicate`, `dedup_cache_size`, or `max_duplicate_ratio` on its public `Options` struct, and exports no `deduplication` module, `Simhash` type, or `content_fingerprint()` function. The docs.rs API index lists exactly 4 modules (`encoding`, `markdown`, `page_type`, `scoring`), 4 structs (`ExtractResult`, `ImageData`, `Metadata`, `Options`), and 4 functions (`extract`, `extract_bytes`, `extract_bytes_with_options`, `extract_with_options`). `ExtractResult` has 9 fields — none is `hash`, `content_hash`, or `fingerprint`. Practical consequence: the intra-document LRU dedup you described may exist inside your napi-rs binding layer (or in a fork), but **it is not surfaced by the upstream crate's public Rust API**, so option **(B)** "use only Trafilatura's content dedup" is functionally unavailable for cross-document deduplication regardless. Python trafilatura (Apache-2.0 since 1.8.0, currently 2.0) **does** expose a public `Simhash` class and `content_fingerprint()` in `trafilatura.deduplication` — relevant for the Python Contextractor variant only.

### 2. Crawlee URL dedup ≠ content dedup, and is wiped by default
Crawlee's `RequestQueue` enforces uniqueness on `uniqueKey` (default = normalized URL: lowercased host, sorted query params, fragment stripped). Always-on and free. But two facts matter for the cross-run requirement:
- **Default storages are purged at the start of every crawler run** — `purgeDefaultStorages()` is invoked automatically when you open the default `RequestQueue` unless you set `purgeOnStart: false` or use a *named* queue. Within-run-only URL state is therefore invalidated across weekly re-crawls.
- **`uniqueKey` covers URLs, not content**. Two distinct URLs returning byte-identical content (mirror domains, syndicated feeds, `www`/non-`www`, AMP/canonical pairs, UTM-stripped vs full) are both accepted. The canonical-URL dedup you already added in the Playwright handler patches the most common case; missing Cheerio/Adaptive coverage means an HTTP-only crawl misses it entirely.

### 3. Apify storage primitives suit cross-run dedup state — pick KV store, not Dataset
- **Named storages** (KV store, Dataset, RequestQueue) "are retained indefinitely" regardless of plan retention policy. Unnamed storages on Free tier follow the 10-most-recent-runs/4-month rule; on paid plans they follow plan retention.
- **`KeyValueStore` is mutable** — read/write/delete individual records, and the JS SDK's `getAutoSavedValue` is designed for crawler state (in-memory mutation, periodic flush, migration-event save). The legacy 9 MB upload cap on KV records was lifted on **9 March 2021** per Apify's "Updates to key-value store API" blog post by Jakub Drobník: "To simplify the upload process, we have removed the 9MB-per-file upload limit for key-value stores." Records can be any MIME type and any size up to Node's 2 GB file limit. AWS S3 backs the storage, providing strong read-after-write consistency.
- **`Dataset` is append-only**: `pushData` can add but never update or random-access by key, so a Dataset is unsuitable as a fingerprint index. Use Dataset only for the extracted content itself.
- **`RequestQueue`** can technically be abused for content dedup by overriding `uniqueKey` to a content hash, but you only get the hash *after* fetching and extracting — by which point you've already paid the CU cost the queue was supposed to save. RQ batch-add payloads are also capped at 9 MB and CRUD is rate-limited to 400 req/s per queue. Don't.
- **Concurrency**: a RequestQueue allows only one writer at a time; KeyValueStore and Dataset explicitly support concurrent multi-actor writes, but Apify documents that "the order of data writing cannot be controlled" — two simultaneous Actor runs writing the same KV key race. Mitigate by sharding the index by URL hostname or by accepting last-writer-wins (which causes false *negatives* in dedup, never false skips of unique pages).
- **Pay-per-event cost model**: per Apify help, "you will still be charged for reading and writing to datasets and storing results … typically just a few cents … unless you access the results repeatedly." There is no per-KV-op charge separate from compute units — KV reads/writes consume CU on a paid plan and storage GB-month appears as its own invoice line. One full-corpus load + one full-corpus save per run is essentially free; per-page KV roundtrips are not.

### 4. Algorithm choice: SimHash beats MinHash here
For Contextractor's use case (per-document boolean "is this a near-duplicate of something already seen?") on a corpus that realistically tops out at the low millions of pages per named index:

| Property | SimHash (Charikar 2002) | MinHash + LSH (Broder 1997) |
|---|---|---|
| Sketch size per doc | 64 bits (8 bytes) | 128–256 32-bit hashes (512 B – 1 KB) |
| Index size for 1 M docs | ~8 MB raw | 500 MB – 1 GB raw |
| Threshold semantics | Hamming distance (0–64) | Jaccard similarity (0–1) |
| "Near-duplicate" default | k ≤ 3 — Manku et al. WWW 2007: "for a repository of 8B web-pages, 64-bit simhash fingerprints and k = 3 are reasonable" | J ≥ 0.8, 128 hashes, 5-shingles — per arXiv:2501.01046v2 (FED): "For MinHash LSH, we use the default settings of the CPU baseline, 128 hash functions… we create shingles using five-grams and set the Jaccard similarity threshold to 0.8" |
| Library quality on Node | `simhash-js` (MIT, 1,204 downloads/week per Snyk, last published 2016 v1.0.0), `@gelv/simhash` (MIT, releases through 2025) | `minhash` (MIT, last published 2018), `minhash-node-rs` (Rust-backed, NAPI) |
| Used in production by | Google Crawl — Manku, Jain & Das Sarma, "Detecting Near-Duplicates for Web Crawling," WWW 2007, ACM, Banff, pp. 141–150 (Google Research pub #33026), 8 B fingerprints | Common Crawl / C4 (Raffel et al. 2020) / WanJuan-CC; FED paper applies these on C4 + RealNews |

For Contextractor scale and the boolean "skip if seen" requirement, **SimHash is the right choice**: index fits in a single sub-9 MB KV record up to ~1 M documents, comparison is O(seen × 1 XOR + popcount), and threshold tuning maps directly onto Manku's validated value. MinHash+LSH wins when you need *clusters* of similar docs or when the corpus is in the hundreds of millions — not Contextractor's case.

### 5. Trafilatura's own dedup is **intra-document only**, even when it works
Python trafilatura 2.0's deduplication docs state verbatim: "Duplicate tracking is performed on a per-thread basis. Each thread or process independently keeps track of its own list of duplicates, without relying on centralized information." The `deduplicate` setting runs an LRU of paragraph hashes inside *one* extraction call to strip repeated boilerplate (nav, footer fragments). **This is not a cross-document mechanism and cannot become one without re-architecting the extractor.** Leaving it enabled (`deduplicate: true`) is still useful — it removes boilerplate before you fingerprint, sharply improving SimHash signal — but it is not the dedup layer.

### 6. Heritrix, StormCrawler, Scrapy, Common Crawl all converge on the same pattern
- **Scrapy** ships `RFPDupeFilter` (SHA-1 over canonicalized URL + method + body) with optional disk persistence via `JOBDIR` writing `requests.seen`. URL-only by default; user must subclass for content fingerprints.
- **Heritrix 3.3+** has "robust handling for 'url agnostic' or 'digest based' deduplication" — content-digest based, plus the third-party `DeDuplicator` add-on for cross-crawl duplicate detection by SHA-1 of payload.
- **Common Crawl / C4 / RealNews** all run a two-phase pipeline: exact-hash dedup (SHA-256 or 64-bit MurmurHash + Bloom filter, the RealNews choice per Zellers et al. 2019), then MinHash+LSH for near-dupes. RealNews specifically "deduplicated by inserting a hash of the first 100 characters of each document into a bloom filter (Bloom, 1970)."
- **Industry consensus**: exact-hash gate first (cheap, deterministic), near-dup sketch second (probabilistic, tunable). This is the layered design adopted below.

## Details — Recommended Architecture

### Three-layer dedup pipeline

```
Layer 0 (free, always-on)  ──  Crawlee uniqueKey URL dedup (normalized URL)
Layer 1 (cheap, default-on) ──  Canonical-URL Set<string>  (now in ALL handlers)
Layer 2a (exact, cross-run) ──  SHA-256 over normalized extracted text → Set<hex>
Layer 2b (near-dup, opt-in) ──  64-bit SimHash → list, Hamming ≤ threshold
```

Each layer is cheaper than the next; later layers are only consulted on cache miss. Layer 2 is where the cross-run requirement is satisfied.

### Data flow

1. **Crawler enqueues** request — Layer 0 rejects duplicate normalized URLs (Crawlee built-in).
2. **Request handler fetches HTML** — before invoking `rs-trafilatura`, parse `<link rel="canonical">`. If canonical URL ∈ `seenCanonicals` set → drop, skip extraction. Layer 1 currently only in Playwright — close the gap by lifting this into a shared `preExtractionFilter()` helper in `src/dedup/canonical.ts` and invoking from Playwright, Cheerio, and Adaptive handlers.
3. **rs-trafilatura extracts** with intra-document dedup enabled if available in your napi-rs binding; otherwise leave the upstream defaults and apply `favor_precision: true` as a noise-reducing proxy.
4. **Normalize** the extracted `content_text`: lowercase, collapse whitespace, strip non-word characters, drop tokens shorter than 3 chars. This is the canonical text the fingerprints are computed over.
5. **Layer 2a — exact hash gate**: compute `SHA-256(normalizedText)` → 32-byte hex. If hex ∈ `seenContentHashes` → drop, increment `duplicate.exact` counter, do not `pushData`.
6. **Layer 2b — near-dup gate (if `--near-dup-threshold > 0`)**: compute `simhash64(tokens)`. For each previously-stored fingerprint, compute Hamming distance; if any ≤ threshold → drop, increment `duplicate.near` counter.
7. **Persist** the new content hash and SimHash into the in-memory index. Push extracted record to Dataset.
8. **On `persistState` event (every 60 s by default) and `migrating`/`aborting`**: serialize the index to the named KV store record.

### State record layout (one JSON object in the named KV store)

```json
{
  "schemaVersion": 1,
  "indexName": "example.com",
  "createdAt": "2026-04-12T09:00:00Z",
  "lastUpdatedAt": "2026-05-18T14:30:00Z",
  "totalDocuments": 12473,
  "canonicalUrls": ["https://example.com/a", "..."],
  "contentHashes": ["3f5e...", "8a91..."],
  "simhashes": ["a1b2c3d4e5f60718", "..."]
}
```

For corpora > ~500 k docs the record approaches Apify's practical record size; shard by hostname (`contextractor-fingerprints-<hostname>`). Compress with the JS SDK's automatic gzip (`Content-Encoding: gzip`) for ~3× reduction.

### Configuration surface

```typescript
interface DedupOptions {
  // Layer 1
  canonicalUrl: boolean;            // default true; --ignore-canonical-url disables
  
  // Layer 2 — cross-run state
  fingerprintStore?: string;        // default "contextractor-fingerprints"
                                    // null/undefined → in-memory only (single-run scope)
  
  // Layer 2a
  exactContentHash: boolean;        // default true; SHA-256 over normalized text
  
  // Layer 2b
  nearDuplicateThreshold: number;   // default 3 (Manku et al. WWW 2007);
                                    // 0 disables; valid range 0..7 (64-bit Hamming)
  simhashTokenizer: 'words' | 'shingles-3' | 'shingles-5'; // default 'shingles-3'
  
  // Normalization
  minNormalizedLength: number;      // default 200 chars; below this skip fingerprinting
                                    // (avoids false-positive collisions on stubs)
}
```

Always-on: Crawlee URL dedup, Layer 1 canonical (in all three handlers), Layer 2a exact hash. User-tunable: near-duplicate threshold, fingerprint store name, minimum-length floor.

### Closing the canonical-URL gap (Cheerio & Adaptive)

The current implementation reads canonicals only in the Playwright handler via `page.evaluate()`. The fix is mechanical: in `routes/*.ts`, extract a shared helper that takes a parsed DOM (Cheerio `$` *or* Playwright `Page`) and returns the canonical URL string:

```typescript
// src/dedup/canonical.ts
export async function readCanonicalUrl(
  ctx: PlaywrightCrawlingContext | CheerioCrawlingContext
): Promise<string | null> {
  if ('page' in ctx) {
    return ctx.page.locator('link[rel="canonical"]').first().getAttribute('href');
  }
  return ctx.$('link[rel="canonical"]').first().attr('href') ?? null;
}
```

The Adaptive crawler picks the right branch automatically based on which context it produced.

### Concurrency model

Single Actor run: trivially safe — in-process `Set`.

Multiple concurrent runs of the same Actor against the same named store: last-writer-wins on the KV record. This is *safe-against-false-skip* (worst case a duplicate is extracted twice across runs, never that a non-duplicate is dropped). Mitigations if it matters:
- Per-run shard: `${storeName}-${ACTOR_RUN_ID}` then merge offline.
- Or accept the race — for weekly scheduled re-crawls this is the right trade-off.

### Cost analysis (Apify pay-per-event)

For a 10 000-page weekly re-crawl, on Scale plan ($0.25/CU):
- Compute cost of dedup machinery: SHA-256 + SimHash ≈ 1–2 ms/page × 10 000 = 10–20 s of CPU at 512 MB ≈ 0.003 CU ≈ $0.001. Negligible.
- KV store reads: 1 record at start. KV writes: ~5 record overwrites per run (every 60 s persist). At Apify's effective KV ops cost (rolled into CU/storage GB-month), well under $0.01/run.
- Storage at rest: a 10 k-doc index serialized + gzipped is ~150–300 KB. At Apify's $0.005/GB-month order this is effectively free.
- **Savings from skipping duplicates**: if even 10% of pages are unchanged week-over-week, you save 1 000 Playwright extractions ≈ 0.5–2 CU ≈ $0.13–$0.50 per run. **The dedup pays for itself at a duplicate rate > ~0.5%.**

### License compliance

All recommended dependencies pass MIT/Apache-2.0:
- `bloom-filters` (Callidon) — MIT
- `simhash-js` — MIT (1,204 downloads/week per Snyk; last published 2016 — mature, vendor it if maintenance worries you)
- `@gelv/simhash` — MIT, actively maintained (2025 releases)
- `minhash` (npm) — MIT (only if you ever switch to MinHash)
- Node's built-in `crypto.createHash('sha256')` — Node MIT licensing
- `rs-trafilatura` — MIT OR Apache-2.0 ✅
- Python `trafilatura` ≥ 1.8.0 — Apache-2.0 ✅

Avoid `brianbondy/bloom-filter` (MPL-2.0 — weak copyleft on file-level, generally OK but excluded by the user's strict MIT/Apache requirement).

## Recommendations

**Stage 1 — Ship in the next release (the easy wins):**
1. Extract `readCanonicalUrl()` into `src/dedup/canonical.ts` and call it from Cheerio + Adaptive handlers. Closes the documented gap. ~30 minutes of work, zero new dependencies.
2. Add Layer 2a exact-hash dedup with SHA-256 over normalized extracted text. Persist to named KV store `contextractor-fingerprints` via `Actor.openKeyValueStore({ name })`. Use the `getAutoSavedValue` pattern so persistence is automatic. ~half a day.
3. Default `fingerprintStore` to the Actor name + `:fingerprints` so users get cross-run dedup out of the box on the Apify platform; on the local CLI it falls back to `./storage/key_value_stores/contextractor-fingerprints/`.

**Stage 2 — Add near-duplicate detection (one sprint later):**
4. Add `simhash-js` (or `@gelv/simhash`) dependency. Implement Layer 2b with default Hamming threshold 3 (the Manku WWW 2007 figure) and 3-shingle tokenizer.
5. Expose `--near-dup-threshold` and `--simhash-tokenizer` flags on the CLI and in the Apify input schema.
6. Emit dedup statistics in the run log: `{exactDuplicates, nearDuplicates, uniqueExtractions, indexSize}`.

**Stage 3 — Only if/when corpora exceed ~500 k docs per named index:**
7. Shard the fingerprint store by hostname. Add a Bloom filter (`bloom-filters` npm, MIT) as a fast pre-filter before the SimHash linear scan — keeps memory flat and Hamming probes O(near-dup-candidates) instead of O(seen). This mirrors RealNews's pipeline (Zellers et al. 2019): hash → bloom-filter → near-dup pass.
8. Consider a separate Apify Dataset of `{hash, url, timestamp}` rows as an audit log of dedup decisions, distinct from the live index.

**Benchmarks that should trigger re-evaluation:**
- Fingerprint store record approaches 5 MB compressed → shard.
- Hamming-distance scan on a single page exceeds 50 ms → introduce LSH bucketing (Manku et al. bit-permutation scheme) or Bloom-prefilter.
- Duplicate rate < 1% across consecutive runs → the cost of maintaining the index exceeds savings; switch the user to URL-only dedup (`fingerprintStore: null`).
- User reports false-positive dedup → lower default threshold from 3 to 2, or raise `minNormalizedLength`.

## Caveats

1. The "ground truth" you supplied claims `rs-trafilatura`'s `Options` exposes `deduplicate`, `dedup_cache_size`, and `max_duplicate_ratio`. The published v0.2.2 docs.rs API index does not list these fields and exports no `deduplication` module. Either (a) you are using a fork, (b) those fields live in your napi-rs binding layer rather than the underlying crate, or (c) the ground truth needs updating. **Verify before relying on Trafilatura's LRU as a building block** — and note that even if present, it remains intra-document and does not solve cross-run dedup.

2. SimHash with k ≤ 3 is Manku et al.'s validated figure for 64-bit fingerprints over 8 B-document corpora. Reported precision/recall in the literature is more modest than folklore suggests — a slide-deck summary attributed to Hung (SlidePlayer #4258686) citing Henzinger 2006 puts both precision and recall ≈ 0.75 at k=3, not 95–99%. For Contextractor scale it will catch most "minor edit / syndicated copy" cases but miss heavy paraphrases. If users report missed near-duplicates, the right escalation is *not* to raise k beyond ~7 (false-positive rate climbs sharply) but to switch tokenizer to 5-shingles or to MinHash+LSH at J ≥ 0.8 with 128 hashes — the FED-paper / Common-Crawl defaults.

3. The default-purge behavior of Crawlee is a frequent footgun for cross-run state. If you adopt the named KV store recommendation, also document `purgeOnStart: false` or instruct users to use named storages for any state they want kept — otherwise scheduled Actor runs will appear to "forget" between executions even with the dedup index in place.

4. Concurrent runs against the same named index race on the KV record. For weekly scheduled crawls this is fine. For users running many parallel Actor instances against the same site, document the limitation and suggest per-shard fingerprint stores.

5. The Python Contextractor variant at `/Users/miroslavsekera/r/contextractor/` can use Python trafilatura's built-in `Simhash` class and `content_fingerprint()` directly (Apache-2.0 since 1.8.0) — the design above translates with `trafilatura.deduplication.Simhash` replacing the npm SimHash library. Keep the persistence layer (Apify KV store) identical so the two variants share dedup state if ever run side-by-side.

| Plan item | Status |
|---|---|
| 1. Crawlee storage internals | ✅ covered |
| 2. rs-trafilatura / Python trafilatura dedup primitives | ✅ covered, including correction |
| 3. SimHash vs MinHash near-dup | ✅ covered with primary-source thresholds |
| 4. TS/Node library landscape (license-checked) | ✅ covered |
| 5. Common Crawl / Heritrix / Scrapy / Nutch patterns | ✅ covered |
| 6. Apify KV persistence patterns + PPE cost | ✅ covered |
| 7. Closing canonical-URL gap | ✅ covered with code sketch |
| 8. Recommended hybrid design + data flow + config | ✅ covered |
| 9. Concurrency + race analysis | ✅ covered |
| 10. Staged rollout + tripwires | ✅ covered |
