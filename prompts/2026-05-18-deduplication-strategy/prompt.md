# Implement Deduplication Parameter in Contextractor

## Research

Read these before implementing — they contain verified codebase findings and design decisions:

- `prompts/2026-05-18-deduplication-strategy/context/research-claude-code.md`
- `prompts/2026-05-18-deduplication-strategy/context/research-claude-desktop.md`
- `prompts/2026-05-18-deduplication-strategy/context/ressearch-by-gpt.md` ← focus here, written by a different model

## Goal

Add a `deduplication` enum parameter to the Contextractor CLI, Apify Actor, and crawler package. Fix the canonical URL dedup gap (currently Playwright-only). Add cross-document content hash dedup as an opt-in level. Update all docs, SPEC.md files, and add tests in the same change — do not defer.

**Remove all old deduplication functionality** — delete `ignoreCanonicalUrl` from every layer it touches: schema, crawler options, CLI, config, tests, and docs. This is a greenfield replacement, not an extension.

## Design

```
deduplication: 'minimal' | 'basic' | 'full'   default: 'basic'
```

- `'minimal'` — only Crawlee's built-in URL dedup (pre-fetch, always active)
- `'basic'` — + canonical URL dedup in all three handler types
- `'full'` — + cross-document content hash dedup: skip sink write when extracted text hash was already seen

**Do not** enable Trafilatura's `deduplicate` flag — leave `deduplicate: false` hardcoded in `createCrawler.ts`. That is intra-document element dedup (internal to trafilatura), unrelated to cross-document dedup.

**Do not** implement SimHash — defer entirely.

## Critical files to read before making any change

- `packages/schema/src/source-of-truth/input.ts` — schema field patterns, find and remove `ignoreCanonicalUrl`
- `packages/crawler/src/handler.ts` — all three handler factories, `HandlerOpts`, existing canonical dedup (lines 78–90)
- `packages/crawler/src/createCrawler.ts` — handler construction, `ContextractorCrawlerOptions`, find and remove `ignoreCanonicalUrl`
- `packages/extraction/src/contentInfo.ts` — `computeContentInfo()` (already imported in handlers)
- `apps/standalone/src/cliProgram.ts` — find and remove `--ignore-canonical-url`; CLI option patterns
- `apps/standalone/src/config.ts` — `CrawlConfig` interface, find and remove `ignoreCanonicalUrl`
- `apps/apify-actor/src/config.ts` — `buildCrawlerOpts`, find and remove `ignoreCanonicalUrl`

## Implementation

### Step SCHEMA — `packages/schema/src/source-of-truth/input.ts`

**Remove** the `ignoreCanonicalUrl` field entirely.

**Add** `deduplication` in its place:

```ts
deduplication: z
  .enum(['minimal', 'basic', 'full'])
  .default('basic')
  .describe(
    'Deduplication level applied on top of Crawlee\'s built-in URL deduplication. ' +
    'basic (default): skip pages whose <link rel="canonical"> was already extracted, across all handler types. ' +
    'full: also skip pages whose extracted text content matches a previously extracted page. ' +
    'minimal: disable additional deduplication — only Crawlee\'s URL dedup remains active.',
  )
  .meta({
    title: 'Deduplication',
    ...apifyMeta({
      editor: 'select',
      enumTitles: ['Minimal — URL only', 'Basic — canonical URL (default)', 'Full — canonical URL + content hash'],
    }),
  }),
```

### Step HANDLER — `packages/crawler/src/handler.ts`

**Update `HandlerOpts`**: remove `ignoreCanonicalUrl?: boolean`, add:

```ts
deduplication: 'minimal' | 'basic' | 'full';
seenCanonicals: Set<string>;
seenContentHashes: Set<string>;
```

**Add a module-private helper** (not exported):

```ts
function checkAndRecordCanonical(
  html: string,
  url: string,
  seenCanonicals: Set<string>,
): { skip: boolean; canonical?: string } {
  const canonicalMatch =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const canonical = canonicalMatch?.[1];
  if (canonical === undefined) return { skip: false };
  if (canonical !== url && seenCanonicals.has(canonical)) {
    return { skip: true, canonical };
  }
  seenCanonicals.add(canonical);
  return { skip: false, canonical };
}
```

**In `createHandler` (Playwright)**:
- Remove `const seenCanonicals = new Set<string>();` (moves to `createCrawler.ts`)
- Replace the existing canonical block (lines 78–90) with:

```ts
if (opts.deduplication !== 'minimal') {
  const { skip, canonical } = checkAndRecordCanonical(html, url, opts.seenCanonicals);
  if (skip) {
    log.info(`Skipping ${url} — duplicate of canonical ${canonical}`);
    return;
  }
}
```

- After `formats` is populated, before `opts.sink(...)`, add:

```ts
if (opts.deduplication === 'full') {
  const extractedText = Object.values(formats).join('\n');
  if (extractedText.length > 0) {
    const { hash: contentHash } = computeContentInfo(extractedText);
    if (opts.seenContentHashes.has(contentHash)) {
      log.info(`Skipping ${url} — duplicate content hash`);
      return;
    }
    opts.seenContentHashes.add(contentHash);
  }
}
```

**In `createCheerioHandler` and `createAdaptiveHandler`**: add the same canonical check block and content hash block (identical code). For Cheerio, HTML is from `context.$('html').prop('outerHTML') ?? ''`. For Adaptive, HTML is from `$.html() ?? ''`. Both are already in scope when the dedup check runs.

### Step CRAWLER — `packages/crawler/src/createCrawler.ts`

**Remove** `ignoreCanonicalUrl?: boolean` from `ContextractorCrawlerOptions`.

**Add**:

```ts
deduplication?: 'minimal' | 'basic' | 'full';
```

**At the top of `createContextractorCrawler`**, after formats resolution, add:

```ts
const deduplication: 'minimal' | 'basic' | 'full' = opts.deduplication ?? 'basic';
const seenCanonicals = new Set<string>();
const seenContentHashes = new Set<string>();
```

**Pass to all three handler constructors** (`createCheerioHandler`, `createAdaptiveHandler`, `createHandler`):

```ts
deduplication,
seenCanonicals,
seenContentHashes,
```

Remove any remaining `ignoreCanonicalUrl` pass-throughs from all handler constructor calls.

### Step CLI — `apps/standalone/src/cliProgram.ts`

**Remove** the `--ignore-canonical-url` option entirely.

**Add** `--deduplication`:

```ts
.addOption(
  new Option('--deduplication <level>', 'Deduplication level: minimal, basic (default), or full')
    .choices(['minimal', 'basic', 'full'])
)
```

**Remove** `ignoreCanonicalUrl` from `ExtractOpts` and from `buildSchemaOverrides`.

**Add** `deduplication?: 'minimal' | 'basic' | 'full'` to `ExtractOpts`. In `buildSchemaOverrides`, add:

```ts
if (opts.deduplication !== undefined) out.deduplication = opts.deduplication;
```

### Step CLI-CONFIG — `apps/standalone/src/config.ts`

**Remove** `ignoreCanonicalUrl` from `CrawlConfig` and from `buildCrawlConfig`.

**Add** to `CrawlConfig`:

```ts
deduplication: 'minimal' | 'basic' | 'full';
```

In `buildCrawlConfig`, add:

```ts
deduplication: input.deduplication,
```

Pass to `createContextractorCrawler`:

```ts
deduplication: cfg.deduplication,
```

### Step ACTOR — `apps/apify-actor/src/config.ts`

**Remove** `ignoreCanonicalUrl: input.ignoreCanonicalUrl` from `buildCrawlerOpts`.

**Add**:

```ts
deduplication: input.deduplication,
```

## Tests

### `packages/schema/src/source-of-truth/input.test.ts`

**Remove** any existing tests for `ignoreCanonicalUrl`.

**Add** a new `describe` block:

```ts
describe('ContextractorInput — deduplication field', () => {
  it('defaults to "basic"', () => {
    expect(ContextractorInput.parse(BASE).deduplication).toBe('basic');
  });
  it.each(['minimal', 'basic', 'full'] as const)('accepts "%s"', (level) => {
    expect(ContextractorInput.parse({ ...BASE, deduplication: level }).deduplication).toBe(level);
  });
  it('rejects unknown values', () => {
    expect(() => ContextractorInput.parse({ ...BASE, deduplication: 'aggressive' })).toThrow();
  });
});
```

### `packages/crawler/src/handler.test.ts` (new file)

Test `checkAndRecordCanonical` behavior indirectly via `createCheerioHandler`. Use Cheerio's `load()` to build a real `$`, produce a minimal mock context (just `request.url`, `request.userData`, `log`, and `$`), and a `memorySink` to capture outputs.

Test groups:

- `deduplication: 'basic'` — two pages with same canonical, different URLs → first extracted, second skipped
- `deduplication: 'minimal'` — same two pages → both extracted
- `deduplication: 'full'` — two pages with identical extracted text, different URLs/canonicals → first extracted, second skipped (content hash match)
- `deduplication: 'basic'` — identical content, no canonical → both extracted (content hash only active in `'full'`)
- shared `seenCanonicals` — confirm state accumulates across calls to the same handler instance

If the native `.node` binary is not available in the test environment, skip content hash tests with `it.skip` and a comment explaining why.

### `apps/apify-actor/src/config.test.ts`

**Remove** `ignoreCanonicalUrl` from `BASE_INPUT`. Add `deduplication: 'basic'` instead.

**Remove** any existing `ignoreCanonicalUrl` tests.

Add a `describe` block testing that `buildCrawlerOpts` passes `deduplication` values (`'minimal'`, `'basic'`, `'full'`) through correctly.

### `apps/standalone/src/cli.test.ts`

**Remove** any test for `--ignore-canonical-url`. Add a test that `--deduplication` is a recognized option on the `extract` subcommand and accepts the three valid values.

## Docs

### SPEC.md files (surgical edits only — do not touch `@generated` regions)

**`packages/crawler/SPEC.md`**: Replace all `ignoreCanonicalUrl` references with `deduplication`, `seenCanonicals`, `seenContentHashes`. Update the dedup note from "Playwright-only" to "all handler types".

**`packages/schema/SPEC.md`**: Replace the `ignoreCanonicalUrl` field entry with `deduplication`.

**`apps/apify-actor/SPEC.md`**: Replace `ignoreCanonicalUrl` in the `buildCrawlerOpts` pass-through list with `deduplication`.

**`apps/standalone/SPEC.md`**: Remove `--ignore-canonical-url`; add `--deduplication <level>`.

### Auto-generated regions

After all code changes:

```bash
pnpm build
pnpm docs:update
```

Do not hand-edit any `<!-- @generated:start -->` / `<!-- @generated:end -->` blocks — `pnpm docs:update` rebuilds them.

## Build and Test Order

Run each step, fix errors before proceeding:

```bash
pnpm --filter @contextractor/schema build
pnpm --filter @contextractor/schema test

pnpm --filter @contextractor/crawler build
pnpm --filter @contextractor/crawler test

pnpm build          # full workspace — catches cross-package type errors
pnpm docs:update    # regenerate @generated regions
pnpm test           # full test suite
pnpm lint           # Biome
```

## Step VALIDATE — End-to-end Deduplication Tests

Reference: `prompts/2026-05-18-deduplication-strategy/context/test-sites.md` — identifies the industry-standard public scraping sandboxes and exactly which URL patterns trigger each dedup scenario.

Run these after all unit tests pass. Build the standalone CLI first (`pnpm --filter @contextractor/standalone build`), then run:

```bash
CLI="node apps/standalone/dist/cli.js"
```

### Test MINIMAL — dedup disabled beyond URL normalization

Uses **quotes.toscrape.com** (Scrapy's official tutorial target). The same 10 quotes appear on both `/` and `/page/1/` — two distinct crawlable URLs that return identical content.

```bash
$CLI extract \
  --url 'https://quotes.toscrape.com/' \
  --url 'https://quotes.toscrape.com/page/1/' \
  --deduplication minimal \
  --max-crawling-depth 0 \
  --format txt \
  --output-dir /tmp/dedup-test-minimal
```

**Expected:** two output files — one for each URL. Both contain the same 10 quotes. Deduplication does not suppress either.

### Test BASIC-canonical — canonical URL dedup across handlers

Uses **scrapeme.live** which emits `<link rel="canonical">` on every product page. The Bulbasaur product page is reachable under 6+ listing URLs (category pokemon, category seed, tags bulbasaur/overgrow/seed, and shop pagination) all pointing to the same canonical `https://scrapeme.live/shop/Bulbasaur/`.

```bash
$CLI extract \
  --url 'https://scrapeme.live/shop/Bulbasaur/' \
  --url 'https://scrapeme.live/product-category/pokemon/' \
  --url 'https://scrapeme.live/product-category/seed/' \
  --deduplication basic \
  --max-crawling-depth 0 \
  --format txt \
  --output-dir /tmp/dedup-test-basic
```

**Expected:** one Bulbasaur product file (the first URL hit), then skipped on subsequent encounters. Log must contain `Skipping … — duplicate of canonical https://scrapeme.live/shop/Bulbasaur/`. Three input URLs → one product output.

### Test BASIC-tracking — URL normalization with tracking params

Uses **books.toscrape.com** which returns byte-identical HTML for the same page regardless of query params but ships **no** `rel=canonical` tag — so Crawlee's URL dedup must handle the normalization. Verify that `?utm_source=x` does not produce a duplicate record.

```bash
$CLI extract \
  --url 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html' \
  --url 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html?utm_source=newsletter&ref=email' \
  --deduplication basic \
  --max-crawling-depth 0 \
  --format txt \
  --output-dir /tmp/dedup-test-basic-tracking
```

**Expected:** one output file — Crawlee's built-in URL normalization (query params sorted, no UTM stripping by default) should treat these as different URLs and both will be fetched; the canonical check will not fire (no canonical tag). This test validates that `deduplication: 'basic'` does NOT collapse tracking-param variants — that is expected behavior and not a bug. Document this in the output.

### Test FULL-content — content hash dedup across tag pages

Uses **quotes.toscrape.com** where the Einstein quote (`"The world as we have created it..."`) appears on at least four tag pages plus the main pagination. With `deduplication: 'full'`, the first page extraction succeeds; all subsequent pages containing the same extracted text block are skipped.

```bash
$CLI extract \
  --url 'https://quotes.toscrape.com/' \
  --url 'https://quotes.toscrape.com/tag/change/page/1/' \
  --url 'https://quotes.toscrape.com/tag/world/page/1/' \
  --url 'https://quotes.toscrape.com/tag/thinking/page/1/' \
  --deduplication full \
  --max-crawling-depth 0 \
  --format txt \
  --output-dir /tmp/dedup-test-full
```

**Expected:** fewer output files than input URLs. The log must contain `Skipping … — duplicate content hash` for at least two of the four tag pages (they return identical extracted quote text). The first URL's content appears exactly once in the output.

### Test FULL-benchmark — 755 unique products on scrapeme.live

The definitive correctness benchmark. scrapeme.live has exactly 755 products (per its own "Showing 1–16 of 755 results" banner). With `deduplication: 'full'`, crawling from the shop root with unlimited depth should yield exactly 755 unique product records regardless of how many listing/category/tag URLs the crawler visits. Add a 2–3 s delay to respect the site (per the research).

```bash
$CLI extract \
  --url 'https://scrapeme.live/shop/' \
  --deduplication full \
  --max-crawling-depth 3 \
  --format txt \
  --output-dir /tmp/dedup-test-benchmark
ls /tmp/dedup-test-benchmark | wc -l   # expect ≤ 755
```

**Expected:** output file count ≤ 755. If the count significantly exceeds 755, content-hash dedup is not working. If the count is much lower, canonical dedup has false positives.

### Failure interpretation

From the research:
- Dedup fails on scrapeme.live but passes on toscrape → content fingerprinting broken; check `seenContentHashes` logic
- Dedup passes on product pages but duplicates appear on listing/category pages → canonical check not firing in Cheerio/Adaptive handlers — check handler wiring in `createCrawler.ts`
- `deduplication: 'minimal'` still deduplicating → check that `checkAndRecordCanonical` is guarded by `opts.deduplication !== 'minimal'`

## Invariants

- Do not change `ExtractionResult` shape — dedup is a crawl-time concern, not output
- Do not export `checkAndRecordCanonical`, `seenCanonicals`, or `seenContentHashes`
- Content hash uses `computeContentInfo(Object.values(formats).join('\n'))` — extracted text, not raw HTML
- Only add to `seenContentHashes` when the page is NOT a duplicate (i.e., when it passes the check)
- `seenCanonicals.add()` runs only when the page is not being skipped — preserve the existing logic exactly
- Do not change the canonical regex patterns — copy them verbatim from the existing Playwright handler
