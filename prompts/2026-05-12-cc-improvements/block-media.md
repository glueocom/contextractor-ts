# Block Media

> **TLDR**: Adds `blockMedia: boolean` (default `false`) schema field. When enabled, calls `playwrightUtils.blockRequests(page)` in `preNavigationHooks` to block images, fonts, stylesheets, and videos. Ignored for `'cheerio'` crawler type. Flows through schema → crawler package → both app configs → standalone CLI.

## Agent

`ts-pro`

## Schema (`packages/schema/src/source-of-truth/input.ts`)

Add in the Performance and limits section (after `pageLoadTimeoutSecs`):
```ts
blockMedia: z
  .boolean()
  .default(false)
  .describe('Block loading of images, fonts, stylesheets, and videos. Reduces bandwidth and speeds up crawling. Has no effect when using the raw HTTP crawler type.')
  .meta({ title: 'Block media', ...apifyMeta({ sectionCaption: 'Performance and limits' }) }),
```

## Crawler package (`packages/crawler/src/createCrawler.ts`)

Add `blockMedia?: boolean` to `ContextractorCrawlerOptions`.

In `createContextractorCrawler`, if `opts.blockMedia` and the crawler type is not `'cheerio'`, add to `preNavigationHooks`:
```ts
async ({ page }) => { await playwrightUtils.blockRequests(page); }
```

Import `playwrightUtils` from `@crawlee/playwright`.

## App configs

Both `apps/apify-actor/src/config.ts` and `apps/standalone/src/config.ts`: pass `blockMedia: input.blockMedia`.

## Standalone CLI (`apps/standalone/src/cliProgram.ts`)

Add `--block-media` / `--no-block-media` flags. Wire through `parseCliArgs`.

## Docs

Update in the same pass:
- `packages/schema/SPEC.md` — add `blockMedia` field
- `packages/crawler/SPEC.md` — add `blockMedia` to key options
- `apps/apify-actor/SPEC.md` — mention in crawler settings
- `apps/standalone/SPEC.md` — mention `--block-media` flag

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Verification

```bash
pnpm build && pnpm test
```
