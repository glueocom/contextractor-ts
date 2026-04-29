# Cookie modal dismissal — decision report

*Research date: 29 April 2026. Target: `packages/contextractor-engine` consolidation in `contextractor-ts` monorepo.*

## TL;DR

**Primary: [`@ghostery/adblocker-playwright`](https://www.npmjs.com/package/@ghostery/adblocker-playwright)** (MPL-2.0, actively maintained, used in production by Apify's Website Content Crawler since Dec 2025). **Fallback: [`@duckduckgo/autoconsent`](https://www.npmjs.com/package/@duckduckgo/autoconsent)** (MPL-2.0) for sites needing a real click-Reject opt-out flow. Wrap both behind a `dismissCookieBanner(page, mode)` helper inside the engine package. **Drop `idcac-playwright`** — upstream IDCAC dead since Nov 2023, Apify migrated away, and the package is GPL-3.0 (incompatible with the standalone CLI's npm distribution).

## 1. `idcac-playwright` — stale, do not adopt

- **npm**: [`idcac-playwright`](https://www.npmjs.com/package/idcac-playwright) — latest **`0.1.3`**, last published mid-2025, ~**18,053 weekly downloads** ([Snyk advisor](https://snyk.io/advisor/npm-package/idcac-playwright)).
- **Repo**: [apify/idcac](https://github.com/apify/idcac) — **15 commits**, single contributor, 18 stars, 0 open issues, no releases. Effectively unmaintained.
- **License**: **GPL-3.0** ([LICENSE](https://github.com/apify/idcac/blob/master/LICENSE)). ⚠ Strong copyleft — material risk for the standalone CLI on npm.
- **What it ships**: single `index.js` exporting `getInjectableScript()` returning the compiled bundle (~1.3 MB) of the original "I Don't Care About Cookies" Firefox extension. Selectors baked in, not exposed.
- **Upstream is dead**: original IDCAC was acquired by Avast/Gen Digital and **has had no maintenance since November 2023**, confirmed by Apify ([blog post, Dec 22 2025](https://blog.apify.com/how-to-block-cookie-modals/)): *"the browser extension hasn't seen any maintenance since November 2023, which means that many new variations of cookie dialogs have appeared since then, and the extension is not prepared to deal with them."*

## 2. Crawlee `closeCookieModals()` context helper

- **Docs**: [`PlaywrightCrawlingContext.closeCookieModals`](https://crawlee.dev/js/api/playwright-crawler/interface/PlaywrightCrawlingContext) and [`playwrightUtils` namespace](https://crawlee.dev/js/api/playwright-crawler/namespace/playwrightUtils) — *"Tries to close cookie consent modals on the page. Based on the I Don't Care About Cookies browser extension. **Note that this method requires the `idcac-playwright` package to be installed. Crawlee does not include it by default due to licensing issues.**"*
- **Source / introduction PR**: [PR #1927 (July 2023)](https://github.com/apify/crawlee/pull/1927), merged as commit [`98d93bb`](https://github.com/apify/crawlee/commit/98d93bb6713ec219baa83db2ad2cd1d7621a3339). Implementation: [`packages/playwright-crawler/src/internals/utils/playwright-utils.ts`](https://github.com/apify/crawlee/blob/master/packages/playwright-crawler/src/internals/utils/playwright-utils.ts). Puppeteer parallel: [`packages/puppeteer-crawler/src/internals/utils/puppeteer_utils.ts`](https://github.com/apify/crawlee/blob/master/packages/puppeteer-crawler/src/internals/utils/puppeteer_utils.ts). Registered onto context via `context.closeCookieModals = () => closeCookieModals(context.page)`.
- **Wrapped library**: still **`idcac-playwright`** as of April 2026 — Crawlee has **not** migrated the helper. The Ghostery migration happened only in the Website Content Crawler actor.
- **Constraints**: must `npm i idcac-playwright` separately (peer dep, not bundled because of GPL-3.0). Helper expects you to call it in `postNavigationHooks`. Performance caveat from the original PR: injects ~1.3 MB JS per page. Works in Chromium/Firefox/WebKit.

## 3. `@ghostery/adblocker-playwright` — primary recommendation

- **npm**: [`@ghostery/adblocker-playwright`](https://www.npmjs.com/package/@ghostery/adblocker-playwright). Latest stable **`2.14.1`** (Feb 2026); patch releases `2.14.2`/`2.14.3` tracked by [dependabot PRs as recent as 28 Apr 2026](https://dependabot.ecosyste.ms/hosts/GitHub/repositories/SlickyCorp-Heavy-Manufacturing/SlickBot/issues/1255). **License: MPL-2.0**. Install size **~83.4 kB** for the Playwright wrapper.
- **Repo**: [ghostery/adblocker](https://github.com/ghostery/adblocker) — 977 stars, 118 forks, MPL-2.0, last activity 28 Apr 2026. uBlock Origin/EasyList compatible (~99% per [Compatibility Matrix](https://github.com/ghostery/adblocker/wiki/Compatibility-Matrix)).
- **API surface** ([npm README](https://www.npmjs.com/package/@ghostery/adblocker-playwright)):

```ts
import { PlaywrightBlocker } from '@ghostery/adblocker-playwright';
import fetch from 'cross-fetch';

PlaywrightBlocker.fromPrebuiltAdsOnly(fetch);
PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
PlaywrightBlocker.fromPrebuiltFull(fetch);   // ads + tracking + annoyances (cookie modals)
PlaywrightBlocker.fromLists(fetch, [
  'https://secure.fanboy.co.nz/fanboy-cookiemonster.txt',     // EasyList Cookie List
  'https://easylist-downloads.adblockplus.org/fanboy-annoyance.txt',
]);

await blocker.enableBlockingInPage(page);
await blocker.disableBlockingInPage(page);
blocker.serialize() / PlaywrightBlocker.deserialize(buf); // ~10x faster cold start
```

- **How it dismisses cookies**: EasyList Annoyances/Cookie filter lists ship cosmetic filters (`##.cookie-banner`) and network filters (`||cookielaw.org^`, `||onetrust.com^`, `||cookiebot.com^`). Library handles both request interception and DOM cosmetic injection — works against OneTrust, Cookiebot, Quantcast, Didomi without selector hardcoding. Lists continuously updated by the EasyList community.
- **Apify Website Content Crawler integration**: confirmed migration December 2025 ([blog](https://blog.apify.com/how-to-block-cookie-modals/)) — *"What finally worked is Ghostery's adblocker integration for Playwright — a lightweight, actively maintained library… out-of-the-box support for Playwright. We don't have to bother with setting up network interception or observing DOM mutations to prevent cookie dialogs from popping up — it is all handled by the library."*
- **Caveats**: combining `enableBlockingInPage(page)` with manual `page.route('**/*', …)` is fiddly — last `page.route` registered wins; prefer `blocker.blockFonts()/blockImages()/blockMedias()` helpers ([Discussion #2333](https://github.com/ghostery/adblocker/discussions/2333)).

## 4. `@duckduckgo/autoconsent` — fallback for click-to-reject flows

- **npm**: [`@duckduckgo/autoconsent`](https://www.npmjs.com/package/@duckduckgo/autoconsent). Current **`14.44.0`** in [package.json](https://github.com/duckduckgo/autoconsent/blob/main/package.json); latest GitHub release **`v14.59.0`** dated **11 Mar 2026** ([releases](https://github.com/duckduckgo/autoconsent/releases)). 174 releases, 1,464 commits, **MPL-2.0**.
- **Repo**: [duckduckgo/autoconsent](https://github.com/duckduckgo/autoconsent) — very active (monthly EasyList Cookie syncs, near-daily PRs for new CMP rules).
- **CMP coverage** (rules under [`/lib/cmps`](https://github.com/duckduckgo/autoconsent/tree/main/lib/cmps) plus [`/rules`](https://github.com/duckduckgo/autoconsent/tree/main/rules)): explicit rules for **OneTrust, TrustArc, Cookiebot, Sourcepoint, Didomi, Quantcast, Klaro, Civic, Admiral, Sirdata, Termly, TagCommander, Evidon**, plus EasyList-Cookie cosmetic filterlist (opt-in via `enableFilterlist: true`). OneTrust ruleset at [`lib/cmps/onetrust.ts`](https://github.com/duckduckgo/autoconsent/blob/main/lib/cmps/onetrust.ts).
- **OPT_IN supported**: ✅ — `autoAction: 'optIn' | 'optOut' | null` ([api.md](https://github.com/duckduckgo/autoconsent/blob/main/docs/api.md)). Philosophical opposite of IDCAC/Ghostery, which simply *hide* — autoconsent drives the **Reject All** click flow and verifies success.
- **Playwright integration**: content-script primitive; must inject per frame and orchestrate the message bus. There's a [`playwright/`](https://github.com/duckduckgo/autoconsent/tree/main/playwright) directory with the upstream's own test harness.

```ts
await page.addInitScript({
  content: `(${(rulesJson) => {
    const consent = new AutoConsent(
      (msg) => window.postMessage({ __autoconsent: msg }, '*'),
      { enabled: true, autoAction: 'optOut', enableCosmeticRules: true, detectRetries: 20 },
      rulesJson,
    );
    window.addEventListener('message', (e) => {
      if (e.data?.__autoconsentReply) consent.receiveMessageCallback(e.data.__autoconsentReply);
    });
  }})(${JSON.stringify(rules)})`,
});
```

- Apify rejected it for Website Content Crawler due to integration complexity + philosophical mismatch. For `contextractor-engine`, useful when scrape demands a real Reject click (sites that gate content on consent state change).
- **License**: MPL-2.0.

## 5. Other tools — quick rejected

| Tool | Status | Verdict |
|---|---|---|
| **"I still don't care about cookies"** ([OhMyGuus](https://github.com/OhMyGuus/I-Still-Dont-Care-About-Cookies)) | Active fork, v1.1.9 Dec 2025, 4.1k stars, GPL-3.0. Browser extension only — no npm package. | Skip. |
| **Cookie Dialog Monster** ([wanhose](https://github.com/wanhose/cookie-dialog-monster)) | Active extension; no npm Playwright package. Apify evaluated Dec 2025 — "didn't block consistently." | Skip. |
| **Consent-O-Matic** ([cavi-au](https://github.com/cavi-au/Consent-O-Matic)) | Aarhus University academic project; >200 CMPs. No standalone npm. Rule format consumed by `@duckduckgo/autoconsent` via `ConsentOMaticCMP`. | Use indirectly via autoconsent. |
| **`@cliqz/adblocker-playwright`** | Renamed to `@ghostery/*`; npm shows deprecation. | Don't pin. |

## 6. Browser-level approaches — complement, not substitute

### 6.1 Request route blocking

```ts
const CMP_DOMAINS = [
  'cookielaw.org', 'onetrust.com', 'cookiebot.com', 'consent.cookiebot.com',
  'quantcast.mgr.consensu.org', 'quantcount.com',
  'didomi.io', 'sdk.privacy-center.org',
  'sourcepoint.com', 'consent.cmp.', 'trustarc.com',
];
await page.route('**/*', (route) => {
  const host = new URL(route.request().url()).hostname;
  if (CMP_DOMAINS.some((d) => host.includes(d))) return route.abort();
  return route.continue();
});
```

**Works better than DOM cleanup when** the CMP is rendered by a 3rd-party script. Killing the script means the modal never paints — zero flicker, zero token waste, no cleanup race.

**Breaks page rendering when** the site soft-blocks content behind consent (some EU news outlets gate article DOM until OneTrust resolves), uses an SPA where the consent SDK boots analytics/tag-manager other JS depends on, or wraps body in a "lock" overlay activated by absence of consent cookie ([use-apify.com 2026 guide](https://use-apify.com/blog/blocking-cookie-modals-scraping-2026) calls these "lock mechanisms").

### 6.2 `addInitScript` / pre-set consent cookies

```ts
await context.addCookies([
  { name: 'OptanonAlertBoxClosed', value: new Date().toISOString(), domain: '.example.com', path: '/' },
  { name: 'CookieConsent', value: '{stamp:%27...%27,necessary:true}', domain: '.example.com', path: '/' },
  { name: 'euconsent-v2', value: 'CPx-stub', domain: '.example.com', path: '/' },
]);
await context.addInitScript(() => {
  window.__tcfapi = (cmd, _v, cb) => cb({ gdprApplies: false, eventStatus: 'tcloaded' }, true);
});
```

Pairs well with route-blocking for "early kill" defence-in-depth.

### 6.3 CDP-level

Not worth it — Playwright's `page.route` already lowers to CDP `Fetch.enable`. CDP only buys per-frame interception which `page.route` already provides.

### 6.4 Hybrid (recommended)

Apify's Dec 2025 production approach: (a) Ghostery adblocker handles request-blocking + cosmetic CSS automatically from EasyList Annoyances; (b) optionally augment with route-blocking known CMP domains for belt-and-suspenders; (c) call autoconsent only when scrape demands a real Reject click.

## 7. Recommendation

### Decision

- **Primary**: `@ghostery/adblocker-playwright` (MPL-2.0, 2.14.x).
- **Fallback**: `@duckduckgo/autoconsent` (MPL-2.0, 14.x), lazy-loaded.
- **Drop**: `idcac-playwright`, all hardcoded `COOKIE_DISMISS_SCRIPT`, the Crawlee `closeCookieModals()` helper.

### Justification matrix

| Criterion | Ghostery | autoconsent | idcac-playwright |
|---|---|---|---|
| Maintenance | 28 Apr 2026; 2.14.3 last week | Release 11 Mar 2026; 174 releases | IDCAC dead since Nov 2023 |
| License | **MPL-2.0** ✅ | **MPL-2.0** ✅ | **GPL-3.0** ❌ blocks closed CLI |
| Coverage | EasyList Cookie + Annoyances | 22+ CMP classes + ConsentOMatic + EasyList | Frozen IDCAC ruleset |
| Bundle | 83.4 kB pkg + ~5 MB filters (~1 MB serialized) | ~500 kB rules.json + ~50 kB lib | 1.3 MB injected/page |
| Apify Actor | ✅ Production proven (WCC since Dec 2025) | ✅ heavier integration | ✅ deprecated path |
| Node CLI | ✅ Single import, fetch-based init | ⚠ Per-frame message-bus glue | ✅ but GPL contagion |

### Reference implementation: `engine/cookies.ts`

```ts
import { PlaywrightBlocker } from '@ghostery/adblocker-playwright';
import fetch from 'cross-fetch';
import fs from 'node:fs/promises';
import type { BrowserContext, Page } from 'playwright';

let cachedBlocker: PlaywrightBlocker | undefined;

const FILTER_LISTS = [
  'https://easylist-downloads.adblockplus.org/easylist.txt',
  'https://easylist-downloads.adblockplus.org/easyprivacy.txt',
  'https://secure.fanboy.co.nz/fanboy-annoyance.txt',
  'https://secure.fanboy.co.nz/fanboy-cookiemonster.txt', // ← cookie banners
];

export async function getBlocker(cachePath = '.cache/adblock-engine.bin'): Promise<PlaywrightBlocker> {
  if (cachedBlocker) return cachedBlocker;
  cachedBlocker = await PlaywrightBlocker.fromLists(fetch, FILTER_LISTS, undefined, {
    path: cachePath, read: fs.readFile, write: fs.writeFile,
  });
  return cachedBlocker;
}

export async function installCookieDefences(page: Page): Promise<void> {
  const blocker = await getBlocker();
  await blocker.enableBlockingInPage(page);
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (/onetrust|cookielaw|cookiebot|quantcast\.mgr\.consensu|didomi\.io|sourcepoint|trustarc/i.test(u)) {
      return route.abort();
    }
    return route.continue();
  });
}

export async function preAcceptCookies(context: BrowserContext, hostname: string): Promise<void> {
  const domain = `.${hostname.replace(/^www\./, '')}`;
  await context.addCookies([
    { name: 'OptanonAlertBoxClosed', value: new Date().toISOString(), domain, path: '/' },
    { name: 'CookieConsent', value: '{stamp:%27-%27,necessary:true}', domain, path: '/' },
    { name: 'euconsent-v2', value: 'CPx-stub', domain, path: '/' },
  ]);
}

export async function rejectViaAutoconsent(page: Page): Promise<{ cmp?: string; success: boolean }> {
  const { default: AutoConsent } = await import('@duckduckgo/autoconsent');
  const rules = await import('@duckduckgo/autoconsent/rules/rules.json', { with: { type: 'json' } });
  return await page.evaluate(async (rulesJson) => {
    return await new Promise((resolve) => {
      const ac = new AutoConsent(
        (msg) => {
          if (msg.type === 'autoconsentDone') resolve({ cmp: msg.cmp, success: true });
          if (msg.type === 'autoconsentError') resolve({ success: false });
        },
        { enabled: true, autoAction: 'optOut', enableCosmeticRules: true, detectRetries: 20 },
        rulesJson,
      );
      setTimeout(() => resolve({ success: false }), 8000);
    });
  }, rules);
}
```

### Wire-up in Crawlee

```ts
const crawler = new PlaywrightCrawler({
  preNavigationHooks: [async ({ page }) => installCookieDefences(page)],
  postNavigationHooks: [async ({ page, request }) => {
    if (request.userData.requiresRealReject) await rejectViaAutoconsent(page);
  }],
});
```

### Migration checklist

1. `pnpm add @ghostery/adblocker-playwright cross-fetch` in the engine package.
2. `pnpm add -O @duckduckgo/autoconsent` (lazy-loaded).
3. `pnpm remove idcac-playwright` from every app workspace.
4. Delete `COOKIE_DISMISS_SCRIPT` constants and hardcoded selectors.
5. Replace any `closeCookieModals()` calls with `installCookieDefences(page)` in `preNavigationHooks`.
6. Add a CI step that warms `.cache/adblock-engine.bin` so cold-start in Apify Actors is fast.
