# Apify Tiered Proxy Fields in Input Schema: Recommendation for contextractor-ts

## TL;DR
- **Remove `tieredProxyUrl` and `tieredProxyConfig` from `apps/apify-actor/.actor/input_schema.json`.** They are non-canonical: no Apify first-party scraper (web-scraper, playwright-scraper, puppeteer-scraper, cheerio-scraper, website-content-crawler) exposes tiered proxies as input fields, the Apify input-schema spec has no `tieredProxy` editor, and the singular names (`tieredProxyUrl`, `tieredProxyConfig`) don't match Crawlee's canonical plural API (`tieredProxyUrls`, `tieredProxyConfig`).
- **Keep a single `proxyConfiguration` field with `type: "object"` and `editor: "proxy"`** — this is the universal Apify convention. It produces the standard "Proxy configuration" picker users already know, and the resulting object (`{useApifyProxy, apifyProxyGroups, apifyProxyCountry, proxyUrls}`) is fed straight into `Actor.createProxyConfiguration(input.proxyConfiguration)`.
- **If you want tiered fallback behavior, build it in code, not in the schema.** Read `input.proxyConfiguration` and construct a Crawlee `ProxyConfiguration` with `tieredProxyUrls` (or `tieredProxyConfig`) programmatically. Crawlee's tier-rotation logic only works when the crawler owns the `ProxyConfiguration` instance and is hard-wired into the request-retry loop — there is no UI surface for it.

## Key Findings

### 1. The Apify input-schema spec does not allow a "tiered proxy" editor
The canonical JSON schema for Apify input schemas, `apify/apify-shared-js/packages/json_schemas/schemas/input.schema.json` (also mirrored in `packages/input_schema/src/schema.json`), restricts object-type fields to exactly four editors. The verbatim definition is `"editor": { "enum": ["json", "proxy", "schemaBased", "hidden"] }`. There is no `tieredProxy` editor. The `proxy` editor's sub-schema also constrains the inner object to the four-property shape `{useApifyProxy, apifyProxyGroups, apifyProxyCountry, proxyUrls}` — it has no slot for tiers.

This means your current `tieredProxyUrl` and `tieredProxyConfig` fields are rendered by the Apify Console as **generic JSON/object editors**, not as proxy-aware pickers. Users get a raw textarea, not the friendly group/country/custom-URL UI they expect.

### 2. Tiered proxies are a Crawlee SDK / code-level feature, not a schema feature
Crawlee's `ProxyConfigurationOptions` defines two related options:
- `tieredProxyUrls?: string[][]` — an array of tiers, each tier being an array of proxy URL strings. The crawler probes lower tiers, escalates to higher tiers on blocking signals, and downgrades back later (per `crawlee.dev/js/docs/guides/proxy-management`). This option was introduced in Crawlee via PR #2348 (CHANGELOG entry: "tieredProxyUrls for ProxyConfiguration (#2348) (5408c7f)").
- `tieredProxyConfig?: Omit<ProxyConfigurationOptions, ...>[]` — an array of full sub-configurations (groups/country/etc.) per tier; the Apify-SDK extension (`apify-sdk-js/packages/apify/src/proxy_configuration.ts`) internally calls `_generateTieredProxyUrls(tieredProxyConfig, options)` to flatten them into `tieredProxyUrls`.

Critically, the Crawlee proxy-management guide (crawlee.dev/js/docs/guides/proxy-management) explicitly warns, verbatim: "Note that the tieredProxyUrls option requires ProxyConfiguration to be used from a crawler instance (see below). Using this configuration through the newUrl calls will not yield the expected results." Tier rotation is driven by per-request retry statistics inside the crawler's request-handling loop. It can only be configured in code; there is no platform-side wiring of these names.

### 3. Every Apify first-party actor uses the same single-field pattern
Across `apify/actor-scraper` (cheerio, puppeteer, playwright, web-scraper subprojects), `apify/actor-camoufox-scraper`, `apify/actor-crawler-cheerio`, `apify/actor-templates/*` (including `python-scrapy`), and the official Apify docs' Website Content Crawler example, the proxy section is exactly one property:

```json
"proxyConfiguration": {
  "sectionCaption": "Proxy and browser configuration",
  "title": "Proxy configuration",
  "type": "object",
  "description": "Specifies proxy servers that will be used by the scraper in order to hide its origin.",
  "editor": "proxy",
  "prefill": { "useApifyProxy": true },
  "default": { "useApifyProxy": true }
}
```

A few scrapers (web-scraper, playwright-scraper) additionally expose a `proxyRotation` string-enum to control session-rotation strategy, and `sessionPoolName` for cross-run session reuse — but **none** expose tiered proxy lists as input fields. A GitHub-wide search for `tieredProxyUrls` or `tieredProxyConfig` inside any Apify INPUT_SCHEMA.json returns zero results; all hits are inside Crawlee SDK source, docs, and issues.

### 4. The singular naming is wrong even if you keep the fields
Crawlee's canonical names are `tieredProxyUrls` (plural — it's a list of tiers) and `tieredProxyConfig` (singular — it's the configuration namespace, but its value is an array). Your current `tieredProxyUrl` is missing the `s`. Mapping `input.tieredProxyUrl` to Crawlee's `tieredProxyUrls` will silently work in your TS code only because you control both sides — but it diverges from every documentation example, breaks copy-paste from the Crawlee docs/blog, and confuses anyone reading the schema.

### 5. How the standard `proxyConfiguration` field and tiered proxies relate
They are **complementary at the SDK level, but not at the schema level**. The proxy-editor object is a *selector* describing which proxies to use (Apify Proxy auto, named Apify groups + country, or a flat list of custom URLs). Tiered proxies are a *retry strategy* describing a hierarchy of fallback proxy pools. In code you take the selector and either:
- (a) Pass it to `Actor.createProxyConfiguration(input.proxyConfiguration)` for the simple case, or
- (b) Use it as one tier inside a hand-built tiered config — e.g., make tier 0 = "no proxy", tier 1 = Apify datacenter, tier 2 = Apify residential, derived from your own logic.

There is no Apify-blessed way to expose option (b) as separate UI fields, because the Apify Console has no tiered-proxy widget.

## Details

### What your current schema almost certainly looks like (and why it's wrong)
Based on the field names you described (`tieredProxyUrl`, `tieredProxyConfig`) and the patterns I see in amateur Apify actors that try this, your schema probably has something like:

```json
"tieredProxyUrl": {
  "title": "Tiered proxy URLs",
  "type": "array",
  "editor": "stringList",                   // or "json"
  "description": "Custom proxy URLs by tier"
},
"tieredProxyConfig": {
  "title": "Tiered Apify proxy config",
  "type": "array",
  "editor": "json",
  "description": "Apify proxy group config per tier"
},
"proxyConfiguration": {
  "title": "Proxy configuration",
  "type": "object",
  "editor": "proxy",
  "prefill": { "useApifyProxy": true }
}
```

Problems with this setup:
1. The two tiered fields render as raw text/JSON in the Console — no proxy-aware UI, no validation that URLs are well-formed proxy URLs, no group picker.
2. Crawlee's `tieredProxyUrls` requires `string[][]` (array-of-arrays). Calling the input field `tieredProxyUrl` (singular) and giving it `editor: "stringList"` produces a flat `string[]` — wrong shape; you'd silently treat each URL as its own tier of one.
3. Three overlapping inputs invite contradictory user input (e.g., `proxyConfiguration.useApifyProxy = true` AND a populated `tieredProxyUrl`). Crawlee throws on initialize when both Apify Proxy and custom `proxyUrls` are mixed (per `ProxyConfigurationOptions.proxyUrls` docs: "Custom proxies are not compatible with Apify Proxy and an attempt to use both configuration options will cause an error to be thrown on initialize").
4. None of Apify's monitoring/observability tooling (Console run page, Store listing auto-generated docs, MCP server input introspection) recognizes these field names, so they get treated as opaque user data.

### The canonical pattern you should adopt

**`input_schema.json`** — replace all three proxy fields with one:

```json
"proxyConfiguration": {
  "sectionCaption": "Proxy configuration",
  "title": "Proxy configuration",
  "type": "object",
  "description": "Proxies used by the crawler to avoid blocking. By default, Apify Proxy in automatic mode is used.",
  "editor": "proxy",
  "prefill": { "useApifyProxy": true },
  "default": { "useApifyProxy": true }
}
```

**Actor entry code (TypeScript)** — wire it to Crawlee:

```ts
import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

await Actor.init();
const input = await Actor.getInput<{
  proxyConfiguration?: {
    useApifyProxy?: boolean;
    apifyProxyGroups?: string[];
    apifyProxyCountry?: string;
    proxyUrls?: string[];
  };
  startUrls: { url: string }[];
}>();

const proxyConfiguration = await Actor.createProxyConfiguration(input?.proxyConfiguration);

const crawler = new PlaywrightCrawler({
  proxyConfiguration,
  // ...
});

await crawler.run(input!.startUrls);
await Actor.exit();
```

### If you really want tiered fallback — do it in code, hard-coded

This is the pattern used by anti-bot–heavy scrapers internally (none expose it via input schema). Pick one of the two equivalent shapes:

```ts
// Shape A: flat URL tiers (use when you already have proxy URL strings)
const proxyConfiguration = await Actor.createProxyConfiguration({
  tieredProxyUrls: [
    [null],                              // tier 0: no proxy (see Crawlee issue #2740)
    ['http://datacenter-pool.example'],  // tier 1: cheap
    ['http://residential-pool.example'], // tier 2: expensive
  ],
});

// Shape B: tier-of-Apify-Proxy-configs (use when you want Apify-managed pools)
const proxyConfiguration = await Actor.createProxyConfiguration({
  tieredProxyConfig: [
    { groups: ['AUTO'] },
    { groups: ['RESIDENTIAL'], countryCode: 'US' },
  ],
});
```

Crawlee will then auto-escalate on blocking signals and probe lower tiers periodically. You **must** pass the resulting `proxyConfiguration` to the crawler constructor (`new PlaywrightCrawler({ proxyConfiguration, ... })`) — calling `proxyConfiguration.newUrl()` outside a crawler defeats the tier-rotation tracker.

### If you want the user to *choose* between tiers in the UI

Don't expose URLs. Expose a strategy enum:

```json
"proxyStrategy": {
  "title": "Proxy strategy",
  "type": "string",
  "editor": "select",
  "enum": ["datacenter", "residential", "tiered"],
  "enumTitles": [
    "Datacenter (cheap, may be blocked)",
    "Residential (expensive, rarely blocked)",
    "Tiered fallback (start cheap, escalate)"
  ],
  "default": "tiered"
}
```

Then branch in code to construct the right `ProxyConfiguration`. This keeps the schema canonical, preserves the standard `proxyConfiguration` picker for users who want manual control, and contains the tiered logic where it belongs (in code, not in the schema).

## Recommendations

Staged, in order of priority:

1. **Today — delete the two tiered fields.** Edit `apps/apify-actor/.actor/input_schema.json` to remove `tieredProxyUrl` and `tieredProxyConfig` entirely. Keep only `proxyConfiguration` with `editor: "proxy"`. Rebuild the actor and verify the Console UI shows only the standard proxy picker.

2. **Today — audit the consuming code.** Search the actor's `src/main.ts` (and any helper in your monorepo's shared packages) for references to `tieredProxyUrl` / `tieredProxyConfig`. Replace with reads from `input.proxyConfiguration`. If you genuinely had tiered logic running, port it to code-level `tieredProxyUrls` / `tieredProxyConfig` passed directly to `Actor.createProxyConfiguration(...)`.

3. **This week — decide whether contextractor actually needs tiered behavior.** Benchmark a sample crawl with plain Apify Proxy first. Threshold to add tiers: if you see >5% blocked-request rate (HTTP 403/429 or session retirements) on your target domains during a 1k-request test run. Below that, the added complexity isn't worth it.

4. **If tiered behavior is needed — bake it in code.** Use the `tieredProxyConfig` shape and let users only see the strategy enum (`proxyStrategy`) plus the standard `proxyConfiguration`. Do **not** try to surface URL lists per tier; the Console has no UI for it and users will fill it incorrectly.

5. **Long term — track Crawlee's roadmap for any proxy-tier UI primitives.** Apify has accepted enhancement requests — issue #2740 ("Add ability to start with 'no proxy'"), opened by GitHub user strongpauly on Nov 8, 2024 at github.com/apify/crawlee/issues/2740 ("When using the tieredProxyUrls option in ProxyConfiguration I would like to be able to start without a proxy, then escalate to using one if and when a request fails"), was closed via PR #2743 — but as of May 2026 no input-schema editor for tiers is planned. Watch `apify/apify-shared-js` for any addition to the `editor` enum beyond the current `["json", "proxy", "schemaBased", "hidden"]`.

Threshold that would change these recommendations: if Apify ever ships a `tieredProxy` editor type (would appear in `apify-shared-js/packages/json_schemas/schemas/input.schema.json`'s `objectProperty.editor.enum`), migrate to it immediately and drop the code-level workaround.

## Caveats

- I was unable to fetch the raw `playwright-scraper/INPUT_SCHEMA.json` directly from `raw.githubusercontent.com` during this research (URL fetch was blocked by the tool's allow-list, and the `apify/actor-scraper` repo appears to have recently restructured to a `packages/` layout). The single-`proxyConfiguration`-field pattern is corroborated by (a) the live Apify Store input pages for `apify/playwright-scraper`, `apify/cheerio-scraper`, `apify/web-scraper`, and `apify/website-content-crawler`; (b) indexed snippets of `apify/actor-scraper/puppeteer-scraper/INPUT_SCHEMA.json` and `apify/actor-templates/templates/python-scrapy/.actor/input_schema.json`; (c) Apify's own documentation examples; (d) the canonical `apify-shared-js` JSON schema, which restricts the `editor` enum to four values, none of which is `tieredProxy`. The substantive conclusion is robust; the verbatim raw-file blob just couldn't be pasted.
- The "5% blocked-request" threshold above is a rule of thumb based on common practice — Apify does not publish an official cutoff for "when to switch from datacenter to residential" or "when to add tiered fallback."
- The Crawlee tiered-proxy API surface was introduced via PR #2348 and has been stable since. The empty-tier `[null]` semantic for "no proxy as tier 0" was added in response to issue #2740 (closed by PR #2743). If you pin to a Crawlee version older than that PR's release, double-check that `[null]` for "no proxy" works.
- This research did not run codebase-investigation tools against the actual repo — the description in "What your current schema almost certainly looks like" is a reconstruction from the problem description and from how developers commonly misuse these names. Read the actual `input_schema.json` and the consumer code before deleting fields, and verify against what's really there.
