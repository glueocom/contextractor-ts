# Step CREATE-CRAWLER: Create `@contextractor/crawler`

## TLDR

Creates `packages/crawler/` (`@contextractor/crawler`) with the `PlaywrightCrawler` factory, request handler, browser launch helpers, Ghostery-based cookie dismissal, and Crawlee's `infiniteScroll`. Absorbs duplicated logic from both apps. Shrinks `apps/contextractor-apify/src/main.ts` to ≤30 LOC and `apps/contextractor-standalone/src/cli.ts` to ≤40 LOC. Deletes `handler.ts` (apify) and `crawler.ts` (standalone).

**Notes**: [`../engine-rearchitecture-notes/research-cookie-dismissal.md`](../engine-rearchitecture-notes/research-cookie-dismissal.md), [`../engine-rearchitecture-notes/research-crawlee-pattern.md`](../engine-rearchitecture-notes/research-crawlee-pattern.md), [`../engine-rearchitecture-notes/research-monorepo-structure.md`](../engine-rearchitecture-notes/research-monorepo-structure.md)

**Skills/agents**: `ts-pro`, `apify-actor-development`

---

## Step SCAFFOLD: Create package skeleton

Create `packages/crawler/` with:

**`packages/crawler/package.json`**:
- `name`: `@contextractor/crawler`
- `private: true`
- `dependencies`: `@contextractor/extraction: workspace:*`, `crawlee`, `playwright` (match versions in apps), `@ghostery/adblocker-playwright` (latest `^2.14.x`)
- `devDependencies`: typescript, biome, vitest, @types/node
- `scripts`: `build`, `test`, `lint`

**`packages/crawler/tsconfig.json`**: extend `../../tsconfig.base.json`

## Step SINKS: Define `Sink<T>` and built-in sinks

**`packages/crawler/src/sinks/types.ts`**:
- `Sink<T> = (result: T) => Promise<void>`
- `ExtractionResult` interface: `{ url: string; html: string; metadata: DatasetMetadata; formats: Partial<Record<OutputFormat, string>>; rawHtmlHash: string; rawHtmlLength: number }`

**`packages/crawler/src/sinks/memory.ts`**:
- `memorySink<T>()` returns a `Sink<T>` augmented with `.results: T[]` — used in tests

**`packages/crawler/src/sinks/file.ts`**:
- `fileSink(opts: { outDir: string; formats?: OutputFormat[] }): Sink<ExtractionResult>` — port from `apps/contextractor-standalone/src/crawler.ts` (`saveFormat` logic), including `urlToFilename` and metadata-header prepending for txt/markdown

## Step BROWSER: Browser helpers

**`packages/crawler/src/browser/launchOptions.ts`**:
- `buildBrowserLaunchOptions(opts: { launcher: 'chromium' | 'firefox'; ignoreSslErrors?: boolean }): LaunchOptions` — unify both apps' versions (Apify adds `--disable-gpu`, standalone adds `--no-sandbox` env guard; include both)

**`packages/crawler/src/browser/cookies.ts`**:
- `getBlocker(cachePath?: string): Promise<PlaywrightBlocker>` — lazy singleton; uses `globalThis.fetch` (Node 22+, no `cross-fetch`); lists: EasyList, EasyPrivacy, fanboy-annoyance, fanboy-cookiemonster; cache at `cachePath` (default `.cache/adblock-engine.bin`)
- `installCookieDefences(page: Page): Promise<void>` — calls `blocker.enableBlockingInPage(page)`; does **not** add a separate `page.route` (Ghostery already handles request-blocking via its own interception; a second `page.route` competes with it — see research cookie dismissal doc §3)

**`packages/crawler/src/browser/scroll.ts`**:
- `autoScroll(context: PlaywrightCrawlingContext, opts?: InfiniteScrollOptions): Promise<void>` — thin wrapper calling `context.infiniteScroll(opts)` with project defaults (`waitForSecs: 2`)

## Step HANDLER: Page handler

**`packages/crawler/src/handler.ts`**:
- `createHandler(opts: HandlerOpts): RequestHandler` — internal handler factory
- `HandlerOpts`: `{ extractionConfig?: TrafilaturaConfig; sink: Sink<ExtractionResult>; cookieStrategy: 'ghostery' | 'autoconsent' | 'none'; scroll?: ScrollConfig; formats: OutputFormat[]; maxResults?: number; linkSelector?: string; maxCrawlingDepth?: number; globs?: string[]; excludes?: string[]; keepUrlFragments?: boolean }`
- Handler flow: log URL → cookie defence (if `cookieStrategy !== 'none'`) → scroll (if enabled) → `page.content()` → extract all requested formats → call `sink(result)` → enqueue links (if configured)
- `enqueueLinks` logic ported from `apps/contextractor-apify/src/handler.ts` (depth tracking, glob/exclude filtering)

## Step FACTORY: Crawler factory

**`packages/crawler/src/createCrawler.ts`**:
- `ContextractorCrawlerOptions`: `{ startUrls: string[]; sink: Sink<ExtractionResult>; extractionConfig?: TrafilaturaConfig; formats?: OutputFormat[]; scroll?: ScrollConfig; cookieStrategy?: 'ghostery' | 'autoconsent' | 'none'; sessionPool?: boolean | SessionPoolOptions; maxPages?: number; maxRetries?: number; maxConcurrency?: number; pageLoadTimeoutSecs?: number; headless?: boolean; launcher?: 'chromium' | 'firefox'; ignoreSslErrors?: boolean; bypassCSP?: boolean; initialCookies?: unknown[]; extraHTTPHeaders?: Record<string, string>; userAgent?: string; linkSelector?: string; maxCrawlingDepth?: number; maxResults?: number; globs?: string[]; excludes?: string[]; keepUrlFragments?: boolean; proxyConfiguration?: ProxyConfiguration; browserLog?: boolean }`
- `createContextractorCrawler(opts: ContextractorCrawlerOptions): Promise<PlaywrightCrawler>`
  - `useSessionPool: true` and `persistCookiesPerSession: true` by default (override with `sessionPool: false`)
  - wires `installCookieDefences` via `preNavigationHooks` when `cookieStrategy !== 'none'`
  - sets `launchContext.contextOptions` for bypassCSP, initialCookies, extraHTTPHeaders, userAgent
  - registers handler via `router.addDefaultHandler`

## Step BARREL: Export barrel

**`packages/crawler/src/index.ts`**: export `createContextractorCrawler`, `ContextractorCrawlerOptions`, `ExtractionResult`, `Sink`, `fileSink`, `memorySink`, `autoScroll`, `installCookieDefences`

## Step SHRINK-APIFY: Shrink Apify actor entry point

**`apps/contextractor-apify/src/main.ts`** — rewrite to ≤30 LOC:
- Import `createContextractorCrawler` from `@contextractor/crawler`
- Keep `kvsSink` and `datasetSink` logic locally in `extraction.ts` (or new `sinks.ts`)
- Remove all Playwright/Crawlee imports from `main.ts`
- Flow: `Actor.init()` → validate input → `createContextractorCrawler({ sink: kvsSink(...) })` → `crawler.run(requests)` → `Actor.exit()`

**Delete** `apps/contextractor-apify/src/handler.ts` — logic now in `@contextractor/crawler`

**Simplify** `apps/contextractor-apify/src/config.ts`:
- Remove `buildBrowserLaunchOptions` (moved to crawler)
- Keep `buildCrawlConfig` or inline it into `main.ts` (prefer inline if ≤30 LOC allows)

**`apps/contextractor-apify/package.json`**: add `@contextractor/crawler: workspace:*`

## Step SHRINK-STANDALONE: Shrink standalone CLI entry point

**`apps/contextractor-standalone/src/cli.ts`** — rewrite to ≤40 LOC:
- Import `createContextractorCrawler`, `fileSink` from `@contextractor/crawler`
- Keep config loading (`loadConfigFile`) in `config.ts`
- Remove all Playwright/Crawlee imports from `cli.ts`
- No direct Playwright import in cli.ts

**Delete** `apps/contextractor-standalone/src/crawler.ts` — logic now in `@contextractor/crawler`

**`apps/contextractor-standalone/package.json`**: add `@contextractor/crawler: workspace:*`

## Step VERIFY: Build and test

Run `pnpm build`. Run `pnpm test`. Run `pnpm lint`. Fix all issues. Run `apify run` smoke test.

Commit message: `feat: create @contextractor/crawler; wire Ghostery; replace scroll loop; shrink entry points`
