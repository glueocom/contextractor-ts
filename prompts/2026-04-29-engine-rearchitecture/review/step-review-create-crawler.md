# Review: Step CREATE-CRAWLER

Review the code changes from [`../implementation/step-create-crawler.md`](../implementation/step-create-crawler.md). Automatically fix all issues found.

## Step DIFF: Identify changes

Run `git log --oneline -20`. Identify the CREATE-CRAWLER commit(s). Run `git diff {prev}..{crawler-commit}`.

## Step REVIEW-GHOSTERY: Verify cookie dismissal implementation

- `packages/crawler/src/browser/cookies.ts`:
  - Uses `globalThis.fetch` — no import of `cross-fetch` or `node-fetch`
  - `getBlocker` is a lazy singleton (module-level cache, not per-page)
  - Cache file path has a sensible default (`.cache/adblock-engine.bin`)
  - `installCookieDefences` calls `blocker.enableBlockingInPage(page)` inside `preNavigationHooks`
  - Does NOT add a competing `page.route` (would conflict with Ghostery's own interception — see `research-cookie-dismissal.md` §3)
  - No `@cliqz/adblocker-playwright` or `idcac-playwright` imports anywhere

Fix any violations.

## Step REVIEW-SCROLL: Verify scroll replacement

- `packages/crawler/src/browser/scroll.ts`: calls `context.infiniteScroll(opts)` — no manual `scrollBy` loop
- No manual `page.evaluate(async (max) => { while (...) window.scrollBy(...) })` pattern exists anywhere in the codebase

Run: `grep -r "scrollBy" apps/ packages/ --include="*.ts"` — should return zero hits. Fix any remaining manual scrolls.

## Step REVIEW-SESSION-POOL: Verify defaults

In `packages/crawler/src/createCrawler.ts`, `PlaywrightCrawler` is instantiated with `useSessionPool: true` and `persistCookiesPerSession: true` by default. Verify these are present and can be overridden via the `sessionPool: false` option.

## Step REVIEW-ENTRY-POINTS: Verify LOC constraints

- `apps/contextractor-apify/src/main.ts` (or post-rename path): count non-blank, non-comment lines — must be ≤30
- `apps/contextractor-standalone/src/cli.ts` (or post-rename path): must be ≤40
- Neither file contains a direct `import ... from 'playwright'` or `import ... from 'crawlee'`

Run: `grep -n "from 'playwright'\|from 'crawlee'" apps/contextractor-apify/src/main.ts apps/contextractor-standalone/src/cli.ts` — should return zero hits.

Fix if any constraint is violated.

## Step REVIEW-DELETED-FILES: Verify dead code removed

- `apps/contextractor-apify/src/handler.ts` must not exist
- `apps/contextractor-standalone/src/crawler.ts` must not exist
- No `COOKIE_DISMISS_SCRIPT` constant anywhere

Run: `grep -r "COOKIE_DISMISS_SCRIPT" apps/ packages/ --include="*.ts"` — zero hits expected. Fix.

## Step REVIEW-SINK-TYPES: Verify `Sink<T>` and built-in sinks

- `Sink<T>` type exported from `@contextractor/crawler`
- `fileSink` and `memorySink` exported
- `kvsSink` and `datasetSink` are NOT in `@contextractor/crawler` — they stay in `apps/contextractor-apify/src/`

## Step REVIEW-BIOME: TypeScript linting

Run `pnpm lint` from repo root. Fix all Biome errors and warnings.
