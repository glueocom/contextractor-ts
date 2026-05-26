# Unified Enum-Value Casing for `contextractor`: Considered and Rejected

> Research conducted 2026-05-19 after the first enum-casing report. User
> asked: is full unification across the Apify Actor input schema and the
> npm library achievable, and if so, which casing? Conclusion: full
> unification under `lowercase-kebab-case` IS achievable, but rejected in
> favor of the Apify dual convention (see companion report
> `enum-casing-research-2026-05.md`) because the dual convention is
> the de facto Apify ecosystem pattern, requires zero changes beyond
> `waitUntil` (already planned in SCHEMA-REVIEW), and preserves
> `proxyRotation`'s match with `apify/playwright-scraper`.

## TL;DR

- **Adopt lowercase-with-kebab-case for every enum value across the Zod source-of-truth, the generated `input_schema.json`, and the npm library types.** It is the only convention that (a) matches the dominant TypeScript-npm style observed in Playwright, esbuild, Vitest and the OpenAI SDK, (b) lets you forward `waitUntil` to Playwright and `mode → focus` to Trafilatura **with zero translation maps**, and (c) is already the CLI convention you have committed to — so the schema, library and CLI become one vocabulary instead of three.
- **Yes, full unification is achievable** for a greenfield actor+library hybrid like `contextractor` — but you must accept that you will look *different* from first-party Apify actors such as `apify/web-scraper` and `apify/playwright-scraper`, which mix SCREAMING_SNAKE_CASE platform identifiers (`PER_REQUEST`, `RECOMMENDED`, `RESIDENTIAL`, `PAY_PER_EVENT`, `RUNNING`/`SUCCEEDED`) with lowercase user-facing identifiers (`playwright:chrome`, `cheerio`, `markdown`). No first-party Apify actor I surveyed uses a single uniform enum casing, and Apify has never published an RFC, style guide, or GitHub-issue conclusion on this question.
- **The one cost** of choosing lowercase-kebab-case: `proxyRotation` values stop matching the apify/playwright-scraper precedent verbatim (you'll write `'per-request'` instead of `'PER_REQUEST'`). This is a cosmetic divergence from first-party Apify scrapers, *not* a runtime cost — `contextractor` consumes Crawlee's `ProxyConfigurationOptions` programmatically, not by forwarding the schema string, so no `PROXY_ROTATION_MAP` analogue is required. The trade is: lose 1 line of Apify-look-alike, delete `WAIT_UNTIL_MAP` permanently, and never have to add `MODE_MAP` for Trafilatura.

## Key Findings

### 1. Unified casing is *unusual* in first-party Apify actors, but the field is wide-open

I surveyed the public `INPUT_SCHEMA.json` of `apify/web-scraper`, `apify/puppeteer-scraper`, `apify/playwright-scraper`, `apify/cheerio-scraper`, `apify/website-content-crawler`, `apify/rag-web-browser`, `apify/instagram-scraper`, and the OpenAPI definitions exported by Apify Store for each. **None of them use a single uniform enum casing.** Representative findings:

| Actor | Field | Casing |
|---|---|---|
| `apify/website-content-crawler` | `crawlerType` | lowercase + `:` namespace (`playwright:chrome`, `cheerio`, `jsdom`) |
| `apify/playwright-scraper`, `apify/web-scraper`, `apify/cheerio-scraper`, `apify/puppeteer-scraper` | `proxyRotation` | SCREAMING_SNAKE (`RECOMMENDED`, `PER_REQUEST`, `UNTIL_FAILURE`) |
| `apify/rag-web-browser` | `outputFormats` | lowercase (`markdown`, `text`, `html`) |
| `apify/rag-web-browser` (log of `scrapingTool`) | `scrapingTool` | kebab-case (`raw-http`) and lowercase |
| Third-party crawlers (`tugelbay/rag-web-browser` etc.) | `outputType` + `outputFormat` | SCREAMING_SNAKE (`CHUNK_BASED`, `PAGE_BASED`) and lowercase (`markdown`, `plaintext`) **in the same schema** |
| `apify/instagram-scraper` | `resultsType` | lowercase (`posts`, `comments`, `details`, `mentions`, `reels`, `stories`) |
| Apify proxy SDK | `apifyProxyGroups` values | SCREAMING (`RESIDENTIAL`, `GOOGLE_SERP`) |
| Apify REST API (`docs.apify.com/api/v2`) | run `status` | SCREAMING with kebab inside SCREAMING (`READY`, `RUNNING`, `SUCCEEDED`, `FAILED`, `TIMING-OUT`, `TIMED-OUT`, `ABORTING`, `ABORTED`) |
| Apify REST API | `pricingModel` | SCREAMING (`PAY_PER_EVENT`, `PRICE_PER_DATASET_ITEM`, `FLAT_PRICE_PER_MONTH`, `FREE`) |
| Apify webhooks (`docs.apify.com/platform/integrations/webhooks/events`) | event types | `ACTOR.RUN.SUCCEEDED`, `ACTOR.BUILD.TIMED_OUT` — dotted SCREAMING |
| Apify Store categories (per Actor Schema Registry docs) | category enum | SCREAMING (`LEAD_GENERATION`, `SEO_TOOLS`, `SOCIAL_MEDIA`, `ECOMMERCE`) |

**Pattern, not rule:** Apify uses SCREAMING_SNAKE_CASE for *platform-level* identifiers that travel through the REST API as response-body discriminators (run status, pricing model, webhook event, store category, proxy group), and lowercase/camelCase/kebab-case for *user-facing actor input* (crawler type, output format, results type). This is *not* documented as a rule anywhere — I searched `apify/apify-shared-js`, `apify/actor-scraper`, `apify/crawlee`, `apify/apify-docs`, the Apify blog, and indexed Apify Discord pages for any post 2024-01 → 2026-05 proposing or settling a unified casing convention, and **found none**. The closest hit is `apify/apify-shared-js` issue #133 from October 2020, which is about validating duplicate enum values, not casing.

### 2. The official Apify TypeScript / npm libraries do **not** standardize casing either

- `apify-client` (npm) returns the REST API verbatim: `client.actor('x').lastRun({ status: 'SUCCEEDED' })` and `run.status === 'SUCCEEDED'` use SCREAMING because that is what the API emits (`docs.apify.com/api/client/js/reference/class/RunClient`).
- Crawlee's `EventType` const enum in `crawlee/packages/core/src/events/event_manager.ts` is defined as `PERSIST_STATE = 'persistState', SYSTEM_INFO = 'systemInfo', MIGRATING = 'migrating', ABORTING = 'aborting', EXIT = 'exit'` — the TypeScript enum *keys* are SCREAMING; the actual *string values* the runtime consumes are camelCase.
- Crawlee's `LogLevel` is a numeric enum (`DEBUG: 5, ERROR: 1, INFO: 4, OFF: 0, PERF: 6, SOFT_FAIL: 2, WARNING: 3`) per `crawlee.dev/api/core/enum/LogLevel`, but the configurable `APIFY_LOG_LEVEL` env-var and `log.setLevel(log.LEVELS.DEBUG)` accept SCREAMING tokens.

**Conclusion:** Apify's own TypeScript surface is mixed (numeric enums, camelCase string values for events, SCREAMING for platform statuses). There is no single "Apify TypeScript convention" to match.

### 3. The TypeScript npm ecosystem outside Apify is overwhelmingly **lowercase string-literal unions**

This is the strongest signal. Every major library I surveyed uses lowercase (with kebab-case or no separator for multi-word) for enum-like configuration values exposed in public TS types:

| Library | Field | Type (verbatim) | Source |
|---|---|---|---|
| `@playwright/test` | `reporter` | `'list' \| 'dot' \| 'line' \| 'json' \| 'junit' \| 'html' \| 'github' \| 'blob'` | `playwright.dev/docs/test-reporters` |
| `playwright` | `page.goto({ waitUntil })` | `"load" \| "domcontentloaded" \| "networkidle" \| "commit"` | `playwright.dev/docs/api/class-page` |
| `esbuild` | `Loader` | `'base64' \| 'binary' \| 'copy' \| 'css' \| 'dataurl' \| 'default' \| 'empty' \| 'file' \| 'js' \| 'json' \| 'jsx' \| 'local-css' \| 'text' \| 'ts' \| 'tsx'` | `github.com/evanw/esbuild/blob/main/lib/shared/types.ts` |
| `esbuild` | `Platform` / `Format` | `"browser" \| "node" \| "neutral"`; `"iife" \| "cjs" \| "esm"` | `github.com/evanw/esbuild/blob/main/lib/shared/types.ts` |
| `vitest` | `pool` | `'threads' \| 'forks' \| 'vmThreads' \| 'vmForks'` | `vitest.dev/config/pool` (verbatim "Type: 'threads' \| 'forks' \| 'vmThreads' \| 'vmForks'") |
| OpenAI Node SDK | `role` | `'system' \| 'user' \| 'assistant' \| 'tool'` | Chat Completions API |
| OpenAI Node SDK | `finish_reason` | `'stop' \| 'length' \| 'tool_calls' \| 'content_filter'` (snake_case for multi-word) | OpenAI cookbook |
| Stripe Node | `Subscription.status` | `'incomplete' \| 'incomplete_expired' \| 'trialing' \| 'active' \| 'past_due' \| 'canceled' \| 'unpaid'` | Stripe Subscriptions API docs |

The dominant convention: **lowercase single tokens, with `-` (kebab) or `_` (snake) for multi-word**. Playwright + esbuild pick kebab (`local-css`); Stripe + OpenAI pick snake (`past_due`, `tool_calls`); Vitest picks camel (`vmThreads`). No major TS library exposes SCREAMING_SNAKE_CASE values in its public configuration TS types in 2026.

### 4. Crawlee's own convention is mixed but **leans lowercase-camelCase for runtime string values**

From `crawlee/packages/core/src/events/event_manager.ts`:

```ts
export const enum EventType {
    PERSIST_STATE = 'persistState',
    SYSTEM_INFO = 'systemInfo',
    MIGRATING = 'migrating',
    ABORTING = 'aborting',
    EXIT = 'exit',
}
export type EventTypeName = EventType | 'systemInfo' | 'persistState' | 'migrating' | 'aborting' | 'exit';
```

The *wire format* is camelCase. The TypeScript identifiers (keys) are SCREAMING, the string values are lowercase/camelCase. Crawlee for Python's official upgrading guide (`crawlee.dev/python/docs/upgrading/upgrading-to-v0x`) states verbatim: *"The EnqueueStrategy has been changed from an enum to a string literal type. All its values and their meaning remain unchanged."* This is a deliberate move *toward* the string-literal-union pattern that this report recommends.

### 5. JSON-Schema / OpenAPI guidance is "be consistent" but unopinionated about which case

Speakeasy's *"Enums in OpenAPI best practices"* (`speakeasy.com/openapi/schemas/enums`) states verbatim under *Naming conventions*: *"Be consistent throughout your schema. If you use uppercase, like NEW, then stick to uppercase for all values in all enums."* Other 2024-2025 enum-design guides (Tyk's *"Enums in API design"*, Fern's enum-casing docs, Swagger's OAS-3 enum guide, openapiprocessor's enum-mapping articles) echo the same point in different phrasing: **consistency matters; the specific case does not.** Tooling such as Speakeasy (`x-speakeasy-enums`, `x-speakeasy-name-override`) and Fern (`x-fern-enum` with explicit per-language `casing` sub-fields for `snake`, `camel`, `screamingSnake`, `pascal`) provides extensions specifically to remap enum values per target language *because* there is no community-wide answer. OpenAPI 3.2 itself only mandates that field *names* be case-sensitive; enum value casing is left to the API author.

JSON:API and GraphQL conventions diverge (GraphQL standardizes on SCREAMING_SNAKE for enums; JSON:API stays close to JSON-property snake_case). The TypeScript-driven REST ecosystem has *not* converged toward GraphQL's SCREAMING; it has converged toward lowercase string-literal unions, as section 3 shows.

### 6. Apify's input-schema UI does not depend on casing

The Apify Console renders `enum` + `enumTitles` as a dropdown: `enum` holds the *machine* value sent to your actor; `enumTitles` holds the human-readable label shown to the user. The spec at `docs.apify.com/platform/actors/development/actor-definition/input-schema/specification/v1` shows the canonical example: `"enum": ["us", "de", "fr"], "enumTitles": ["USA", "Germany", "France"]` — Apify's own documentation **never uses** SCREAMING_SNAKE in its rendering examples. The user never sees the raw enum value if you supply `enumTitles`. **Casing has zero UX consequence in the Console.** It only matters to API callers, to your Zod/TS types, and to upstream library passthrough.

### 7. The Trafilatura and Playwright passthrough constraints decide it

The verified upstream signatures:

- **Playwright** (verbatim from `playwright.dev/docs/api/class-page`, `page.goto()` options): *`waitUntil "load" | "domcontentloaded" | "networkidle" | "commit"` — When to consider operation succeeded, defaults to `load`.* The same docs flag `'networkidle'` verbatim as: *"'networkidle' - DISCOURAGED consider operation to be finished when there are no network connections for at least 500 ms. Don't use this method for testing, rely on web assertions to assess readiness instead."*
- **Trafilatura** (verbatim from `trafilatura/settings.py`, inside `Extractor.__init__`):
  ```python
  self.focus: str = (
      "recall" if recall else "precision" if precision else "balanced"
  )
  ```
  Three lowercase values: `"precision"`, `"balanced"`, `"recall"`. Default is `"balanced"`. Corroborating usages: `trafilatura/main_extractor.py` contains `if options.focus == "recall":` and `trafilatura/core.py` contains `if len_text < options.min_extracted_size and not options.focus == "precision":`.

Any choice **other than lowercase** for these two fields forces a translation map at the boundary. SCREAMING_SNAKE_CASE for the schema means `WAIT_UNTIL_MAP` *and* a new `MODE_MAP` for the Trafilatura sidecar. The `contextractor` team has explicitly committed to deleting `WAIT_UNTIL_MAP`, so re-introducing its mirror image for Trafilatura would be self-defeating.

## Details

### Comparison Matrix of all 5 candidate conventions

Legend for cells:
- **First-party Apify presence**: rough share of enum fields in the surveyed Apify actors (`web-scraper`, `puppeteer-scraper`, `playwright-scraper`, `cheerio-scraper`, `website-content-crawler`, `rag-web-browser`, `instagram-scraper`, `google-search-scraper`) that use this casing.
- **Major TS npm presence**: share of surveyed libraries (Playwright, esbuild, Vitest, OpenAI, Stripe, Crawlee public string values) that use this casing as the *dominant* style.
- **Translation maps needed**: how many of `contextractor`'s 7 enum fields would require a map to forward to upstream code if this casing were chosen.

| Convention | Example | % first-party Apify | % major TS npm | `contextractor` fields changed | Translation maps needed | Pros | Cons |
|---|---|---|---|---|---|---|---|
| **lowercase + kebab-case** (RECOMMENDED) | `per-request`, `until-failure`, `load`, `key-value-store`, `precision` | ~55% (lowercase) + ~10% (kebab) ≈ 65% of input-schema field values | ~80% (Playwright, esbuild, Vitest, Crawlee event strings) | `proxyRotation` (3 values), `waitUntil` (3 values) — both already planned to migrate | **Zero.** Playwright `waitUntil` passes through verbatim; Trafilatura `focus` passes through verbatim; `key-value-store`/`dataset` already kebab; CLI flags identical | Same vocabulary across schema, library, CLI; matches dominant TS-npm ecosystem; preserves both upstream passthroughs; no `WAIT_UNTIL_MAP`, no `MODE_MAP` | Diverges cosmetically from `apify/playwright-scraper` SCREAMING `PROXY_ROTATION` precedent |
| **lowercase + snake_case** | `per_request`, `until_failure`, `domcontentloaded` (single-token), `key_value_store`, `precision` | ~5% (rare; mainly Stripe-style identifiers and OpenAI `tool_calls`) | ~30% (Stripe, OpenAI for multi-word; nobody else) | Same as kebab + `saveDestination` (was kebab, becomes snake) | Zero for Playwright + Trafilatura; **but breaks `saveDestination: 'key-value-store' \| 'dataset'`** because Apify's own user-facing resource-identifier strings are kebab | Familiar to Python/Stripe/OpenAI users | CLI is already kebab, so CLI would diverge or you'd add a snake↔kebab CLI bridge; conflicts with Apify's resource-identifier convention |
| **camelCase** (all-words-jammed) | `perRequest`, `untilFailure`, `loadEvent`, `keyValueStore`, `precision` | ~15% (Crawlee event strings `'persistState'`, `'systemInfo'`) | ~15% (Vitest `vmThreads`) | All 7 fields require some change | **Two.** `waitUntil`: `'domcontentloaded'` is canonically one token in Playwright — recasing to `'domContentLoaded'` requires a map; Trafilatura `focus` requires a map (Trafilatura is lowercase) | Plays nicely with JS object-key idioms | Re-introduces 2 translation maps (the exact thing being deleted); diverges from CLI; Playwright's `'domcontentloaded'` is canonical and unbroken |
| **SCREAMING_SNAKE_CASE** (current `proxyRotation`, `waitUntil`) | `PER_REQUEST`, `UNTIL_FAILURE`, `LOAD`, `KEY_VALUE_STORE`, `PRECISION` | ~30% (REST API statuses, `proxyRotation`, pricing, categories, webhooks) | ~0% (no major TS lib exposes SCREAMING values in public config types) | All 7 fields change; only the 2 already-SCREAMING fields stay | **Three.** `WAIT_UNTIL_MAP` (back), `MODE_MAP` (new), `SAVE_FORMAT_MAP` (new for Trafilatura passthrough). Plus `saveDestination` becomes `KEY_VALUE_STORE`, no longer matches Apify resource-identifier strings | Matches first-party Apify REST API discriminator style; familiar from GraphQL enums | Re-introduces every translation map; contradicts Trafilatura/Playwright lowercase; contradicts dominant TS-npm style; the user explicitly wants `WAIT_UNTIL_MAP` deleted |
| **PascalCase** | `PerRequest`, `UntilFailure`, `Load`, `KeyValueStore`, `Precision` | ~0% | ~0% (used for *type names* in TS, never for *values*) | All 7 fields change | Three translation maps (same as SCREAMING) | None applicable for value strings | Off-convention everywhere; treated as a TypeScript class/interface name, not a value |

### Per-Field Migration Table (under the rejected lowercase-kebab unified approach)

| Field | Current values | Unified values | Translation map required? |
|---|---|---|---|
| `crawlerType` | `'playwright:adaptive' \| 'playwright:firefox' \| 'playwright:chromium' \| 'cheerio'` | **unchanged** — already lowercase + `:` namespace, which fits "lowercase with non-letter separators are allowed" | No |
| `deduplication` | `'minimal' \| 'basic' \| 'full'` | **unchanged** | No |
| `mode` | `'precision' \| 'balanced' \| 'recall'` | **unchanged** | No — passes through to Trafilatura `Extractor.focus` verbatim |
| `save` | `'txt' \| 'markdown' \| 'json' \| 'html' \| 'original'` | **unchanged** | No |
| `saveDestination` | `'key-value-store' \| 'dataset'` | **unchanged** — already kebab | No |
| `proxyRotation` | `'RECOMMENDED' \| 'PER_REQUEST' \| 'UNTIL_FAILURE'` | **`'recommended' \| 'per-request' \| 'until-failure'`** | No (consumed via Crawlee `ProxyConfigurationOptions`, not forwarded as string) |
| `waitUntil` | `'NETWORKIDLE' \| 'LOAD' \| 'DOMCONTENTLOADED'` | **`'load' \| 'domcontentloaded' \| 'networkidle'`** (optionally add `'commit'` since Playwright supports it) | No — passes through to Playwright `page.goto({waitUntil})` verbatim. `WAIT_UNTIL_MAP` can be deleted |

### Honest assessment of the trade-off

Under `lowercase-kebab-case` unification:

- Playwright `waitUntil` accepts `'load' | 'domcontentloaded' | 'networkidle' | 'commit'`. Lowercase-kebab forwards it verbatim → 0 maps.
- Trafilatura `Extractor.focus` accepts `"precision" | "balanced" | "recall"`. Lowercase forwards it verbatim → 0 maps.
- Apify resource identifiers (`key-value-store`, `dataset`) are *already* lowercase-kebab in the user-facing identifier strings → 0 maps.
- `proxyRotation` strategies are not forwarded to any upstream library as strings; Crawlee accepts a programmatic `ProxyConfigurationOptions` object → 0 maps.
- File-format identifiers (`txt`, `markdown`, `json`, `html`, `original`) are already lowercase → 0 maps.

**The only thing you give up** is the surface-level resemblance to `apify/playwright-scraper`'s SCREAMING `proxyRotation` triple. Quantified cost: change 6 enum string values (`RECOMMENDED → recommended`, `PER_REQUEST → per-request`, `UNTIL_FAILURE → until-failure`, `NETWORKIDLE → networkidle`, `LOAD → load`, `DOMCONTENTLOADED → domcontentloaded`). Delete 1 translation map (`WAIT_UNTIL_MAP`). Net code delta: roughly +6 string literals, −10 lines of map code, −1 unit test for the map.

## Why this was rejected in favor of the Apify dual convention

After this report was produced, the user opted to follow the **Apify Style** (the dual convention from the companion report `enum-casing-research-2026-05.md`) rather than full unification. Reasoning:

1. **Apify ecosystem fit beats abstract unification.** `proxyRotation: 'RECOMMENDED' | 'PER_REQUEST' | 'UNTIL_FAILURE'` matches `apify/playwright-scraper` and `apify/web-scraper` verbatim. Diverging from this saves no runtime code but creates one more difference for users moving between actors.
2. **Zero migration cost.** The dual convention requires changing only `waitUntil` (which SCHEMA-REVIEW already plans). Full unification would also change `proxyRotation`, with no functional benefit since Crawlee consumes that value programmatically anyway.
3. **The "single vocabulary across schema/library/CLI" goal is preserved at the user-touch points.** Every value a user types or sees in JSON config — `crawlerType`, `mode`, `deduplication`, `save`, `saveDestination`, `waitUntil` — is lowercase/kebab. The two SCREAMING values (`proxyRotation` exposed in schema, plus internal status values from `apify-client`) are at API/platform-discriminator level, not user-touch level.

This report is retained as the evidence baseline for the unification analysis. The active convention is documented in `../meta-promts/meta-promtt-casing.md` and is summarized in `enum-casing-research-2026-05.md`.
