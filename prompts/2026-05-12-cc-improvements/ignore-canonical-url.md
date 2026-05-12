# Ignore Canonical URL

> **TLDR**: Adds `ignoreCanonicalUrl: boolean` (default `false`). When false (default), the handler checks `<link rel="canonical">` after loading each page; if the canonical URL was already extracted, extraction is skipped for the current page. When true, the canonical check is disabled and every loaded URL is extracted. Flows through schema → crawler handler → both app configs → standalone CLI.

## Agent

`ts-pro`

## Schema (`packages/schema/src/source-of-truth/input.ts`)

Add in the Crawler settings section:
```ts
ignoreCanonicalUrl: z
  .boolean()
  .default(false)
  .describe('If enabled, the crawler ignores the canonical URL declared in the page and always extracts content for every loaded URL. By default, pages whose canonical URL has already been extracted are skipped.')
  .meta({ title: 'Ignore canonical URLs' }),
```

## Crawler package

### `ContextractorCrawlerOptions` / `HandlerOpts`

Add `ignoreCanonicalUrl?: boolean`.

### Handler (`handler.ts`)

Add a `Set<string>` in the `createHandler` closure to track seen canonical URLs.

After `const html = await page.content()`, if not `ignoreCanonicalUrl`:
```ts
const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
  ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
if (canonicalMatch) {
  const canonical = canonicalMatch[1];
  if (canonical !== url && seenCanonicals.has(canonical)) {
    log.info(`Skipping ${url} — duplicate of canonical ${canonical}`);
    return;
  }
  seenCanonicals.add(canonical);
}
```

## App configs

Both `apps/apify-actor/src/config.ts` and `apps/standalone/src/config.ts`: pass `ignoreCanonicalUrl: input.ignoreCanonicalUrl`.

## Standalone CLI (`apps/standalone/src/cliProgram.ts`)

Add `--ignore-canonical-url` flag.

## Docs

Update in the same pass:
- `packages/schema/SPEC.md` — add `ignoreCanonicalUrl`
- `packages/crawler/SPEC.md` — document canonical deduplication behaviour
- `apps/apify-actor/SPEC.md` and `apps/standalone/SPEC.md` — mention in crawler settings

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Verification

```bash
pnpm build && pnpm test
```
