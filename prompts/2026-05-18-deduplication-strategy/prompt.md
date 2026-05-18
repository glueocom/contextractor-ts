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
deduplication: 'url' | 'canonical' | 'content'   default: 'canonical'
```

- `'url'` — only Crawlee's built-in URL dedup (pre-fetch, always active)
- `'canonical'` — + canonical URL dedup in all three handler types
- `'content'` — + cross-document content hash dedup: skip sink write when extracted text hash was already seen

Names follow the dominant convention in crawler tooling (Elastic, Firecrawl, Nutch): each value names the highest-active dedup layer, not a quality tier.

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
  .enum(['url', 'canonical', 'content'])
  .default('canonical')
  .describe(
    'Deduplication level applied on top of Crawlee\'s built-in URL deduplication. ' +
    'canonical (default): skip pages whose <link rel="canonical"> was already extracted, across all handler types. ' +
    'content: also skip pages whose extracted text content matches a previously extracted page. ' +
    'url: disable additional deduplication — only Crawlee\'s URL dedup remains active.',
  )
  .meta({
    title: 'Deduplication',
    ...apifyMeta({
      editor: 'select',
      enumTitles: ['URL only', 'Canonical URL (default)', 'Content hash'],
    }),
  }),
```

### Step HANDLER — `packages/crawler/src/handler.ts`

**Update `HandlerOpts`**: remove `ignoreCanonicalUrl?: boolean`, add:

```ts
deduplication: 'url' | 'canonical' | 'content';
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
if (opts.deduplication !== 'url') {
  const { skip, canonical } = checkAndRecordCanonical(html, url, opts.seenCanonicals);
  if (skip) {
    log.info(`Skipping ${url} — duplicate of canonical ${canonical}`);
    return;
  }
}
```

- After `formats` is populated, before `opts.sink(...)`, add:

```ts
if (opts.deduplication === 'content') {
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
deduplication?: 'url' | 'canonical' | 'content';
```

**At the top of `createContextractorCrawler`**, after formats resolution, add:

```ts
const deduplication: 'url' | 'canonical' | 'content' = opts.deduplication ?? 'canonical';
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
  new Option('--deduplication <level>', 'Deduplication level: url, canonical (default), or content')
    .choices(['url', 'canonical', 'content'])
)
```

**Remove** `ignoreCanonicalUrl` from `ExtractOpts` and from `buildSchemaOverrides`.

**Add** `deduplication?: 'url' | 'canonical' | 'content'` to `ExtractOpts`. In `buildSchemaOverrides`, add:

```ts
if (opts.deduplication !== undefined) out.deduplication = opts.deduplication;
```

### Step CLI-CONFIG — `apps/standalone/src/config.ts`

**Remove** `ignoreCanonicalUrl` from `CrawlConfig` and from `buildCrawlConfig`.

**Add** to `CrawlConfig`:

```ts
deduplication: 'url' | 'canonical' | 'content';
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
  it('defaults to "canonical"', () => {
    expect(ContextractorInput.parse(BASE).deduplication).toBe('canonical');
  });
  it.each(['url', 'canonical', 'content'] as const)('accepts "%s"', (level) => {
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

- `deduplication: 'canonical'` — two pages with same canonical, different URLs → first extracted, second skipped
- `deduplication: 'url'` — same two pages → both extracted
- `deduplication: 'content'` — two pages with identical extracted text, different URLs/canonicals → first extracted, second skipped (content hash match)
- `deduplication: 'canonical'` — identical content, no canonical → both extracted (content hash only active in `'content'`)
- shared `seenCanonicals` — confirm state accumulates across calls to the same handler instance

If the native `.node` binary is not available in the test environment, skip content hash tests with `it.skip` and a comment explaining why.

### `apps/apify-actor/src/config.test.ts`

**Remove** `ignoreCanonicalUrl` from `BASE_INPUT`. Add `deduplication: 'canonical'` instead.

**Remove** any existing `ignoreCanonicalUrl` tests.

Add a `describe` block testing that `buildCrawlerOpts` passes `deduplication` values (`'url'`, `'canonical'`, `'content'`) through correctly.

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

## Invariants

- Do not change `ExtractionResult` shape — dedup is a crawl-time concern, not output
- Do not export `checkAndRecordCanonical`, `seenCanonicals`, or `seenContentHashes`
- Content hash uses `computeContentInfo(Object.values(formats).join('\n'))` — extracted text, not raw HTML
- Only add to `seenContentHashes` when the page is NOT a duplicate (i.e., when it passes the check)
- `seenCanonicals.add()` runs only when the page is not being skipped — preserve the existing logic exactly
- Do not change the canonical regex patterns — copy them verbatim from the existing Playwright handler
