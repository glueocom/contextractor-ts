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
- Relevant `README.md` files — update any manually-written sections covering the changed behaviour; `@generated` regions are handled by `pnpm docs:update`
- `apps/apify-actor/.actor/input_schema.json` — run `pnpm --filter @contextractor/gen-input-schema start` after schema changes to regenerate the Actor input UI (GUI)

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Examples

Update `/examples` to demonstrate the new option in the same pass:
- `examples/cli-npm/run.sh` — add a usage line for `--initial-concurrency`
- `examples/apify-api-ts/src/main.ts` — add `initialConcurrency` to the Actor call input
- `examples/library-ts/src/main.ts` — add `initialConcurrency` option

## Verification

```bash
pnpm build && pnpm test
```
