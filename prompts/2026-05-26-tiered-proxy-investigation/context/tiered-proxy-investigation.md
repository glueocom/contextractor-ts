# Tiered Proxy Configuration — Investigation Report

**Date**: 2026-05-26  
**Scope**: `tieredProxyUrls`, `tieredProxyConfig`, and `proxyConfiguration` in contextractor's actor input schema

---

## What Each Field Does

### `proxyConfiguration`
Standard Apify proxy widget (`editor: "proxy"`). Passes directly to `Actor.createProxyConfiguration(input.proxyConfiguration)`. Covers: no proxy, Apify Proxy (with `groups`, `countryCode`, datacenter/residential), and flat custom proxy URLs. No tiering — one proxy pool, used for every request.

### `tieredProxyUrls`
Crawlee core feature (`@crawlee/core`, added mid-2024; `null`-in-tiers in v3.12.0, Nov 2024). Type: `(string | null)[][]` — an array of tiers, each tier is an array of proxy URL strings (or `null` for "no proxy"). Crawlee starts on tier 0 and automatically escalates a domain to a higher tier on block detection, probing lower tiers periodically to downshift. This is a **Crawlee-native** parameter in `ProxyConfigurationOptions`. Uses **custom (non-Apify) proxy URLs only**.

### `tieredProxyConfig`
Apify SDK-specific feature (`apify@3`, NOT in `@crawlee/core`). Type: `Omit<ProxyConfigurationOptions, keyof CoreProxyConfigurationOptions | 'tieredProxyConfig'>[]` — an array of Apify proxy configuration objects, one per tier. Each element accepts `groups`, `countryCode`, `password`, etc. (same fields as `proxyConfiguration`) but not `proxyUrls` or `tieredProxyUrls`. The SDK internally converts these via `_generateTieredProxyUrls()` before passing to Crawlee. Uses **Apify Proxy (platform-managed)** tiers.

In short:
| Field | Proxy source | Tiered? | SDK layer |
|---|---|---|---|
| `proxyConfiguration` | Apify Proxy or custom URLs (flat) | No | Apify SDK |
| `tieredProxyUrls` | Custom URLs only | Yes | Crawlee core |
| `tieredProxyConfig` | Apify Proxy only | Yes | Apify SDK extension |

---

## Are the Fields Mutually Exclusive?

Yes — enforced at runtime in `apps/apify-actor/src/run.ts`:

```
tieredProxyUrls + tieredProxyConfig       → Actor exits with code 1
tieredProxyUrls + proxyConfiguration.useApifyProxy: true → Actor exits with code 1
```

The remaining case (`tieredProxyConfig` + Apify-managed `proxyConfiguration`) is **not explicitly guarded** in the current code. Since `tieredProxyConfig` also requires Apify Proxy access, combining it with `proxyConfiguration.useApifyProxy: true` would result in two Apify proxy configurations competing. The Apify SDK's own `ProxyConfiguration` constructor guards against combining `tieredProxyUrls` with `proxyUrls`/`newUrlFunction`, but the `tieredProxyConfig` path is handled via `as unknown` cast which bypasses this check.

**Unguarded edge case**: `input.tieredProxyConfig` set alongside `input.proxyConfiguration` with `useApifyProxy: true` — both branches are valid individually, but the if/else if means `tieredProxyConfig` wins silently. This may be the intended behavior (tiered takes precedence) but is not documented or logged.

---

## The `as unknown` Cast

```typescript
proxyConfig = await Actor.createProxyConfiguration({
  tieredProxyConfig: input.tieredProxyConfig as ProxyConfigurationOptions[],
} as unknown as ProxyConfigurationOptions);
```

This is a **legitimate workaround for a type declaration gap** in the Apify SDK: `Actor.createProxyConfiguration` is typed to accept `CoreProxyConfigurationOptions` (the Crawlee base type), but `tieredProxyConfig` is only declared in the Apify SDK's own `ProxyConfigurationOptions` extension. The property is real and works at runtime — the cast is needed only because the function signature doesn't expose the full Apify-extended type.

The SDK team has not updated `Actor.createProxyConfiguration`'s signature to match the extended interface. This is an SDK defect, not a contextractor defect. The cast is safe as long as `apify@3` continues to support `tieredProxyConfig`.

---

## Comparison with Official Apify Actors

No official Apify actor (`playwright-scraper`, `web-scraper`, `cheerio-scraper`) exposes tiered proxy as separate named input schema fields. All reference actors use a single `proxyConfiguration` field with the `editor: "proxy"` widget.

Tiered proxy is documented as an SDK/programmatic feature — intended to be configured in code, not surfaced as a user-facing input field.

**contextractor is the only known Apify actor that exposes tiered proxy configuration as named schema fields.**

---

## Architecture Verdict

**The design is correct and the fields are genuinely distinct.** Each addresses a real use case:

- `proxyConfiguration`: basic Apify proxy for standard scraping
- `tieredProxyUrls`: third-party proxy providers with automatic escalation (no Apify Proxy required)
- `tieredProxyConfig`: Apify Proxy with escalation from cheap/fast tiers (datacenter) to expensive/reliable tiers (residential)

The runtime mutual exclusivity enforcement in `run.ts` is correct for the cases it covers.

**Two issues to consider:**

1. **Unguarded `tieredProxyConfig` + `proxyConfiguration.useApifyProxy: true`**: The if/else means tiered wins silently. A log warning matching the existing pattern (`tieredProxyUrls and proxyConfiguration.useApifyProxy are mutually exclusive`) would improve debuggability.

2. **The `as unknown` cast**: Acceptable as a workaround, but brittle if the Apify SDK changes `tieredProxyConfig`'s semantics. Worth filing an upstream issue on `apify-sdk-js` to have `Actor.createProxyConfiguration` accept the full extended `ProxyConfigurationOptions` type.

---

## Sources

- [Crawlee ProxyConfigurationOptions](https://crawlee.dev/js/api/core/interface/ProxyConfigurationOptions) — `tieredProxyUrls` definition
- [Apify SDK ProxyConfigurationOptions](https://docs.apify.com/sdk/js/reference/interface/ProxyConfigurationOptions) — `tieredProxyConfig` definition
- [Crawlee proxy management guide](https://crawlee.dev/js/docs/guides/proxy-management) — tiered proxy docs
- [Crawlee v3.12.0 changelog](https://github.com/apify/crawlee/blob/master/CHANGELOG.md) — `null`-in-tiers support
- [apify-sdk-js proxy_configuration.ts](https://github.com/apify/apify-sdk-js/blob/master/packages/apify/src/proxy_configuration.ts) — `tieredProxyConfig` implementation
- [actor-crawler-cheerio INPUT_SCHEMA.json](https://github.com/apify/actor-crawler-cheerio/blob/master/INPUT_SCHEMA.json) — reference actor: single `proxyConfiguration` only
- Local: `apps/apify-actor/src/run.ts` — mutual exclusivity enforcement
- Local: `node_modules/.pnpm/apify@3.7.2/.../proxy_configuration.d.ts` — `tieredProxyConfig` type declaration
