# Block Media

> **TLDR**: Adds `blockMedia: boolean` (default `false`) schema field. When enabled, calls `playwrightUtils.blockRequests(page)` in `preNavigationHooks` to block images, fonts, and stylesheets. Ignored for `'cheerio'` crawler type and no-op for non-Chromium browsers (Chromium only). Flows through schema → crawler package → both app configs → standalone CLI.

## Agent

`ts-pro`

## Schema (`packages/schema/src/source-of-truth/input.ts`)

Add in the Performance and limits section (after `pageLoadTimeoutSecs`):
```ts
blockMedia: z
  .boolean()
  .default(false)
  .describe('Block loading of images, fonts, and stylesheets. Reduces bandwidth and speeds up crawling. Has no effect when using the raw HTTP crawler type or non-Chromium browsers (Chromium only).')
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
- Relevant `README.md` files — update any manually-written sections covering the changed behaviour; `@generated` regions are handled by `pnpm docs:update`
- `apps/apify-actor/.actor/input_schema.json` — run `pnpm --filter @contextractor/gen-input-schema start` after schema changes to regenerate the Actor input UI (GUI)

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Examples

Update `/examples` to demonstrate the new option in the same pass:
- `examples/cli-npm/run.sh` — add a usage line for `--block-media`
- `examples/apify-api-ts/src/main.ts` — add `blockMedia: true` to the Actor call input
- `examples/library-ts/src/main.ts` — add `blockMedia` option

## Verification

```bash
pnpm build && pnpm test
```
