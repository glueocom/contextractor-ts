# Dynamic Content Wait

> **TLDR**: Adds `dynamicContentWaitSecs: int` (default `0`, disabled). When set, waits for network idle up to this timeout after page navigation — a timeout-based alternative to the existing event-based `waitUntil`. Also used as the timeout for `waitForSelector` / `softWaitForSelector`. Flows through schema → crawler package handler → both app configs → standalone CLI.

## Agent

`ts-pro`

## Schema (`packages/schema/src/source-of-truth/input.ts`)

Add in the Performance and limits section (before `waitUntil`):
```ts
dynamicContentWaitSecs: z
  .int()
  .min(0)
  .default(0)
  .describe('Maximum seconds to wait for dynamic page content to load after navigation. The crawler continues when the network goes idle or this timeout elapses, whichever comes first. 0 disables this wait. Also used as the timeout for waitForSelector and softWaitForSelector.')
  .meta({ title: 'Dynamic content wait', ...apifyMeta({ unit: 'seconds' }) }),
```

## Crawler package

### `ContextractorCrawlerOptions` (`createCrawler.ts`)

Add `dynamicContentWaitSecs?: number`.

### Handler (`handler.ts`)

Add to `HandlerOpts`. In the handler, after scroll and before `page.content()`, if `dynamicContentWaitSecs > 0`:
```ts
await page.waitForLoadState('networkidle', { timeout: dynamicContentWaitSecs * 1000 }).catch(() => {});
```

The `.catch(() => {})` ensures the page is not failed on timeout — it continues with whatever content is available. Only applies to Playwright contexts; skip in `createCheerioHandler`.

Pass `dynamicContentWaitSecs` through to `HandlerOpts` so that `waitForSelector` / `softWaitForSelector` can use it as their timeout.

## App configs

Both `apps/apify-actor/src/config.ts` and `apps/standalone/src/config.ts`: pass `dynamicContentWaitSecs: input.dynamicContentWaitSecs`.

## Standalone CLI (`apps/standalone/src/cliProgram.ts`)

Add `--dynamic-content-wait <seconds>`.

## Docs

Update in the same pass:
- `packages/schema/SPEC.md` — add `dynamicContentWaitSecs` field
- `packages/crawler/SPEC.md` — add to key options; note interaction with `waitForSelector`
- `apps/apify-actor/SPEC.md` — mention in crawler settings
- `apps/standalone/SPEC.md` — mention CLI flag

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Verification

```bash
pnpm build && pnpm test
```
