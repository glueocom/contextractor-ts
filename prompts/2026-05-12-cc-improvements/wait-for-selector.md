# Wait for Selector

> **TLDR**: Adds `waitForSelector` (hard fail on timeout) and `softWaitForSelector` (non-failing) string fields. Both call `page.waitForSelector()` in the handler before extraction; `softWaitForSelector` swallows the timeout error. Timeout uses `dynamicContentWaitSecs` if set, otherwise 30s. Flows through schema → crawler package handler → both app configs → standalone CLI.

## Agent

`ts-pro`

## Schema (`packages/schema/src/source-of-truth/input.ts`)

Add in the Performance and limits section:
```ts
waitForSelector: z
  .string()
  .default('')
  .describe('Wait for this CSS selector to appear before extracting content. The request fails and is retried if the selector does not appear within the timeout. Leave empty to disable.')
  .meta({ title: 'Wait for selector', ...apifyMeta({ editor: 'textfield' }) }),

softWaitForSelector: z
  .string()
  .default('')
  .describe('Wait for this CSS selector to appear before extracting content. Unlike waitForSelector, the request continues even if the selector does not appear within the timeout. Leave empty to disable.')
  .meta({ title: 'Soft wait for selector', ...apifyMeta({ editor: 'textfield' }) }),
```

## Crawler package

### `ContextractorCrawlerOptions` (`createCrawler.ts`)

Add `waitForSelector?: string` and `softWaitForSelector?: string`.

### Handler (`handler.ts`)

Add both to `HandlerOpts`. In the handler, after scroll and before `page.content()`:
```ts
const selectorTimeoutMs = (opts.dynamicContentWaitSecs ?? 30) * 1000;

if (opts.waitForSelector) {
  await page.waitForSelector(opts.waitForSelector, { timeout: selectorTimeoutMs });
}
if (opts.softWaitForSelector) {
  await page.waitForSelector(opts.softWaitForSelector, { timeout: selectorTimeoutMs }).catch(() => {});
}
```

Note: `waitForSelector` throws on timeout — Crawlee catches this and retries the request. `softWaitForSelector` swallows the error and continues.

Only applies to Playwright contexts (`PlaywrightCrawlingContext`). Skip in `createCheerioHandler` and `createAdaptiveHandler`.

## App configs

Both `apps/apify-actor/src/config.ts` and `apps/standalone/src/config.ts`: pass both fields through.

## Standalone CLI (`apps/standalone/src/cliProgram.ts`)

Add `--wait-for-selector <selector>` and `--soft-wait-for-selector <selector>`.

## Docs

Update in the same pass:
- `packages/schema/SPEC.md` — add both fields
- `packages/crawler/SPEC.md` — add to key options
- `apps/apify-actor/SPEC.md` — mention in crawler settings
- `apps/standalone/SPEC.md` — mention CLI flags

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Verification

```bash
pnpm build && pnpm test
```
