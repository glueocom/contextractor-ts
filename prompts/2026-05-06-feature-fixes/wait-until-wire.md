# Wire `waitUntil` through to Crawlee `gotoOptions`

## Context

The `waitUntil` field is exposed by the Zod input schema and the standalone `--wait-until` CLI flag. It is parsed, validated, lowercased via `WAIT_UNTIL_MAP`, and stored in `CrawlConfig.waitUntil` — but `ContextractorCrawlerOptions` has no `waitUntil` field, so the value never reaches Playwright. Every navigation runs with Crawlee's pass-through default of `'load'` regardless of what the user sets. The `autonomous-task-output/todo/sync-gui` audit flagged this as Issue 1 (Medium).

This prompt implements Option A from the audit (wire it through). The decision was re-verified against `apify/playwright-scraper`, which exposes `waitUntil` as a primary, foregrounded knob under "Performance and limits" with the same `preNavigationHooks` mutation pattern used in `crawler_setup.ts`. `contextractor-ts` already exposes the rest of the Playwright-Scraper-shaped knob surface (`launcher`, `headless`, `cookieStrategy`, `ignoreCorsAndCsp`, `userAgent`, `customHttpHeaders`, `initialCookies`, `linkSelector`); `waitUntil` is the missing member of that surface.

The default stays `'LOAD'`. Do not change it to `'networkidle'` — contextractor extracts articles, not SPAs that need the full settle.

## Skills and Agents

- `ts-pro` — TypeScript implementation
- `apify-schemas` — schema metadata reference

## Files to Change

### `packages/crawler/src/createCrawler.ts`

Add `waitUntil` to the options interface. Place it next to the related browser/timeout fields (under `pageLoadTimeoutSecs`):

```ts
pageLoadTimeoutSecs?: number;
/**
 * Navigation lifecycle event to wait for in `page.goto`.
 * Forwarded to Crawlee via `preNavigationHooks` → `gotoOptions.waitUntil`.
 * If undefined, Playwright's default of `'load'` applies.
 */
waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
```

Add `PlaywrightHook` to the type-only import from `crawlee`:

```ts
import type { PlaywrightHook, ProxyConfiguration, RequestProvider, SessionPoolOptions } from 'crawlee';
```

Refactor the conditional `preNavigationHooks` spread into an explicit array. The current code spreads `preNavigationHooks` only when `cookieStrategy === 'ghostery'`; that branch needs to widen to include the `waitUntil` hook. Replace the existing `cookieStrategy === 'ghostery'` spread block:

```ts
...(cookieStrategy === 'ghostery'
  ? {
      preNavigationHooks: [async ({ page }) => installCookieDefences(page)],
    }
  : {}),
```

with this — built before the `new PlaywrightCrawler({...})` call:

```ts
const preNavigationHooks: PlaywrightHook[] = [];
if (opts.waitUntil !== undefined) {
  preNavigationHooks.push(async (_ctx, gotoOptions) => {
    if (gotoOptions) gotoOptions.waitUntil = opts.waitUntil;
  });
}
if (cookieStrategy === 'ghostery') {
  preNavigationHooks.push(async ({ page }) => installCookieDefences(page));
}
```

and then in the `new PlaywrightCrawler({...})` call, replace the conditional ghostery spread with:

```ts
...(preNavigationHooks.length > 0 ? { preNavigationHooks } : {}),
```

Leave the `cookieStrategy === 'autoconsent'` `postNavigationHooks` block untouched. Order matters: the `waitUntil` hook must run before the Ghostery hook so `gotoOptions` is set before any cookie-defence work that reads from the page.

### `apps/standalone/src/cliProgram.ts`

Pass `waitUntil` through in the `createContextractorCrawler({...})` call. Add this line near the other browser knobs (next to `headless`, `launcher`, `pageLoadTimeoutSecs`):

```ts
waitUntil: cfg.waitUntil,
```

`cfg.waitUntil` is already populated lowercase by `WAIT_UNTIL_MAP` in `buildCrawlConfig` — no transformation needed.

### `apps/apify-actor/src/config.ts`

Add a `WAIT_UNTIL_MAP` next to the existing `LAUNCHER_MAP`:

```ts
const WAIT_UNTIL_MAP = {
  LOAD: 'load',
  DOMCONTENTLOADED: 'domcontentloaded',
  NETWORKIDLE: 'networkidle',
} as const;
```

In the `buildCrawlerOpts` return object, add the field next to `pageLoadTimeoutSecs`:

```ts
pageLoadTimeoutSecs: input.pageLoadTimeoutSecs,
waitUntil: WAIT_UNTIL_MAP[input.waitUntil],
```

### `packages/schema/src/input.ts`

Add `sectionCaption` and `sectionDescription` to the existing `waitUntil` field's `apifyMeta` so it groups under "Performance and limits" in the Apify Console UI alongside `pageLoadTimeoutSecs` (current placement inherits whatever section the field above sets). Do not change the Zod default — `'LOAD'` is correct for this tool.

```ts
waitUntil: z
  .enum(['NETWORKIDLE', 'LOAD', 'DOMCONTENTLOADED'])
  .default('LOAD')
  .describe(
    'When to consider navigation finished. NETWORKIDLE waits for 500ms of network silence (best for JS-heavy SPAs, slower); LOAD waits for the load event (default, good for most articles); DOMCONTENTLOADED is fastest but may fire before client-side rendering completes.',
  )
  .meta({
    title: 'Navigation wait until',
    ...apifyMeta({
      editor: 'select',
      enumTitles: ['Network idle', 'Load event', 'DOM content loaded'],
      sectionCaption: 'Performance and limits',
    }),
  }),
```

If `pageLoadTimeoutSecs` currently sets `sectionCaption: 'Browser'`, move that field's `sectionCaption` to `'Performance and limits'` too so both knobs land in the same section. Keep `pageLoadTimeoutSecs` adjacent to `waitUntil` in the file so the generated schema preserves their grouping.

## After Implementation

Regenerate the Apify input schema:

```bash
pnpm --filter @contextractor/gen-input-schema start
```

Verify build, lint, tests:

```bash
pnpm build && pnpm lint && pnpm test
```

Smoke-test the standalone CLI with each value and confirm the network behaviour differs (use a JS-heavy URL where `domcontentloaded` returns less HTML than `networkidle`):

```bash
node apps/standalone/dist/cli.js --wait-until domcontentloaded https://example.com -o ./out-dcl
node apps/standalone/dist/cli.js --wait-until load            https://example.com -o ./out-load
node apps/standalone/dist/cli.js --wait-until networkidle     https://example.com -o ./out-ni
```

Confirm via `pnpm test --filter @contextractor/schema` that the schema snapshot test still passes after `input_schema.json` regeneration. If the snapshot needs updating because of the `sectionCaption` change, run with `--update-snapshots`.

## Out of Scope

- Per-request `waitUntil` overrides via `request.userData`. The Apify Playwright Scraper does not support this either; introduce only if a concrete need appears.
- Changing the default to `'NETWORKIDLE'`. Not appropriate for content extraction.
- Touching the audit's Issue 2 (proxy flags) or Issue 3 (html output in actor) — separate prompts.
