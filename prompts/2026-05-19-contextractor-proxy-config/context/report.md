# Contextractor Proxy & Session Configuration Report

Comparison of Apify `playwright-scraper` proxy/session inputs against contextractor's schema, gap analysis against the Crawlee `ProxyConfiguration` API, and a feasibility assessment for tiered proxies including a CLI parameter design.

Date: 2026-05-19

## TLDR

**vs. `playwright-scraper`**: Only one field missing — `sessionPoolName` (persistent cross-run session sharing). All other proxy fields (`proxyConfiguration`, `proxyRotation`, `initialCookies`) are present and faithfully implemented.

**vs. Crawlee's full API**: Three meaningful gaps — (1) `tieredProxyUrls` is unreachable from both CLI and Apify Console, (2) the `sessionPool` option in `ContextractorCrawlerOptions` is dead code that nothing feeds, (3) `maxSessionRotations` is not exposed despite being the primary anti-block knob in `website-content-crawler`.

**Tiered proxies**: Feasible and low-risk. The Apify SDK's `ProxyConfiguration` supports `tieredProxyUrls` at the runtime level. The crawler layer already passes the config through untouched — zero handler changes needed. The gap is purely the **input surface**: the standard Apify `proxy` editor widget only produces `{ useApifyProxy, apifyProxyGroups, proxyUrls }` and cannot represent tiers. The right approach is to **add** a separate `tieredProxyUrls` field with `editor: "json"` and `isSecret: true` alongside the existing `proxy` editor — do not replace or override it.

**CLI**: Two complementary forms recommended — repeated `--proxy-tier "url1,url2"` (one flag per tier) for shell use, and `--proxy-tiers '[[...]]'` JSON string for programmatic/CI use.

**Priority order**: (HIGH) tiered proxy support + wire `sessionPoolName` → (MEDIUM) add `maxSessionRotations` + document proxy precedence → (LOW) consider defaulting `proxyConfiguration` to Apify Proxy for the Actor build.

## Scope of Sources Reviewed

- `playwright-scraper` input schema: `/Users/miroslavsekera/r/actor-scraper/packages/actor-scraper/playwright-scraper/INPUT_SCHEMA.json`
- Contextractor Zod source of truth: `/Users/miroslavsekera/r/contextractor-ts/packages/schema/src/source-of-truth/input.ts`
- Generated Apify schema: `/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/.actor/input_schema.json`
- CLI: `/Users/miroslavsekera/r/contextractor-ts/apps/standalone/src/cli.ts`, `/Users/miroslavsekera/r/contextractor-ts/apps/standalone/src/cliProgram.ts`
- Actor wiring: `/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/src/run.ts`, `/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/src/config.ts`
- Crawler integration: `/Users/miroslavsekera/r/contextractor-ts/packages/crawler/src/createCrawler.ts`, `/Users/miroslavsekera/r/contextractor-ts/packages/crawler/src/index.ts`
- Crawlee `^3.16.0` (`tieredProxyUrls` is available in this version), `apify ^3.7.2`
- Crawlee proxy docs, Crawlee `ProxyConfiguration` API, Crawlee source `proxy_configuration.ts`, Apify `website-content-crawler` schema

## Summary of Findings

- Contextractor already covers the three core `playwright-scraper` proxy fields (`proxyConfiguration`, `proxyRotation`, `initialCookies`) and even matches its `proxyRotation` semantics exactly via `SESSION_MAX_USAGE_COUNTS`.
- The single missing `playwright-scraper` proxy/session field is `sessionPoolName` (cross-run session sharing).
- The bigger gap is against the Crawlee `ProxyConfiguration` API itself: the actor only ever passes Apify-proxy options through `Actor.createProxyConfiguration`, and the CLI only constructs a flat `proxyUrls` list. `tieredProxyUrls`, `newUrlFunction`, and explicit `SessionPoolOptions` tuning are not reachable from either entrypoint even though the crawler layer (`ContextractorCrawlerOptions`) already accepts a `sessionPool` option that nothing wires up.
- Tiered proxies are feasible and low-risk to add. The crawler already forwards a `ProxyConfiguration` instance straight into every Crawlee crawler, so `tieredProxyUrls` works end to end with no handler changes. The only real design work is the input surface (Zod schema + Apify editor + CLI flag shape).

## Part 1 — Proxy/Session Fields in playwright-scraper

From `playwright-scraper/INPUT_SCHEMA.json` (the "Proxy configuration" section plus session-related fields):

### proxyConfiguration

- Type: `object`, editor `proxy`
- `prefill` / `default`: `{ "useApifyProxy": true }`
- Required (in `required: ["startUrls", "pageFunction", "proxyConfiguration"]`)
- Description: "Specifies proxy servers that will be used by the scraper in order to hide its origin."
- This object is passed to Apify's proxy editor and ultimately to `Actor.createProxyConfiguration`. Public actor docs show the accepted shape: `{ useApifyProxy: boolean, apifyProxyGroups: string[], proxyUrls: string[] }` (Apify Proxy automatic, Apify Proxy selected groups, or a custom `scheme://user:password@host:port` list).

### proxyRotation

- Type: `string`, editor `select`
- `default`: `"RECOMMENDED"`
- `enum`: `["RECOMMENDED", "PER_REQUEST", "UNTIL_FAILURE"]`
- `enumTitles`: "Use recommended settings", "Rotate proxy after each request", "Use one proxy until failure"
- Description (verbatim): "This property indicates the strategy of proxy rotation and can only be used in conjunction with Apify Proxy. The recommended setting automatically picks the best proxies from your available pool and rotates them evenly, discarding proxies that become blocked or unresponsive. If this strategy does not work for you for any reason, you may configure the scraper to either use a new proxy for each request, or to use one proxy as long as possible, until the proxy fails."

### sessionPoolName

- Type: `string`, editor `textfield`
- Constraints: `minLength: 3`, `maxLength: 200`, `pattern: "[0-9A-z-]"`
- Description (verbatim): "Use only english alphanumeric characters dashes and underscores. A session is a representation of a user. It has it's own IP and cookies which are then used together to emulate a real user. Usage of the sessions is controlled by the Proxy rotation option. By providing a session pool name, you enable sharing of those sessions across multiple Actor runs. This is very useful when you need specific cookies for accessing the websites or when a lot of your proxies are already blocked. Instead of trying randomly, a list of working sessions will be saved and a new Actor run can reuse those sessions. Note that the IP lock on sessions expires after 24 hours, unless the session is used again in that window."

### initialCookies

- Type: `array`, editor `json`, default `[]`
- Description: "The provided cookies will be pre-set to all pages the scraper opens."
- Session-adjacent because it seeds the per-session cookie jar.

### Related anti-blocking fields (not strictly "proxy" but used together with it)

- `maxRequestRetries` (integer, default `3`) — retries on network/proxy/server errors.
- `maxConcurrency` (integer, default `50`) — indirectly throttles to avoid blocks.

There is no `maxSessionRotations` field in `playwright-scraper` (that field exists in `website-content-crawler` instead — see Part 3).

## Part 2 — Gap Analysis: playwright-scraper vs Contextractor

Contextractor's Zod schema (`ContextractorInput` in `input.ts`) and the generated `input_schema.json` were compared field-by-field.

| playwright-scraper field | In contextractor? | Notes / type differences |
|---|---|---|
| `proxyConfiguration` | Yes | Zod: `z.record(z.string(), z.unknown()).optional()`, editor `proxy`, section "Proxy". playwright-scraper makes it **required** with a `default`/`prefill` of `{ useApifyProxy: true }`; contextractor makes it **optional with no default** — meaning a contextractor run with no proxy config runs with no proxy at all, whereas playwright-scraper defaults to Apify Proxy on. This is an intentional difference (contextractor is also a standalone CLI), but worth noting. |
| `proxyRotation` | Yes | Zod: `z.enum(['RECOMMENDED','PER_REQUEST','UNTIL_FAILURE']).default('RECOMMENDED')`. Identical enum, titles, and default. Semantics are faithfully reproduced in `createCrawler.ts` via `SESSION_MAX_USAGE_COUNTS = { RECOMMENDED: undefined, PER_REQUEST: 1, UNTIL_FAILURE: 1000 }` plus `maxPoolSize: 1` for `UNTIL_FAILURE`. The code comment explicitly says it mirrors `@apify/scraper-tools`. **No gap.** |
| `sessionPoolName` | **No** | This is the only missing proxy/session field. playwright-scraper uses it to persist/share the session pool across Actor runs. Contextractor has no equivalent input and never sets a named/persistent session pool. |
| `initialCookies` | Yes | Zod: `z.array(z.unknown()).optional()`, editor `json`, `isSecret: true`. Contextractor additionally marks it secret/encrypted and has a richer description. Wired through to Playwright `contextOptions.storageState = { cookies }`. **No gap** (arguably better than playwright-scraper). |
| `maxRequestRetries` | Yes | Both default `3`. Contextractor allows `0..Number.MAX_SAFE_INTEGER`; playwright-scraper just `minimum: 0`. Minor. |

### Conclusion of direct comparison

The only field present in `playwright-scraper` and absent in contextractor is **`sessionPoolName`**. Everything else is present and behaviorally faithful (the `proxyRotation` → session-pool mapping is a near-exact port of the Apify scraper-tools logic).

## Part 3 — Cross-reference: website-content-crawler

`website-content-crawler` (a closer cousin to contextractor, since both extract article content) exposes a slightly different proxy/session surface:

- `proxyConfiguration` — object, **required**, default `{ "useApifyProxy": true }`. Same description string contextractor already uses ("Enables loading the websites from IP addresses in specific geographies and to circumvent blocking.").
- `maxSessionRotations` — integer, `0..20`, default `10`. "The maximum number of times the crawler will rotate the session (IP address + browser configuration) on anti-scraping measures like CAPTCHAs." **Contextractor does not expose this.** It maps to Crawlee `maxSessionRotations` on the crawler options and is a distinct knob from `maxRequestRetries`.
- `maxRequestRetries` — integer, `0..20`, default `3`. Contextractor has this (with a much larger max bound).
- `initialCookies` — array. Contextractor has this.
- No `proxyRotation` and no `sessionPoolName` in website-content-crawler — it leans on `maxSessionRotations` instead.

### Additional gap surfaced here

`maxSessionRotations` is exposed by website-content-crawler but **not** by contextractor. This is a meaningful anti-blocking knob: it controls how many times Crawlee swaps to a fresh session (new IP + fingerprint) when it detects a block/CAPTCHA, independent of `maxRequestRetries`. Worth adding alongside any proxy work.

## Part 4 — Crawlee ProxyConfiguration API Gaps

### What Crawlee `ProxyConfiguration` supports (Crawlee ^3.16, from `proxy_configuration.ts`)

```typescript
export interface ProxyConfigurationOptions {
    proxyUrls?: UrlList;                 // type UrlList = (string | null)[]
    newUrlFunction?: ProxyConfigurationFunction;
    tieredProxyUrls?: UrlList[];         // (string | null)[][]
}

export interface ProxyConfigurationFunction {
    (sessionId: string | number, options?: { request?: Request }):
        string | null | Promise<string | null>;
}

interface TieredProxyOptions {
    request?: Request;
    proxyTier?: number;
}
```

The Apify SDK subclass (`apify`'s `ProxyConfiguration`) extends this with Apify-specific options (`useApifyProxy`, `groups`/`apifyProxyGroups`, `countryCode`, `password`); `tieredProxyUrls` is inherited.

Session-pool integration is a separate axis: `useSessionPool`, `persistCookiesPerSession`, and `sessionPoolOptions` (including `maxPoolSize`, `sessionOptions.maxUsageCount`, and persistence keys) are crawler options, not `ProxyConfiguration` options.

### How contextractor currently uses ProxyConfiguration

Two distinct entrypoints, both narrow:

**Apify Actor (`apps/apify-actor/src/run.ts`):**

```typescript
const proxyConfig = input.proxyConfiguration
  ? await Actor.createProxyConfiguration(input.proxyConfiguration as ProxyConfigurationOptions)
  : undefined;
```

It passes the raw `proxyConfiguration` JSON object straight into `Actor.createProxyConfiguration`. In practice the Apify `proxy` editor only produces `{ useApifyProxy, apifyProxyGroups, proxyUrls }`. So while `Actor.createProxyConfiguration` *can* technically receive `tieredProxyUrls`, the input schema's `proxy` editor does not let a user enter it, so it is effectively unreachable from the Console.

**Standalone CLI (`apps/standalone/src/cliProgram.ts`):**

```typescript
proxyConfiguration = new ProxyConfiguration({ proxyUrls: cliOnly.proxyUrls });
```

It builds a plain Crawlee `ProxyConfiguration` from a flat, repeatable `--proxy <url>` flag. Only `proxyUrls` is ever set; `tieredProxyUrls` and `newUrlFunction` are never used. The CLI also validates each URL scheme (`http/https/socks4/socks5`).

**Crawler layer (`packages/crawler/src/createCrawler.ts`):**

The crawler accepts `proxyConfiguration?: ProxyConfiguration` and forwards it verbatim into `CheerioCrawler` / `AdaptivePlaywrightCrawler` / `PlaywrightCrawler` (`proxyConfiguration: opts.proxyConfiguration`). This is a pure pass-through — **the crawler imposes no restriction on what kind of `ProxyConfiguration` it gets**. Critically, this means a `ProxyConfiguration` constructed with `tieredProxyUrls` would already work end-to-end today; only the input surface is missing.

### Gaps (Crawlee features not exposed by contextractor)

| Crawlee capability | Exposed in contextractor? | Where it would plug in |
|---|---|---|
| `proxyUrls` (flat custom list) | Partially — CLI only (`--proxy`). Apify Actor relies on the `proxy` editor which can produce `proxyUrls`, so it is reachable there via JSON. | CLI: yes. Actor: via proxy editor. |
| `tieredProxyUrls` (tiered escalation) | **No** — unreachable from CLI and from the Apify `proxy` editor. | Needs new schema field + CLI flag; crawler already forwards it. |
| `newUrlFunction` (custom selection logic) | **No** — and arguably should stay unexposed (it's a function, not serializable input). | Not recommended for input schema. |
| `SessionPoolOptions` fine-tuning (`maxPoolSize`, `sessionOptions.maxUsageCount`, persistence keys, `sessionPoolName`) | **Indirect only** — derived from `proxyRotation`. `ContextractorCrawlerOptions.sessionPool?: boolean \| SessionPoolOptions` exists but **nothing in the Actor or CLI ever sets it**. The actor/CLI never pass `sessionPool`, so users cannot tune it. | `sessionPoolName` → persistent session pool; `maxSessionRotations`. |
| `maxSessionRotations` (session swaps on block) | **No** | Crawler option; needs threading through `ContextractorCrawlerOptions` and schema. |
| Apify proxy `countryCode` / `groups` | Yes, via the `proxyConfiguration` JSON object on the Actor (passed straight to `Actor.createProxyConfiguration`). Not available on the CLI (CLI is non-Apify). | n/a |

The single most impactful unused capability is the **dead `sessionPool` option** on `ContextractorCrawlerOptions`: the type and the rotation-merging logic in `createCrawler.ts` are already written to accept user `SessionPoolOptions`, but neither entrypoint feeds them, so `sessionPoolName` / persistence / custom pool size are silently unreachable.

## Part 5 — Tiered Proxies: What They Are, Feasibility, CLI Design

### What `tieredProxyUrls` does

`tieredProxyUrls` is `(string | null)[][]` — an array of tiers, where each tier is itself a list of proxy URLs (and `null` means "no proxy"). Behavior, per Crawlee docs and source:

- All requests start on **tier 0** (the first sub-array). Within a tier, URLs are rotated round-robin.
- When Crawlee detects the current proxy is **blocked for a given domain**, it escalates that domain to the **next higher tier** (more reliable / more expensive proxies).
- Crawlee **periodically probes lower tiers** for that domain; if a lower tier is unblocked again it **downshifts** back to save cost.
- Escalation/downshift state is tracked **per domain**, so a block on `site-a.com` does not push `site-b.com` to a higher tier.
- Constraint (from docs): `tieredProxyUrls` "requires `ProxyConfiguration` to be used from a crawler instance ... Using this configuration through the `newUrl` calls will not yield the expected results." Contextractor already passes the `ProxyConfiguration` to a crawler instance, so this constraint is satisfied.

Canonical example from the Crawlee docs:

```typescript
const proxyConfiguration = new ProxyConfiguration({
    tieredProxyUrls: [
        [null],                                                                  // try with no proxy first
        ['http://okay-proxy.com'],
        ['http://slightly-better-proxy.com', 'http://slightly-better-proxy-2.com'],
        ['http://very-good-and-expensive-proxy.com'],
    ],
});
```

### Feasibility: HIGH (low risk, small surface)

Reasons it is straightforward:

- **No handler/crawler changes needed.** `createCrawler.ts` already forwards any `ProxyConfiguration` instance into all three crawler types. A `ProxyConfiguration({ tieredProxyUrls })` would "just work" today through the existing `opts.proxyConfiguration` path.
- **CLI construction point is one line.** `cliProgram.ts` currently does `new ProxyConfiguration({ proxyUrls: cliOnly.proxyUrls })`. Adding a tiered branch is a localized change.
- **Apify Actor construction point is one line.** `run.ts` already feeds the raw `proxyConfiguration` JSON into `Actor.createProxyConfiguration`. The Apify SDK's `ProxyConfiguration` accepts `tieredProxyUrls`. The blocker is purely the `proxy` editor UI which does not collect tiers — so a separate `tieredProxyUrls` JSON field is needed if it should be configurable from the Console.
- **Validation is simple.** Each entry is a URL string (or `null`); the CLI already has scheme-validation logic for `--proxy` that can be reused.

Risks / caveats:

- `tieredProxyUrls` is mutually meaningful with `proxyConfiguration` (Apify proxy) and `proxyRotation`. Need clear precedence rules (recommendation below): if tiered URLs are provided, they take precedence over a flat `proxyUrls`; `proxyRotation` still maps to session-pool usage counts independently. Document that mixing Apify proxy + custom tiered URLs simultaneously is not supported.
- `null` (no-proxy tier) must survive JSON parsing and reach Crawlee as actual `null`, not the string `"null"`.
- Tiered escalation only triggers on Crawlee's block detection (retire-on-block). With contextractor's content-extraction handlers, ensure blocked responses actually mark the session as blocked (Crawlee does this on standard block status codes; custom 200-with-captcha pages would not auto-escalate — same limitation as any Crawlee scraper).

### Apify input schema: can tiered proxies be expressed?

**Short answer: not via the standard `proxy` editor — add a separate `json` field alongside it.**

The Apify `proxy` editor (`editor: "proxy"`) is a fixed-shape Console widget. It only produces:

```json
{ "useApifyProxy": boolean, "apifyProxyGroups": ["string"], "proxyUrls": ["string"] }
```

There is no `tieredProxyUrls`, no array-of-arrays, and no tiered/fallback concept in the widget spec. This is the same widget used by `playwright-scraper`, `website-content-crawler`, and every other official Apify actor — it is a platform standard, not something contextractor can extend.

However, the **Apify SDK's `ProxyConfiguration`** (a subclass of Crawlee's) explicitly includes `tieredProxyUrls?: (string | null)[][]` in its `ProxyConfigurationOptions` interface. The runtime fully supports tiered proxies; the gap is only in the Console UI.

**Recommended approach: add a separate optional field, do not replace the standard `proxy` editor.**

Official Apify scrapers routinely pair the `proxy` editor with sibling proxy-control fields (e.g. `playwright-scraper` adds `proxyRotation` and `sessionPoolName` alongside `proxyConfiguration`). There is no platform convention against this. Add a `tieredProxyUrls` field with:
- `editor: "json"` — renders a JSON input box in the Console (same pattern as `initialCookies`)
- `isSecret: true` — proxy URLs typically contain credentials; mirrors the `initialCookies` precedent
- `sectionCaption: "Proxy"` — groups it visually with the existing proxy fields
- Type: `array` of `array` of nullable strings

At runtime: if `tieredProxyUrls` is provided, construct `Actor.createProxyConfiguration({ tieredProxyUrls })`. Treat it as mutually exclusive with Apify-proxy-based `proxyConfiguration` (if `useApifyProxy: true` is set alongside `tieredProxyUrls`, reject with a clear error — Apify's managed proxy pool is not a custom URL list and cannot be tiered with user-supplied URLs).

The flat `proxyUrls` from the standard `proxy` editor widget could optionally be treated as tier 0 when tiered URLs are also provided, but this adds complexity; simpler to require the user to pick one mechanism.

### CLI parameter recommendation

Research on how comparable tools pass list/structured proxy data:

- **curl** has no native multi-proxy fallback flag — users script it externally.
- **Scrapy** has no built-in `PROXY_LIST` tiered setting — waterfalling is done via custom middleware.
- **`gh` / `tekton` CLIs**: the consensus pattern for array params is **repeated flags** (`--param=a --param=b`) for ergonomics and shell-escaping safety, with **JSON via a string/stdin/file** for nested structures.

`tieredProxyUrls` is array-of-arrays, which repeated scalar flags cannot express cleanly. Recommended approach — support **two complementary forms**, mirroring the established CLI conventions and contextractor's existing patterns (it already accepts `--cookies <json>` and `--headers <json>` as JSON strings, and `--config <path>` as a JSON file):

**Primary form — repeated `--proxy-tier` flag (one flag per tier, comma-separated within a tier):**

```bash
contextractor extract https://example.com \
  --proxy-tier "" \
  --proxy-tier "http://okay-proxy.com" \
  --proxy-tier "http://better-1.com,http://better-2.com" \
  --proxy-tier "http://premium.com"
```

- Each `--proxy-tier` occurrence = one tier (preserves tier ordering by flag order).
- Empty string `""` = a `[null]` tier (try without proxy).
- Comma-splits the value into multiple URLs within that tier.
- This composes naturally with contextractor's existing `collectValues` repeatable-flag helper used by `--proxy`, `--glob`, `--exclude`.

**Secondary form — `--proxy-tiers <json>` (full structured control, parity with `--cookies`/`--headers`):**

```bash
contextractor extract https://example.com \
  --proxy-tiers '[[null],["http://okay.com"],["http://better-1.com","http://better-2.com"],["http://premium.com"]]'
```

- Exact `(string|null)[][]` JSON, parsed with the existing `parseJsonArray` helper plus a nested-array/URL validator.
- Best for programmatic/CI callers and config files (it can also live in the `--config` JSON file as `proxyTiers`).

Precedence rule to document: `--proxy-tiers` (JSON) > repeated `--proxy-tier` > flat `--proxy`. If any tiered form is set, construct `new ProxyConfiguration({ tieredProxyUrls })`; otherwise fall back to the current `{ proxyUrls }` path. The `tieredProxyUrls` name in the CLI flags mirrors the Apify actor input field name — same concept, same serialization.

### Zod schema design

Add to `ContextractorInput` (source of truth `input.ts`). Use a nested array; allow `null` for no-proxy tiers. Keep it optional (no default) like `proxyConfiguration`:

```typescript
tieredProxyUrls: z
  .array(z.array(z.string().url().nullable()).min(1))
  .min(1)
  .optional()
  .describe(
    'Tiered proxy URLs for automatic escalation. An array of tiers; each tier is a list of ' +
    'proxy URLs (or null for "no proxy"). Crawling starts on the first tier and Crawlee ' +
    'escalates a domain to a higher tier when it detects blocking, probing lower tiers ' +
    'periodically to downshift. Takes precedence over a flat custom proxy list. Not combinable ' +
    'with Apify Proxy (useApifyProxy: true) in proxyConfiguration.'
  )
  .meta({
    title: 'Tiered proxy URLs',
    ...apifyMeta({ editor: 'json', sectionCaption: 'Proxy', isSecret: true, prefill: [] }),
  }),
```

Notes on the schema choice:

- **`isSecret: true`** — proxy URLs contain credentials; mirrors the `initialCookies` pattern in the same file. The Apify Console encrypts the value at rest.
- `z.string().url().nullable()` permits `null` tiers (no-proxy tier); the generated Apify JSON Schema will be `array` of `array` with `editor: "json"` — same approach contextractor already uses for `initialCookies` and `customHttpHeaders`.
- Crawlee's type is `(string | null)[][]`; `z.array(z.array(z.string().url().nullable()).min(1)).min(1)` is the faithful representation. `.min(1)` guards against empty tiers / empty tier list.
- Field name is `tieredProxyUrls` (matching the Crawlee/Apify SDK property name exactly) rather than `proxyTiers`, to minimize the translation surface and make the wiring self-documenting.
- Keep `proxyConfiguration` (with `useApifyProxy: true`) and `tieredProxyUrls` mutually exclusive at the wiring layer (validate in `run.ts` / `cliProgram.ts`): if both are supplied, error out with a clear message.

### Wiring changes required (minimal)

- `packages/schema/src/source-of-truth/input.ts`: add `tieredProxyUrls` field (above, with `isSecret: true`); regenerate `apps/apify-actor/.actor/input_schema.json`.
- `apps/standalone/src/cliProgram.ts`:
  - add `--proxy-tier` (repeatable, comma-split) and `--proxy-tiers <json>` options;
  - in the proxy-construction block, if tiers are present build `new ProxyConfiguration({ tieredProxyUrls })` (reuse the existing per-URL scheme validation loop), else keep the current `{ proxyUrls }` branch.
- `apps/apify-actor/src/run.ts`: if `input.tieredProxyUrls` is set, construct `Actor.createProxyConfiguration({ tieredProxyUrls: input.tieredProxyUrls })` and reject when `input.proxyConfiguration?.useApifyProxy` is also true; otherwise use the existing `Actor.createProxyConfiguration(input.proxyConfiguration)` path.
- `packages/crawler/src/createCrawler.ts`: **no change** — it already forwards `opts.proxyConfiguration` to every crawler.
- `apps/apify-actor/README.md` / a `prd.md`: document the new field, the `isSecret` behavior, and the not-combinable-with-Apify-proxy constraint.

## Part 6 — Prioritized Recommended Improvements

Ordered by value-to-effort.

### Priority HIGH

- **Add tiered proxy support (`proxyTiers`).** Highest value: it is the headline Crawlee anti-blocking feature contextractor cannot currently use, and the crawler layer already supports it end-to-end (pure pass-through). Effort is small and localized (schema field + two construction sites). Provide both the repeated `--proxy-tier` flag and the `--proxy-tiers <json>` form; document Apify-proxy mutual exclusivity.

- **Wire up the already-defined `sessionPool` option.** `ContextractorCrawlerOptions.sessionPool?: boolean | SessionPoolOptions` and its rotation-merge logic already exist in `createCrawler.ts` but are dead code — nothing passes it. At minimum, expose `sessionPoolName` (string) and feed it into a named/persisted session pool so sessions persist across runs (matches `playwright-scraper`'s only missing field and is explicitly valuable "when a lot of your proxies are already blocked").

### Priority MEDIUM

- **Add `maxSessionRotations`.** Exposed by the closest cousin actor (`website-content-crawler`, default `10`, range `0..20`). It is a distinct anti-blocking knob from `maxRequestRetries` (session/IP+fingerprint swaps on CAPTCHA/block). Needs threading through `ContextractorCrawlerOptions` and the schema, plus a CLI flag (`--max-session-rotations`).

- **Document proxy precedence and combinations.** Add a short section to the actor README / a `prd.md` clarifying: Apify proxy vs custom `proxyUrls` vs `proxyTiers` precedence, that `proxyRotation` maps to session-pool usage counts and only affects Apify-proxy/session reuse, and that `tieredProxyUrls` requires crawler-instance usage (already satisfied).

### Priority LOW

- **Consider a default `proxyConfiguration`.** `playwright-scraper` and `website-content-crawler` both default proxy to `{ useApifyProxy: true }` and make it required; contextractor leaves it optional/empty. For the Apify Actor build specifically, defaulting to Apify Proxy on would align with sibling actors and reduce silent unproxied runs. Leave the CLI unchanged (no Apify proxy off-platform).

- **Do not expose `newUrlFunction`.** It is a runtime function, not serializable input; it belongs only in programmatic use of `@contextractor/crawler`, not in the Zod input schema or CLI. Noted here only to explicitly close the gap question.

## Appendix — Exact Type Reference

Crawlee `^3.16` (`packages/core/src/proxy_configuration.ts`):

```typescript
type UrlList = (string | null)[];

export interface ProxyConfigurationOptions {
    proxyUrls?: UrlList;
    newUrlFunction?: ProxyConfigurationFunction;
    tieredProxyUrls?: UrlList[];   // i.e. (string | null)[][]
}

export interface ProxyConfigurationFunction {
    (sessionId: string | number, options?: { request?: Request }):
        string | null | Promise<string | null>;
}

interface TieredProxyOptions {
    request?: Request;
    proxyTier?: number;
}

// newUrl(sessionId?: string | number, options?: TieredProxyOptions): Promise<undefined | string>
// newProxyInfo(sessionId?: string | number, options?: TieredProxyOptions): Promise<undefined | ProxyInfo>
```

Contextractor proxy-rotation → session-pool mapping (`createCrawler.ts`, faithful port of `@apify/scraper-tools`):

```typescript
const SESSION_MAX_USAGE_COUNTS = Object.freeze({
  RECOMMENDED: undefined,   // default session reuse
  PER_REQUEST: 1,           // new session/context every request
  UNTIL_FAILURE: 1000,      // + maxPoolSize: 1 → one proxy until it fails
} as const);
```

## Relevant File Paths

- `/Users/miroslavsekera/r/contextractor-ts/packages/schema/src/source-of-truth/input.ts` — Zod source of truth; add `tieredProxyUrls` here (with `isSecret: true`).
- `/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/.actor/input_schema.json` — generated schema (regenerate after Zod change).
- `/Users/miroslavsekera/r/contextractor-ts/apps/standalone/src/cliProgram.ts` — CLI proxy construction (`new ProxyConfiguration({ proxyUrls })` at the proxy block; add tier flags here).
- `/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/src/run.ts` — Actor proxy construction (`Actor.createProxyConfiguration`).
- `/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/src/config.ts` — `buildCrawlerOpts` mapping (would thread `sessionPool` / `maxSessionRotations`).
- `/Users/miroslavsekera/r/contextractor-ts/packages/crawler/src/createCrawler.ts` — `ContextractorCrawlerOptions` (dead `sessionPool` option + `SESSION_MAX_USAGE_COUNTS`); pure proxy pass-through, no change needed for tiered proxies.
- `/Users/miroslavsekera/r/contextractor-ts/packages/crawler/src/index.ts` — re-exports `ProxyConfiguration` from `crawlee`.
- `/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/README.md` — proxy field docs to update.

## Sources

- [Crawlee — Proxy management guide](https://crawlee.dev/js/docs/guides/proxy-management)
- [Crawlee — ProxyConfiguration class API](https://crawlee.dev/js/api/core/class/ProxyConfiguration)
- [Crawlee — ProxyConfigurationOptions interface](https://crawlee.dev/js/api/core/interface/ProxyConfigurationOptions)
- [Crawlee source — proxy_configuration.ts](https://raw.githubusercontent.com/apify/crawlee/master/packages/core/src/proxy_configuration.ts)
- [Crawlee blog — How Crawlee uses tiered proxies to avoid getting blocked](https://crawlee.dev/blog/proxy-management-in-crawlee)
- [Apify — Actor input schema specification v1](https://docs.apify.com/platform/actors/development/actor-definition/input-schema/specification/v1)
- [Apify SDK — ProxyConfigurationOptions interface](https://docs.apify.com/sdk/js/reference/interface/ProxyConfigurationOptions)
- [Apify SDK — Proxy management guide](https://docs.apify.com/sdk/js/docs/guides/proxy-management)
- [Apify — Playwright Scraper](https://apify.com/apify/playwright-scraper)
- [Apify — Website Content Crawler](https://apify.com/apify/website-content-crawler)
- [Apify — Website Content Crawler input schema](https://apify.com/apify/website-content-crawler/input-schema)
- [cli/cli #1484 — Allow JSON array parameters in `gh api`](https://github.com/cli/cli/issues/1484)
- [tektoncd/cli #1104 — Passing array parameters as repeated arguments](https://github.com/tektoncd/cli/issues/1104)
- [ScrapeOps — Scrapy Proxies: Waterfall Requests Over Multiple Proxies](https://scrapeops.io/python-scrapy-playbook/scrapy-proxy-waterfall-middleware/)
- [ScrapingBee — Using cURL with a proxy](https://www.scrapingbee.com/blog/curl-proxy/)
- [Apify blog — How to use cURL with a proxy](https://blog.apify.com/curl-proxy/)
