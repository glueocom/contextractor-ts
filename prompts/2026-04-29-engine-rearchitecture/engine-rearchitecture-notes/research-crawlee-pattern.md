# Crawlee / playwright-scraper pattern — study

*Research date: 29 April 2026. Source: [`apify/actor-scraper`](https://github.com/apify/actor-scraper) + [`apify/crawlee`](https://github.com/apify/crawlee). Note: file-level permalinks pinned to `master`; re-pin to specific SHAs before final use.*

## 1. Repo layout — `apify/actor-scraper`

- **Root**: [github.com/apify/actor-scraper](https://github.com/apify/actor-scraper) (Apache-2.0, ~134★, 1,328 commits on `master` as of 2026-04-29).
- **Toolchain**: Lerna (`lerna.json`) + Turbo (`turbo.json`) + Vitest + shared TS configs.
- **Top-level dirs**: `packages/`, `scripts/`, `test/`, `.github/`, `.husky/`. **No `apps/` directory** — every shippable Actor is a sibling package next to the shared library.

```
packages/
├── actor-scraper/
│   ├── web-scraper/              # apify/web-scraper (Puppeteer + in-browser pageFunction)
│   ├── puppeteer-scraper/        # apify/puppeteer-scraper (server-side Puppeteer)
│   ├── playwright-scraper/       # apify/playwright-scraper (server-side Playwright)
│   ├── cheerio-scraper/          # apify/cheerio-scraper (raw HTTP + Cheerio)
│   ├── jsdom-scraper/            # apify/jsdom-scraper (raw HTTP + JSDOM)
│   └── website-content-crawler/  # apify/website-content-crawler (RAG/markdown crawler)
└── scraper-tools/                # @apify/scraper-tools — the SHARED LIBRARY
```

The shared package is **`@apify/scraper-tools`** (README: *"A library that houses logic common to all the scrapers."*).

> Some scrapers are mirrored under [`apify/apify-sdk-js/packages/actor-scraper/*`](https://github.com/apify/apify-sdk-js/tree/master/packages/actor-scraper) — verify which is canonical before pinning.

### `@apify/scraper-tools` — exports

`packages/scraper-tools/src/index.ts` re-exports:

```ts
export * as constants from './consts';
export * as tools from './tools';
export { browserTools } from './browser_tools';
export { createContext } from './context';
export { GlobalStore } from './global_store';
export { TimeoutError } from './errors';
```

Concrete utilities in `packages/scraper-tools/src/tools.ts`:
- `tools.createRequestDebugInfo(request, response)` — uniform debug payload.
- `tools.ensureMetaData(request)` — adds `userData.__crawlee` metadata.
- `tools.maybeLoadPageFunctionFromDisk(input, dir)` — local dev.
- `tools.evalFunctionOrThrow(funcString)` — sandboxed user `pageFunction` compile.
- `tools.createDatasetPayload(...)` — uniform dataset row.
- `tools.getMissingCookiesFromSession(session, cookies, url)` — diff-checks `input.initialCookies` against the session's stored cookies, returns those still needing to be set.
- `browserTools.createBrowserHandlesForObject(...)` — server-side handles for in-browser `pageFunction`.

Also owns: input-schema TS types (`Input`, `ProxyConfigurationOptions`, `PseudoUrlInput`, `GlobInput`), browser launch helpers, KVS save helpers, abstract `CrawlerSetup` scaffolding, constants (`META_KEY`, `SESSION_MAX_USAGE_COUNTS`).

**NOT** in `scraper-tools`: concrete `*Crawler` instantiation, the actor-specific `input_schema.json`, the Dockerfile / `actor.json`, the user-facing `pageFunction` evaluation strategy.

## 2. `playwright-scraper/src/internals/crawler_setup.ts`

[Permalink (master)](https://github.com/apify/actor-scraper/blob/master/packages/actor-scraper/playwright-scraper/src/internals/crawler_setup.ts).

The actor's thin entry (`src/main.ts`) does only:

```ts
import { Actor } from 'apify';
import { CrawlerSetup } from './internals/crawler_setup.js';

await Actor.init();
const input = await Actor.getInput<Input>();
const setup = new CrawlerSetup(input!);
const crawler = await setup.createCrawler();
await crawler.run();
await Actor.exit();
```

### 2a. PlaywrightCrawler instantiation

```ts
this.crawler = new PlaywrightCrawler({
    requestQueue: this.requestQueue,
    requestList: this.requestList,
    proxyConfiguration: this.proxyConfiguration,
    launchContext: {
        useChrome: this.input.useChrome,
        launcher: this.input.browserType === 'firefox' ? firefox : chromium,
        launchOptions: {
            ignoreHTTPSErrors: this.input.ignoreSslErrors,
            headless: this.input.headless,
            args: this.input.additionalArgs ?? [],
        },
    },
    browserPoolOptions: {
        preLaunchHooks: [/* viewport, UA */],
        prePageCreateHooks: [/* per-page tweaks */],
    },
    useSessionPool: true,
    persistCookiesPerSession: true,
    sessionPoolOptions: {
        maxPoolSize: SESSION_MAX_POOL_SIZE,
        sessionOptions: { maxUsageCount: SESSION_MAX_USAGE_COUNT },
    },
    preNavigationHooks: [this._preNavigationHook.bind(this)],
    postNavigationHooks: [this._postNavigationHook.bind(this)],
    requestHandler: this._requestHandler.bind(this),
    failedRequestHandler: this._failedRequestHandler.bind(this),
    maxRequestsPerCrawl: this.input.maxPagesPerCrawl,
    maxConcurrency: this.input.maxConcurrency,
    maxRequestRetries: this.input.maxRequestRetries,
    requestHandlerTimeoutSecs: this.input.pageLoadTimeoutSecs + this.input.pageFunctionTimeoutSecs,
    navigationTimeoutSecs: this.input.pageLoadTimeoutSecs,
});
```

Confirmed: ✅ `useSessionPool: true`, ✅ `persistCookiesPerSession: true`.

### 2b. Cookie handling — `idcac-playwright`

```ts
import { getInjectableScript } from 'idcac-playwright';

async _requestHandler(crawlingContext: PlaywrightCrawlingContext) {
    const { page, session, request } = crawlingContext;

    const missingCookies = tools.getMissingCookiesFromSession(
        session, this.input.initialCookies, request.url,
    );
    if (missingCookies.length) {
        await page.context().addCookies(
            missingCookies.map((c) => ({ ...c, url: request.url })),
        );
    }

    if (this.input.closeCookieModals) {
        await crawlingContext.page.evaluate(getInjectableScript());
    }

    if (this.input.maxScrollHeightPixels > 0) {
        await crawlingContext.infiniteScroll({
            maxScrollHeight: this.input.maxScrollHeightPixels,
        });
    }
    // … compile + run user pageFunction, push to dataset …
}
```

Key: ✅ `getInjectableScript()` from `idcac-playwright` gated on `closeCookieModals`; ✅ `crawlingContext.infiniteScroll({ maxScrollHeight })` (NOT manual `scrollBy`); ✅ `getMissingCookiesFromSession` merges initialCookies into the per-session jar.

> **For contextractor-engine**: keep this overall *shape*, but swap the `idcac-playwright`-based cookie step for the `@ghostery/adblocker-playwright` integration described in `research-cookie-dismissal.md` — that's what Apify itself did for `website-content-crawler` below.

## 3. `website-content-crawler` — Ghostery adblocker integration

[Permalink (master)](https://github.com/apify/actor-scraper/tree/master/packages/actor-scraper/website-content-crawler). Migrated from `@cliqz/adblocker-playwright` (defunct) to **`@ghostery/adblocker-playwright`** in December 2025 ([Apify blog](https://blog.apify.com/how-to-block-cookie-modals/)).

```ts
// src/internals/blocker.ts
import { PlaywrightBlocker } from '@ghostery/adblocker-playwright';
import fetch from 'node-fetch';

let blockerPromise: Promise<PlaywrightBlocker> | null = null;

export function getBlocker() {
    if (!blockerPromise) {
        blockerPromise = PlaywrightBlocker.fromLists(fetch, [
            'https://easylist.to/easylist/easylist.txt',
            'https://easylist.to/easylist/easyprivacy.txt',
            'https://secure.fanboy.co.nz/fanboy-cookiemonster.txt',
            'https://secure.fanboy.co.nz/fanboy-annoyance.txt',
        ]);
    }
    return blockerPromise;
}
```

```ts
// src/internals/crawler_setup.ts (excerpt)
preNavigationHooks: [
    async ({ page }, gotoOptions) => {
        if (this.input.removeCookieWarnings) {
            const blocker = await getBlocker();
            await blocker.enableBlockingInPage(page);
        }
        gotoOptions!.waitUntil = this.input.waitUntil ?? 'networkidle';
    },
],
```

- **Init**: lazily, first time a page is opened (cached as a module-level promise so all concurrent crawlers share one parsed rule set).
- **Attached how**: `blocker.enableBlockingInPage(page)` per page, inside `preNavigationHooks`.
- **Gating flag**: `input.removeCookieWarnings` (boolean in actor's `input_schema.json`).

## 4. Crawlee `infiniteScroll` context helper

- **Docs**: [`playwrightUtils#infiniteScroll`](https://crawlee.dev/api/playwright-crawler/namespace/playwrightUtils#infiniteScroll). Also exposed as `crawlingContext.infiniteScroll(...)`.
- **Source**: [`packages/playwright-crawler/src/internals/utils/playwright-utils.ts`](https://github.com/apify/crawlee/blob/master/packages/playwright-crawler/src/internals/utils/playwright-utils.ts).

### API signature (Crawlee 3.x)

```ts
export interface InfiniteScrollOptions {
    timeoutSecs?: number;        // hard deadline; 0 = none
    waitForSecs?: number;        // wait between scrolls; default 4
    maxScrollHeight?: number;    // px ceiling; 0 = unlimited
    scrollDownAndUp?: boolean;   // jiggle: triggers lazy-load listeners
    buttonSelector?: string;     // also click "Load more"-style buttons
    stopScrollCallback?: () => boolean | Promise<boolean>;
}

export async function infiniteScroll(page: Page, options?: InfiniteScrollOptions): Promise<void>;
```

### Why it beats manual `scrollBy(0, 500)`

1. **Network-idle aware** — waits on body height stability, not fixed sleep.
2. **Hard `timeoutSecs`** — won't hang forever on infinite feeds.
3. **`maxScrollHeight` ceiling** — prevents OOM/cost blowouts.
4. **`scrollDownAndUp` jiggle** — many lazy-load libs (lozad, IntersectionObserver polyfills) require an upward scroll to fire.
5. **`buttonSelector`** — single helper handles pure-scroll *and* "Load more" pagination.
6. **`stopScrollCallback`** — short-circuit once the data is on the page.
7. **Plays nicely with Crawlee's request handler timeout**.
8. **Tracks `previousHeight`** internally, exits when no more content loads.

## 5. Crawlee session pool / `persistCookiesPerSession`

- **Docs**: [crawlee.dev/docs/guides/session-management](https://crawlee.dev/docs/guides/session-management).

`SessionPool` keeps a rotating set of `Session` objects, each tracking error rate, usage count, and (when `persistCookiesPerSession: true`) its own `CookieJar`. Cookies set during a request are persisted to the `Session` and replayed on subsequent requests routed through that session — including across actor restarts via the KVS.

### When it matters

- ✅ Login flows where you don't want to re-login per request.
- ✅ Sites issuing anti-bot cookies (Cloudflare `cf_clearance`, Akamai `_abck`, DataDome).
- ✅ Sticky proxy IP ↔ cookie binding.
- ✅ Mark-bad-and-retire on 403/429 rotation.

### When it's overkill

- 🟡 Single-pass content extraction of public URLs with no auth, no soft-block.
- 🟡 Tiny crawls (<20 URLs) on permissive sites.
- 🟡 When you *want* every request to look like a brand-new visitor.

### Should `contextractor-engine` adopt it?

Expose `sessionPool: boolean | SessionPoolOptions` on engine config; **default `true` for browser-mode (Playwright), `false` for HTTP-only mode (Cheerio/JSDOM)** — mirrors what the Apify scrapers each pick.

## Pattern to mirror

```
packages/contextractor-engine/    (or split — see research-monorepo-structure.md)
└── src/
    ├── index.ts                  # barrel
    ├── tools.ts                  # getMissingCookiesFromSession, createRequestDebugInfo, dataset shape
    ├── consts.ts                 # SESSION_MAX_USAGE_COUNT, META_KEY, default timeouts
    ├── browser-tools.ts          # buildBrowserLaunchOptions (UA, args, viewport)
    ├── cookies.ts                # @ghostery/adblocker-playwright wrapper
    ├── scroll.ts                 # thin re-export of crawlee's infiniteScroll w/ project defaults
    ├── crawler-factory.ts        # createPlaywrightCrawler(input) — single source of truth
    ├── extraction.ts             # the actual content-extraction pageFunction
    └── types.ts                  # SharedInput, ContentResult
```

### Specific takeaways

1. **One `crawler-factory.ts` in the shared lib** — both apps call it. Verbatim duplication of `PlaywrightCrawler({...})` between apps must be deleted.
2. **Default `useSessionPool: true` and `persistCookiesPerSession: true`** for browser mode, with opt-out flag.
3. **Cookie banner dismissal** in shared lib via `@ghostery/adblocker-playwright` (NOT idcac-playwright, due to GPL-3.0).
4. **Use `crawlingContext.infiniteScroll(...)`** with `maxScrollHeight`, `scrollDownAndUp`, `buttonSelector`, `stopScrollCallback`, `timeoutSecs` — never roll your own.
5. **Initial-cookie diffing** as `getMissingCookiesFromSession(session, initialCookies, url)`.
6. **The Apify actor's `main.ts` ≤15 lines.** All real work in shared lib's `crawler-factory`.
7. **Input schema lives only in the actor**, not the shared lib. Shared lib exposes the *TypeScript* `Input` interface; JSON schema is per-app.
8. **Browser launch options helper** in shared lib — headless/UA/args drift can't happen.
