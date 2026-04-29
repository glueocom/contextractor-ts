# Engine rearchitecture

Detailed plan in [`research-summary.md`](./research-summary.md); evidence in the three sibling research files.

## Goal

Drop duplicated browser/crawler/cookie logic between `apps/contextractor-apify` and `apps/contextractor-standalone`. Split `packages/contextractor-engine` into two layered packages. Replace bespoke cookie-dismiss with `@ghostery/adblocker-playwright` plus `@duckduckgo/autoconsent` fallback.

## Actions

1. **Split engine** ([`research-monorepo-structure.md`](./research-monorepo-structure.md)):
   - `@contextractor/extraction` — pure HTML→content; trafilatura + napi-rs Rust crate at `./native`; absorbs `computeContentInfo` + `projectMetadata`. No Crawlee/Playwright deps.
   - `@contextractor/crawler` — `PlaywrightCrawler` factory, handler, browser launch options, scroll, cookies. Exposes `Sink<T>` + `fileSink` + `memorySink`.
   - `kvsSink` + `datasetSink` stay in `apps/contextractor-apify/src/` — single consumer, no package needed.

2. **Replace cookie handling** ([`research-cookie-dismissal.md`](./research-cookie-dismissal.md)):
   - Delete `COOKIE_DISMISS_SCRIPT` from both apps.
   - Use `@ghostery/adblocker-playwright` (MPL-2.0) as the primary first-pass blocker, wired via `preNavigationHooks`; cache serialized engine to `.cache/adblock-engine.bin`.
   - `@duckduckgo/autoconsent` lazy-loaded as fallback for real reject-click flows.
   - Do **not** adopt GPL-3.0 `idcac-playwright` or Crawlee's `closeCookieModals()` (it still depends on `idcac-playwright`).

3. **Use Crawlee built-ins** ([`research-crawlee-pattern.md`](./research-crawlee-pattern.md)):
   - Replace manual `scrollBy(0, 500)` loop with `crawlingContext.infiniteScroll({ maxScrollHeight, scrollDownAndUp, buttonSelector, stopScrollCallback })`.
   - Default `useSessionPool: true` + `persistCookiesPerSession: true` for browser mode.
   - If initial-cookie diffing is still needed, inline a tiny local helper over `session.getCookies(url)`; do not add `@apify/scraper-tools`.

4. **Rename**: `contextractor-apify` → `apify-actor`; `contextractor-standalone` → `standalone` (library + CLI; keep the role name, drop the project prefix); `packages/contextractor-schema` → `packages/schema` (package name `@contextractor/schema` unchanged). Update Apify Console git path. `pnpm-workspace.yaml` globs (`apps/*`, `packages/*`) need no edit.

5. **Shrink entry points**: after rename, `apps/apify-actor/src/main.ts` ≤30 LOC; `apps/standalone/src/cli.ts` ≤40 LOC — pure wiring, no Playwright import.

6. **Update all docs**: after the refactoring, sweep every README, `.actor/` spec, `INPUT_SCHEMA.json` description strings, and any markdown in `packages/` and `apps/` — update package names, directory paths, API surface, and remove references to deleted symbols (`COOKIE_DISMISS_SCRIPT`, old scroll loop, `idcac-playwright`). Verify `CLAUDE.md` project structure section matches the new tree.

## Order

Extraction → crawler → renames → autoconsent fallback → docs sweep.

## Research

FYI only — this prompt is the source of truth. Background evidence:

- [`research-summary.md`](./research-summary.md) — executive summary, target tree, migration plan, risks & license analysis.
- [`research-cookie-dismissal.md`](./research-cookie-dismissal.md) — library comparison (`idcac-playwright` vs `closeCookieModals()` vs Ghostery vs autoconsent), route-blocking pattern, reference `cookies.ts`.
- [`research-crawlee-pattern.md`](./research-crawlee-pattern.md) — actor-scraper layout, `PlaywrightCrawler` patterns (`useSessionPool`, `infiniteScroll`), WCC Ghostery integration.
- [`research-monorepo-structure.md`](./research-monorepo-structure.md) — duplicated symbols audit, three-package split rationale, naming decisions, entry-point examples.
