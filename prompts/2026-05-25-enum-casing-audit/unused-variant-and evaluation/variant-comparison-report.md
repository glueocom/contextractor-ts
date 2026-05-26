# Enum Casing Variant Comparison Report

> Produced 2026-05-26. Compares Variant A (per-surface native) and Variant B (unified
> kebab) against the actual codebase state, external best-practice sources, and the
> Apify / TypeScript / CLI ecosystem as of 2026.

---

## Background

This project (`contextractor`) exposes the same configuration vocabulary on three surfaces:

- **Apify actor input schema** — JSON consumed by the Apify platform UI and API callers
- **npm library (`@contextractor/*`)** — TypeScript string-union types consumed by programmatic users
- **Standalone CLI** — UNIX flag values consumed by shell users

Both variants agree on the `waitUntil` fix (flat lowercase browser tokens: `load | domcontentloaded | networkidle | commit`). The substantive split is on **`proxyRotation` only**.

The current codebase has `waitUntil` as SCREAMING (`NETWORKIDLE | LOAD | DOMCONTENTLOADED`) and `proxyRotation` as SCREAMING (`RECOMMENDED | PER_REQUEST | UNTIL_FAILURE`). A `WAIT_UNTIL_MAP` in `apps/apify-actor/src/config.ts:12-14` translates SCREAMING → lowercase for Playwright passthrough.

---

## What each variant actually changes

| Field | Current | Variant A | Variant B |
|---|---|---|---|
| `waitUntil` | `NETWORKIDLE\|LOAD\|DOMCONTENTLOADED` | `load\|domcontentloaded\|networkidle\|commit` | `load\|domcontentloaded\|networkidle\|commit` |
| `proxyRotation` | `RECOMMENDED\|PER_REQUEST\|UNTIL_FAILURE` | **unchanged** (stays SCREAMING) | `recommended\|per-request\|until-failure` |
| All other enums | already lowercase/kebab | unchanged | unchanged |

The `waitUntil` change is common ground. The **only real fork** is `proxyRotation`.

---

## Variant A — Per-surface native

### What it does

- Actor schema + library type: `proxyRotation` stays SCREAMING (`RECOMMENDED | PER_REQUEST | UNTIL_FAILURE`)
- CLI: accepts kebab (`per-request`) and maps to SCREAMING via `PROXY_ROTATION_CLI_TO_CANONICAL` in `apps/standalone/src/cliProgram.ts`
- Translation cost: one small map in the CLI layer, permanent maintenance obligation

### Arguments in favor

**Apify actor ecosystem precedent.** Every official Apify first-party scraper uses SCREAMING for `proxyRotation`: `apify/web-scraper`, `apify/playwright-scraper`, `apify/puppeteer-scraper`, `apify/cheerio-scraper`. A contextractor user who copy-pastes a `proxyRotation` value from another actor schema gets it right with zero lookup.

**Principle of Least Surprise per surface.** The Apify Console and actor API callers are accustomed to SCREAMING operational-mode discriminators. The Zalando RESTful API Guidelines Rule 240 and Google AIP-126 both recommend SCREAMING_SNAKE for enum values in API schemas (the former as a SHOULD, the latter as a MUST for proto-based APIs). An API call with `"proxyRotation": "RECOMMENDED"` reads as a clear discriminator to the Apify community.

**Prior analysis conclusion.** The companion file `context/enum-casing-unified-research-2026-05.md` (2026-05-19) concluded that full unification is achievable but was rejected in favor of the dual convention for exactly these reasons — Apify ecosystem fit and zero migration cost.

### Arguments against

**The translation map is a permanent maintenance debt.** `PROXY_ROTATION_CLI_TO_CANONICAL` in the CLI is not a one-time cost. Every new `proxyRotation` value added in the future must be added to three places: the Zod schema, the CLI map, and the CLI help text. It is small debt, but it never disappears.

**No CLI tool in the industry uses SCREAMING flag values.** Docker (`--restart on-failure`), git (`--color auto`), cargo (`--profile release`), npm (`--loglevel verbose`), gh (`--state open`), ffmpeg (`-preset slow`) — all lowercase or kebab. The picocli community explicitly documented this in issue #1707: SCREAMING CLI values "reflect a limitation of the underlying implementation and not a choice based on UI best practices." A shell user typing `--proxy-rotation RECOMMENDED` would find it jarring.

**Apify has no enforced convention.** Despite the SCREAMING precedent in older actors, Apify publishes no linting rule, RFC, or explicit style guide mandating SCREAMING for actor-owned enum values. The `apify/website-content-crawler` (one of their most prominent actors) uses lowercase-colon for `crawlerType` (`playwright:chrome`, `cheerio`). Apify's own input schema documentation examples use lowercase (`"us"`, `"de"`, `"fr"`). The SCREAMING `proxyRotation` pattern dates from 2019-2021 actors and is not a forward-looking Apify commitment.

**`proxyRotation` is actor-owned, not platform-validated.** The Apify platform validates `proxyConfiguration` sub-fields (like `groups: ["RESIDENTIAL"]`) byte-for-byte because those are proxy group identifiers the platform resolves. `proxyRotation` is consumed entirely by the actor's own code and mapped programmatically to Crawlee's `ProxyConfigurationOptions`. Changing it from `"RECOMMENDED"` to `"recommended"` requires zero Apify backend change. It is NOT in the same category as `RESIDENTIAL` or `GOOGLE_SERP`.

---

## Variant B — Unified kebab

### What it does

- Actor schema + library type + CLI: `proxyRotation` becomes `recommended | per-request | until-failure`
- No translation map anywhere in the system for `proxyRotation`
- One vocabulary for all three surfaces

### Arguments in favor

**No translation layer anywhere.** Once both `waitUntil` and `proxyRotation` are kebab, the codebase has zero enum translation maps. The value flows schema → library type → actor config → Crawlee without a string transform. `waitUntil` flows schema → CLI → Playwright verbatim. The current `WAIT_UNTIL_MAP` is deleted; no `PROXY_ROTATION_CLI_TO_CANONICAL` is created.

**Dominant TypeScript npm ecosystem convention.** Playwright (`'load' | 'domcontentloaded' | 'networkidle'`), esbuild (`'local-css' | 'cjs' | 'esm'`), Vitest (`'threads' | 'forks'`), OpenAI SDK (`'stop' | 'length' | 'tool_calls'`), Stripe Node (`'incomplete' | 'past_due' | 'active'`), TanStack Query (`'loading' | 'error' | 'success'`) all use lowercase string unions. No major TypeScript library published in 2024-2026 exposes SCREAMING_SNAKE_CASE in its public configuration type surface. A TypeScript developer encountering `'RECOMMENDED' | 'PER_REQUEST' | 'UNTIL_FAILURE'` in a string union type reads it as a constant reference, not an ergonomic configuration value.

**Single mental model across surfaces.** A developer using all three surfaces (actor JSON, programmatic library, CLI) carries one vocabulary: `per-request` means `per-request` everywhere. Variant A requires them to learn that `per-request` (CLI) equals `PER_REQUEST` (actor/library). Cognitive overhead is small per lookup but accumulates across a team.

**CLI convention is unambiguously lowercase.** The industry evidence is overwhelming: every major Unix/GNU tool uses lowercase (or kebab for compound words) for option values. There is no counterexample from a developer-facing tool that deliberately chose SCREAMING values for user-typed flags.

**Crawlee's `ProxyRotation` TypeScript enum values are numeric.** Crawlee's `ProxyRotation.RECOMMENDED` is a numeric enum member, not a string. The string `"RECOMMENDED"` in Apify actor schemas is a contextractor-imposed string constant, not a Crawlee API contract. Changing it to `"recommended"` requires only updating contextractor's own code.

**Apify Console UX is unaffected.** The Apify Console renders `enum` + `enumTitles` as a dropdown. The raw enum value is never shown to the user if `enumTitles` is supplied — which contextractor already does. Casing of `proxyRotation` has zero UX consequence in the Console.

### Arguments against

**Cosmetic divergence from `apify/playwright-scraper`.** An experienced Apify user comparing contextractor's input schema with `apify/playwright-scraper` would notice `per-request` vs `PER_REQUEST` and might be momentarily surprised. This is the only real cost, and it is cosmetic.

**Breaks existing actor invocations.** Any caller who currently passes `"proxyRotation": "RECOMMENDED"` (e.g. saved actor runs, integration tests, documentation snippets, or external scripts) would need updating. Given the project is explicitly greenfield with no backward-compatibility requirements, this is a non-issue for now — but worth noting for production timing.

---

## External evidence summary

| Dimension | Variant A (SCREAMING in actor) | Variant B (kebab everywhere) |
|---|---|---|
| Apify first-party actor precedent (older actors) | **Strong** — `apify/web-scraper`, `apify/playwright-scraper` | Weak |
| Apify enforced convention | None — no linting rule or RFC | None |
| Apify newer actors (`website-content-crawler`) | Mixed (SCREAMING + lowercase in same schema) | **Aligned** (lowercase trend) |
| REST/JSON API style guides (Google AIP, Zalando) | **Aligned** (SCREAMING SHOULD/MUST) | Not aligned |
| Developer-facing JSON API practice (Stripe, GitHub REST) | Not aligned (both use lowercase) | **Aligned** |
| TypeScript npm library convention (Playwright, esbuild, Vitest, Stripe, OpenAI) | Not aligned (~0% SCREAMING) | **Strong** (~80% lowercase/kebab) |
| UNIX CLI tool convention | **Not aligned** (no major tool uses SCREAMING values) | **Strong** (universal lowercase/kebab) |
| Apify platform validation requirement | Only for foreign constants (RESIDENTIAL, READ/WRITE) — proxyRotation NOT validated | Same |
| Translation maps required | 1 (CLI layer, permanent) | 0 |
| Playwright `waitUntil` passthrough | Zero-cost (both agree) | Zero-cost (both agree) |
| Trafilatura `mode` passthrough | Zero-cost (both agree) | Zero-cost (both agree) |

---

## Recommendation

**Variant B is the stronger long-term design for this project.**

The decisive factors:

- `proxyRotation` is actor-owned, not Apify-backend-validated. There is no hard platform reason to keep it SCREAMING.
- The CLI surface forces the issue. Every user who types `--proxy-rotation` will use lowercase. Variant A requires a permanent translation map that exists solely to bridge an internal naming choice from the actor schema to the CLI. That map is small but real ongoing maintenance.
- The TypeScript library surface follows the npm ecosystem, which uses lowercase string unions exclusively in 2025-2026. SCREAMING values in a TypeScript type look like constant identifiers, not ergonomic configuration choices.
- Apify's own newer actors (and their own spec examples) trend toward lowercase for user-facing actor input fields, showing that the SCREAMING `proxyRotation` precedent is not a forward-looking Apify commitment.
- The prior rejection of Variant B (recorded in `context/enum-casing-unified-research-2026-05.md`) cited "zero migration cost" as the primary reason to keep SCREAMING. That argument was correct at the time of its writing but was predicated on `waitUntil` being the only planned change. Since both variants now require changing `waitUntil`, the migration delta between A and B is minimal — exactly 3 additional string values (`RECOMMENDED → recommended`, `PER_REQUEST → per-request`, `UNTIL_FAILURE → until-failure`) plus deletion of the CLI translation map.

### When Variant A remains appropriate

If a future field is genuinely a **foreign platform constant** — one the Apify platform backend validates byte-for-byte (like `apifyProxyGroups: RESIDENTIAL`) — keep it SCREAMING regardless of which variant is used. That is not a variant choice; it is a hard constraint. Both variants agree on this boundary.

### The two-step casing rule for contextractor

After adopting Variant B, the rule becomes simple:

- **Actor-owned value → kebab-case** (project defines it, project reads it, project maps it internally)
- **Foreign platform constant → verbatim SCREAMING** (Apify backend validates it; contextractor never renames it)

The distinguishing test (from Variant B's own framing): *"If I rename this value, does an Apify backend reject it?"* If yes → foreign constant, leave it SCREAMING. If no → owned, kebab it.

---

## `waitUntil` is settled by both variants

Both variants converge on `load | domcontentloaded | networkidle | commit` — flat lowercase browser tokens. These are not kebab choices; they are Playwright/Crawlee/browser API tokens defined outside the project. `domcontentloaded` and `networkidle` are single opaque upstream tokens (DOM lifecycle event names), not compound words that contextractor assembled. They must never be dashed (`dom-content-loaded`, `network-idle`) because that would force a `.replace(/-/g, '')` shim at every `page.goto()` call. The current `WAIT_UNTIL_MAP` in `apps/apify-actor/src/config.ts:12-14` and the `parseWaitUntil` translation in `apps/standalone/src/cliProgram.ts:54-63` are both deletable under either variant.

---

## Sources

- [Apify Playwright Scraper input schema](https://apify.com/apify/playwright-scraper/input-schema) — SCREAMING proxyRotation confirmed
- [Apify Website Content Crawler input schema](https://apify.com/apify/website-content-crawler/input-schema) — lowercase crawlerType, confirming mixed casing in newer actors
- [Apify input schema specification v1](https://docs.apify.com/platform/actors/development/actor-definition/input-schema/specification/v1) — lowercase in own examples (`"us"`, `"de"`, `"fr"`); no casing rule stated
- [Crawlee BasicCrawlerOptions API](https://crawlee.dev/js/api/basic-crawler/interface/BasicCrawlerOptions) — ProxyRotation is a numeric enum; string `"RECOMMENDED"` is actor-convention, not Crawlee contract
- [Google AIP-126](https://google.aip.dev/126) — MUST UPPER_SNAKE for proto-based APIs; not applicable to JSON-native schemas
- [Zalando RESTful API Guidelines Rule 240](https://opensource.zalando.com/restful-api-guidelines/#240) — SHOULD UPPER_SNAKE; justification is visual distinction, not interoperability
- [Stripe PaymentIntent object](https://docs.stripe.com/api/payment_intents/object) — lowercase_snake exclusively in a major developer-facing API
- [GitHub REST API](https://docs.github.com/en/rest/pulls/pulls) — lowercase for user-configurable fields; SCREAMING only for platform-discriminator `author_association`
- [picocli issue #1707](https://github.com/remkop/picocli/issues/1707) — SCREAMING CLI values described as "implementation detail, not a UI best practice"; translation layer proposed as user-facing fix
- [Docker restart policies](https://docs.docker.com/engine/containers/start-containers-automatically/) — lowercase kebab for all option values
- [Playwright page.goto() waitUntil](https://playwright.dev/docs/api/class-page#page-goto) — `"load" | "domcontentloaded" | "networkidle" | "commit"` verbatim
- [esbuild types](https://github.com/evanw/esbuild/blob/main/lib/shared/types.ts) — lowercase kebab across all configuration string unions
- [TanStack Query v4 migration guide](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-react-query-4) — explicit replacement of enum constants with lowercase string literals
- [Tidy TypeScript: avoid enums](https://fettblog.eu/tidy-typescript-avoid-enums/) — community consensus toward lowercase string-literal unions
- `context/enum-casing-unified-research-2026-05.md` — prior in-project research (2026-05-19); full unification analysis and the prior rejection rationale
