# Research: CLI Proxy Configuration Consolidation

**Date:** 2026-05-19  
**Scope:** Contextractor standalone CLI — proxy flags design

---

## Current State

The CLI currently exposes four proxy-related configuration surfaces:

| Flag | Signature | Maps to | Notes |
|------|-----------|---------|-------|
| `--proxy <url>` | Repeatable string | `proxyUrls[]` via `CliOnlyOverrides` | Round-robin flat list |
| `--proxy-rotation <strategy>` | Enum string | `proxyRotation` | `recommended`, `per_request`, `until_failure` |
| `--proxy-tier <tier>` | Repeatable string | `tieredProxyUrls[][]` | Comma-separated URLs per tier; empty string = null (no-proxy) tier |
| `--proxy-tiers <json>` | JSON string | `tieredProxyUrls[][]` | Direct `(string\|null)[][]` serialized to JSON |

Additionally: `-c, --config <path>` accepts a JSON config file where all schema fields including `tieredProxyUrls`, `proxyRotation`, `sessionPoolName`, `maxSessionRotations` can be set.

### How proxy is constructed at runtime (`cliProgram.ts:509–558`)

Priority chain:
1. If `tieredProxyUrls` is set (from `--proxy-tier` or `--proxy-tiers`) → `new ProxyConfiguration({ tieredProxyUrls })`
2. Else if `proxyUrls` (from `--proxy`) are set → `new ProxyConfiguration({ proxyUrls })`
3. Else if `--proxy-rotation` was set without proxies → warning, no proxy used

The two modes are mutually exclusive at runtime. `--proxy` and `--proxy-tier`/`--proxy-tiers` cannot be combined.

---

## What Crawlee's ProxyConfiguration Actually Supports

### Core constructor options

```typescript
interface ProxyConfigurationOptions {
    proxyUrls?: (string | null)[];          // flat list, round-robin rotation
    tieredProxyUrls?: (string | null)[][];  // array of tier lists, auto-escalation
    newUrlFunction?: (sessionId, options) => string | null;  // fully custom
}
```

`proxyUrls` and `tieredProxyUrls` are mutually exclusive (cannot use both simultaneously).

### What a "tier" means

A tier is an ordered list of proxy URLs (or `null`) at one cost/reliability level. Tiers are indexed from cheapest (index 0) to most expensive (index N). Within a tier, proxies rotate round-robin. Across tiers, Crawlee's `ProxyTierTracker` auto-escalates per domain based on error rates.

Canonical four-tier example from the Crawlee docs:

```javascript
new ProxyConfiguration({
    tieredProxyUrls: [
        [null],                                                     // Tier 0: no proxy
        ['http://cheap-datacenter.com'],                            // Tier 1: datacenter
        ['http://proxy-a.com', 'http://proxy-b.com'],               // Tier 2: two proxies, round-robin
        ['http://premium-residential.com'],                         // Tier 3: residential
    ]
})
```

`null` at Tier 0 means "attempt without any proxy first" — added in Crawlee PR #2743 after issue #2740.

### Tiered proxies require the crawler context

`tieredProxyUrls` only works when `ProxyConfiguration` is passed to a Crawlee crawler instance. Direct `proxyConfiguration.newUrl()` calls do not activate the per-domain tier tracking. This is the documented constraint.

---

## Redundancy Analysis

### Is it required to have both `--proxy` and `--proxy-tier`?

**No.** They serve the same use case from different ergonomic angles:

- `--proxy url1 --proxy url2` → `proxyUrls: ['url1', 'url2']` → flat round-robin
- `--proxy-tier url1,url2` (single tier) → `tieredProxyUrls: [['url1', 'url2']]` → single tier, no escalation

A single tier of multiple proxies with `tieredProxyUrls` is functionally **identical** to `proxyUrls` for round-robin. So `--proxy url1 --proxy url2` and `--proxy-tier url1,url2` produce equivalent behavior when using only one tier.

**Difference that matters:** `--proxy` → `proxyUrls`; `--proxy-tier` (repeated) → `tieredProxyUrls`. These are different Crawlee constructor paths. When only one tier is provided, there is no escalation logic to differentiate them. When multiple `--proxy-tier` flags are used, the tiered escalation becomes active.

**Conclusion on `--proxy` vs `--proxy-tier`:** They overlap significantly for the flat-list case. `--proxy-tier` is strictly more expressive (it encompasses the flat-list case as a degenerate single-tier). The ergonomic cost: expressing a flat list as `--proxy-tier url1,url2` (comma-joined) is less intuitive than `--proxy url1 --proxy url2` (space-separated repeats). But maintaining two separate mechanisms that map to different Crawlee paths adds cognitive overhead.

### Is `--proxy-tiers <json>` needed alongside `--proxy-tier <tier>`?

**Rarely.** `--proxy-tiers` accepts raw `(string|null)[][]` JSON, which means it is strictly more general — it can express everything `--proxy-tier` can. The only unique capability: expressing `null` in mid-tier positions (e.g. `[[null, "http://proxy.com"]]`), whereas `--proxy-tier` only supports `null` via an empty string argument.

**In practice:** The JSON flag was added for power users who need to pass tiered config programmatically (scripted invocations, CI pipelines). The repeatable `--proxy-tier` flag is the human-friendly equivalent.

**Conclusion on `--proxy-tiers` vs `--proxy-tier`:** These also overlap completely. `--proxy-tiers` is the machine-ergonomic form and `--proxy-tier` is the human-ergonomic form of the same concept.

### Is `--proxy-tiers <json>` needed alongside `--config <path>`?

**No, not strongly.** The JSON config file already supports `tieredProxyUrls` as a first-class field. Any `--proxy-tiers` value can be expressed as:

```json
{
  "tieredProxyUrls": [
    [null],
    ["http://proxy.example.com"]
  ]
}
```

The `--proxy-tiers` flag exists only to avoid a config file for simple one-off invocations where the user wants to inline the JSON. But this is already a niche use case, and it forces users to know the JSON serialization of `(string|null)[][]`.

---

## Industry Comparison

### How other CLI scrapers handle proxy configuration

No surveyed CLI scraping tool exposes proxy *tiering* as a CLI flag. Tiering is universally handled in config files or application code.

| Tool | Proxy CLI | Tiering |
|------|-----------|---------|
| yt-dlp | `--proxy URL` (single value) | None — delegate to proxy provider |
| gallery-dl | No CLI flag — config file `gallery-dl.conf` with `"proxy"` key | Scheme-based routing in config |
| Scrapy | None — `HttpProxyMiddleware` reads env vars | Per-request via `Request.meta['proxy']` |
| Playwright CLI | `--proxy-server=URL` (single value) | None |
| httpx CLI | `--proxy URL` (single value) | Scheme-mount routing in code only |
| curl/wget | `--proxy URL` (single value) | None |

**Pattern:** CLI flag = single proxy URL for one-off runs. Everything else (lists, tiers, rotation) lives in a config file.

From [clig.dev](https://clig.dev/) guidelines: flags are for configuration that varies per invocation; config files are for stable structured settings. A `(string|null)[][]` tiered proxy list is structural data — it belongs in a config file, not on the command line.

### Crawlee / Apify community practice

The Crawlee proxy management guide shows `ProxyConfiguration` constructed in code, not via CLI flags. The Apify Actor platform exposes proxy config through the Actor's visual input form (a structured proxy picker UI), not as CLI flags. There is no Apify-published CLI tool that exposes `--proxy-tier` as a flag.

---

## Recommendation

### Option A: Keep all flags (status quo — no change)

**Pros:** No breaking change. Power users who already use `--proxy-tier` keep their scripts.  
**Cons:** Cognitive overhead from three overlapping proxy surfaces. New users are confused by the choice between `--proxy`, `--proxy-tier`, and `--proxy-tiers`.

---

### Option B: Remove `--proxy-tiers <json>`, keep `--proxy` and `--proxy-tier`

**Rationale:** `--proxy-tiers` is the least ergonomic flag (raw JSON on the command line) and is fully covered by the config file (`-c config.json` with `tieredProxyUrls`). Removing it reduces the flag count by one without removing any use case.

**Migration:** `--proxy-tiers '[[null],["http://p.com"]]'` → put in a JSON config file.

---

### Option C: Remove `--proxy-tiers <json>` and `--proxy-tier <tier>`, keep only `--proxy`

**Rationale:** Keep the CLI simple. `--proxy` covers the common case (flat list, round-robin). All tiered proxy config goes through `--config`. This matches universal CLI tool convention.

**What users lose:** The ability to express tiered proxy config without a file. They still get full tiered proxy support via `--config`.

**Migration:**
- `--proxy url1 --proxy url2` → no change
- `--proxy-tier url1,url2 --proxy-tier url3` → move to a JSON config: `{ "tieredProxyUrls": [["url1","url2"],["url3"]] }`
- `--proxy-tiers '[[...]]'` → same as above

---

### Option D: Remove `--proxy`, make `--proxy-tier` the only flag (most unified)

**Rationale:** A single repeatable `--proxy-tier` subsumes `--proxy` for the flat case (just use one tier). Removes the dual-path problem at the Crawlee constructor level.

**What users lose:** Intuitive `--proxy url1 --proxy url2` syntax; have to learn comma-separated tier syntax.

**Cons:** The ergonomic cost is high. `--proxy url` is the universal CLI convention. Removing it would be surprising. Not recommended.

---

## Suggested Approach

**Option C** best matches the proposal in the research prompt and aligns with industry practice:

- Keep `--proxy <url>` (repeatable) — universal convention, covers the common case
- Remove `--proxy-tier <tier>` — covered by `--config` with `tieredProxyUrls`
- Remove `--proxy-tiers <json>` — covered by `--config` with `tieredProxyUrls`
- Keep `-c, --config <path>` — full proxy control for advanced cases
- Keep `--input-file <file>` — URL list input

This is a **breaking change** to the CLI. Users using `--proxy-tier` or `--proxy-tiers` today would need to migrate to `--config`.

**Breaking change checklist if Option C is chosen:**
- Remove `--proxy-tier` option from `addExtractionOptions()` in `cliProgram.ts:145–150`
- Remove `--proxy-tiers` option from `cliProgram.ts:151`
- Remove `proxyTier` and `proxyTiers` from `ExtractOpts` interface
- Remove the `proxyTier`/`proxyTiers` branch in `buildSchemaOverrides()` (`cliProgram.ts:380–387`)
- Update `runExtractAction()` to only use `proxyUrls` path (`cliProgram.ts:509–558`) — remove tiered branch
- Update `parseJsonArray` usage (may become unused if only used for `--proxy-tiers`)
- Update `apps/standalone/README.md` and `apps/standalone/SPEC.md`
- Update proxy-rotation-tester tests that test `--proxy-tier` and `--proxy-tiers` paths
- Bump major version (`1.x.x` → `2.0.0`) if standalone CLI follows semver

**Note on `tieredProxyUrls` in the schema:** The Zod field `tieredProxyUrls` in `packages/schema/src/source-of-truth/input.ts` should be retained — it is a valid config file field and is also used by the Apify Actor (which has its own UI for proxy config). Only the CLI flags that expose it are removed.

---

## Sources

- Crawlee Proxy Management Guide: https://crawlee.dev/js/docs/guides/proxy-management
- Crawlee ProxyConfiguration API: https://crawlee.dev/js/api/core/interface/ProxyConfigurationOptions
- Crawlee ProxyConfiguration class: https://crawlee.dev/js/api/core/class/ProxyConfiguration
- Crawlee blog — How Crawlee uses tiered proxies: https://crawlee.dev/blog/proxy-management-in-crawlee
- Crawlee issue #2740 (null tier): https://github.com/apify/crawlee/issues/2740
- Crawlee PR #2743 (null tier impl): https://github.com/apify/crawlee/pull/2743
- CLI Guidelines: https://clig.dev/
- yt-dlp proxy docs: https://man.archlinux.org/man/yt-dlp.1
- gallery-dl config reference: https://manpages.ubuntu.com/manpages/jammy/man5/gallery-dl.conf.5.html
- Codebase: `apps/standalone/src/cliProgram.ts` (lines 140–151, 302–396, 398–420, 509–558)
- Codebase: `packages/schema/src/source-of-truth/input.ts` (lines 330–416)
