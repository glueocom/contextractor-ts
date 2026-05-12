# Initial Concurrency

> **TLDR**: Adds `initialConcurrency: int` (default `0`, meaning Crawlee auto-selects). Maps to Crawlee's `minConcurrency` option. Trivial addition — one schema field, one option pass-through in both app configs, one CLI flag.

## Agent

`ts-pro`

## Schema (`packages/schema/src/source-of-truth/input.ts`)

Add in the Performance and limits section (before `maxConcurrency`):
```ts
initialConcurrency: z
  .int()
  .min(0)
  .default(0)
  .describe('Initial number of browser pages or HTTP clients running in parallel. Crawlee auto-scales up to maxConcurrency. 0 lets Crawlee pick the default.')
  .meta({ title: 'Initial concurrency' }),
```

## Crawler package (`packages/crawler/src/createCrawler.ts`)

Add `initialConcurrency?: number` to `ContextractorCrawlerOptions`.

Pass to the crawler constructor:
```ts
...(opts.initialConcurrency ? { minConcurrency: opts.initialConcurrency } : {}),
```

## App configs

Both `apps/apify-actor/src/config.ts` and `apps/standalone/src/config.ts`: pass `initialConcurrency: input.initialConcurrency`.

## Standalone CLI (`apps/standalone/src/cliProgram.ts`)

Add `--initial-concurrency <n>`.

## Docs

Update in the same pass:
- `packages/schema/SPEC.md` — add `initialConcurrency`
- `packages/crawler/SPEC.md` — add to key options
- `apps/apify-actor/SPEC.md` and `apps/standalone/SPEC.md` — mention in performance settings

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Verification

```bash
pnpm build && pnpm test
```
