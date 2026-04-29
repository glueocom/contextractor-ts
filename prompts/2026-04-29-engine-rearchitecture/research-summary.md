# Contextractor-ts rearchitecture — executive summary

*Research date: 29 April 2026. See `research-cookie-dismissal.md`, `research-crawlee-pattern.md`, `research-monorepo-structure.md` for details.*

## TL;DR

The two `apps/` entries currently re-implement the same Playwright crawler. **Consolidate into `packages/`, but split the engine into three packages** (`@contextractor/extraction`, `@contextractor/crawler`, `@contextractor/apify-runtime`) — mirroring how [`apify/crawlee`](https://github.com/apify/crawlee) is layered. Replace the bespoke `COOKIE_DISMISS_SCRIPT` with **`@ghostery/adblocker-playwright`** (MPL-2.0) — what Apify's own Website Content Crawler migrated to in December 2025. Rename `apps/contextractor-apify` → `apps/apify-actor`, `apps/contextractor-standalone` → `apps/standalone`. The two app entry points shrink to <40-line wrappers.

## Final recommendations

- **Engine packaging**: **split** into `@contextractor/extraction` (pure, no Crawlee/Playwright), `@contextractor/crawler` (Crawlee + Playwright + Ghostery, depends on extraction), `@contextractor/apify-runtime` (Apify SDK glue, sink implementations). Mirrors Crawlee's `core` ↔ `playwright-crawler` split.
- **Cookie dismissal — primary**: **[`@ghostery/adblocker-playwright`](https://www.npmjs.com/package/@ghostery/adblocker-playwright)** (MPL-2.0, v2.14.x, last commit 28 Apr 2026). Drives EasyList Cookie + Annoyances filterlists; Apify Website Content Crawler's choice since Dec 2025 ([Apify blog](https://blog.apify.com/how-to-block-cookie-modals/)). **Drop `idcac-playwright` (GPL-3.0, [LICENSE](https://github.com/apify/idcac/blob/master/LICENSE))** — incompatible with shipping a closed CLI on npm + upstream IDCAC dead since Nov 2023.
- **Cookie dismissal — fallback**: **[`@duckduckgo/autoconsent`](https://www.npmjs.com/package/@duckduckgo/autoconsent)** (MPL-2.0, v14.59.0 March 2026), lazy-loaded for sites needing a real Reject-All click flow.
- **Apps naming**: `apps/apify-actor`, `apps/standalone` (drops `contextractor-` prefix; matches apify/actor-scraper convention).
- **Packages naming**: `@contextractor/extraction`, `@contextractor/crawler`, `@contextractor/apify-runtime`, `@contextractor/schema`.
- **Tools dir**: keep `tools/platform-test-runner` and `tools/generated-unit-tests` in `tools/`.
- **Sink injection pattern**: crawler accepts `sink: (result) => Promise<void>`. Apify app injects KVS/Dataset sink; CLI injects file sink; tests inject memory sink. Keeps `@contextractor/crawler` 100% Apify-free.
- **Crawlee defaults to mirror from playwright-scraper**: `useSessionPool: true`, `persistCookiesPerSession: true`, use `crawlingContext.infiniteScroll({ maxScrollHeight, scrollDownAndUp, buttonSelector, stopScrollCallback })` instead of manual `scrollBy(0, 500)`.

## Canonical target tree

```
contextractor-ts/
├── apps/
│   ├── apify-actor/        # main.ts ≤30 LOC, .actor/, Dockerfile
│   └── standalone/         # cli.ts ≤40 LOC, bin/contextractor
├── packages/
│   ├── extraction/         # @contextractor/extraction — pure (trafilatura wrapper + Rust napi-rs at ./native)
│   ├── crawler/            # @contextractor/crawler — Crawlee/Playwright orchestration; depends on extraction
│   ├── apify-runtime/      # @contextractor/apify-runtime — KVS / Dataset sinks; depends on apify + crawler
│   └── schema/             # @contextractor/schema — zod → INPUT_SCHEMA.json
├── tools/
│   ├── platform-test-runner/   # private, internal test infra
│   └── generated-unit-tests/   # private, vitest fixtures
├── Cargo.toml              # Rust workspace; member: packages/extraction/native
├── pnpm-workspace.yaml     # packages: ["apps/*", "packages/*", "tools/*"]
├── turbo.json
├── tsconfig.base.json
└── biome.json
```

## Public API surface

### `@contextractor/extraction`

```ts
export interface TrafilaturaConfig { /* … */ }
export function normalizeConfigKeys(config: Partial<TrafilaturaConfig>): TrafilaturaConfig;
export function extract(html: string, config?: TrafilaturaConfig): Promise<string>;
export function extractMetadata(html: string, config?: TrafilaturaConfig): Promise<Metadata>;
export function extractAllFormats(html: string, config?: TrafilaturaConfig): Promise<{
  text: string; markdown: string; html: string; xml: string; metadata: Metadata;
}>;
export class ContentExtractor {
  constructor(config?: TrafilaturaConfig);
  extract(html: string): Promise<ExtractionResult>;
}
export interface ContentInfo { wordCount: number; charCount: number; language?: string; /* … */ }
export function computeContentInfo(text: string): ContentInfo;
export interface ProjectedMetadata { url: string; title?: string; author?: string; date?: string; /* … */ }
export function projectMetadata(meta: Metadata): ProjectedMetadata;
```

### `@contextractor/crawler`

```ts
export type Sink<T> = (result: T) => Promise<void>;

export interface ContextractorCrawlerOptions {
  startUrls: Array<string | { url: string; userData?: unknown }>;
  extractionConfig?: TrafilaturaConfig;
  crawlerOptions?: PlaywrightCrawlerOptions;
  sink: Sink<ExtractionResult>;
  cookieStrategy?: 'ghostery' | 'autoconsent' | 'none';   // default 'ghostery'
  scroll?: { enabled: boolean; maxScrollHeight?: number; waitForSecs?: number; scrollDownAndUp?: boolean };
  sessionPool?: boolean | SessionPoolOptions;             // default true
}

export function createContextractorCrawler(opts: ContextractorCrawlerOptions): Promise<PlaywrightCrawler>;
export function autoScroll(page: Page, opts?: InfiniteScrollOptions): Promise<void>;
export function buildBrowserLaunchOptions(overrides?: BrowserLaunchContext): BrowserLaunchContext;

// Cookie-dismissal helpers
export function installCookieDefences(page: Page): Promise<void>;
export function rejectViaAutoconsent(page: Page): Promise<{ cmp?: string; success: boolean }>;
export function preAcceptCookies(context: BrowserContext, hostname: string): Promise<void>;

// Built-in sinks
export function fileSink(opts: { outDir: string }): Sink<ExtractionResult>;
export function memorySink(): Sink<ExtractionResult> & { results: ExtractionResult[] };
```

### `@contextractor/apify-runtime`

```ts
export function kvsSink(opts: { store?: string; keyFn?: (r: ExtractionResult) => string }): Sink<ExtractionResult>;
export function datasetSink(opts?: { dataset?: string }): Sink<ExtractionResult>;
```

### `@contextractor/schema` (unchanged)

```ts
export const InputSchema: z.ZodSchema<Input>;
export function parseInput(raw: unknown): Input;
export function generateApifyInputSchema(): ApifyInputSchemaJson;
```

## Migration steps (priority order)

1. **Week 1 — extract pure layer first** (lowest risk).
   - Create `packages/extraction/` by copying `packages/contextractor-engine/` minus any Crawlee imports.
   - Move `computeContentInfo` and `projectMetadata` from `apps/contextractor-apify/src/extraction.ts` into `packages/extraction/src/`.
   - Update both apps to import from `@contextractor/extraction`. Run vitest. Ship.
2. **Week 1–2 — carve out `@contextractor/crawler`**.
   - Move scroll, `buildBrowserLaunchOptions`, `PlaywrightCrawler` factory, request handler into `packages/crawler/src/`.
   - **Replace** `COOKIE_DISMISS_SCRIPT` with `@ghostery/adblocker-playwright` integration (`packages/crawler/src/browser/cookies.ts`).
   - Define `Sink<T>` interface; apps pass an inline sink for now.
   - Apps drop their `crawler.ts`/`handler.ts`/`main.ts` Playwright code.
3. **Week 2 — add `@contextractor/apify-runtime`**.
   - Pull KVS save helpers out of `apps/contextractor-apify/src/extraction.ts` into `packages/apify-runtime/src/kvsSink.ts`.
   - Apify app's `main.ts` shrinks to ~25 LOC.
4. **Week 2 — rename apps**.
   - `apps/contextractor-apify` → `apps/apify-actor`; `apps/contextractor-standalone` → `apps/standalone`.
   - Update `pnpm-workspace.yaml`, Apify `actor.json` git path, CI, README.
5. **Week 3** — add `@duckduckgo/autoconsent` lazy fallback for sites needing real opt-out clicks.
6. **Later (can wait)** — publish `@contextractor/extraction` to npm if the server-consumer use case materializes. Other packages can stay private workspace packages indefinitely.

## Risks & tradeoffs

| Decision | Risk | Mitigation |
|---|---|---|
| Split engine into 3 packages | More `package.json` files; more version bumps | Use Changesets or Turborepo's release flow; pin internal deps with `workspace:*` |
| Sink injection pattern | Slightly more abstraction in `@contextractor/crawler` API | Provide ready-made sinks (`fileSink`, `memorySink`) in crawler; `kvsSink`/`datasetSink` in apify-runtime |
| Rename apps directories | Stale Apify Actor git URLs in Apify Console | Update Apify Actor's git path config in Console at the same commit |
| Keep Rust napi-rs in `packages/extraction/native` | Cargo workspace member path changes | Update `Cargo.toml` workspace members; CI native build script |
| `@ghostery/adblocker-playwright` (MPL-2.0) | File-level weak copyleft on the package's own files | Don't fork; use as a regular dependency. Consumer code is unaffected. |
| Replacing `COOKIE_DISMISS_SCRIPT` with Ghostery | Filter list cold-start (~5 MB download) at first run | Cache serialized engine to `.cache/adblock-engine.bin`; warm in CI; ~10× faster cold start |
| Default `useSessionPool: true` | Leaks Crawlee `Session`/`CookieJar` types into engine API | Hide behind a `sessionPool: boolean \| SessionPoolOptions` flag; default true for browser, false for HTTP-only |

## License analysis

### `@ghostery/adblocker-playwright` — MPL-2.0 ✅

[npm](https://www.npmjs.com/package/@ghostery/adblocker-playwright) declares MPL-2.0; per-file headers visible at [src/index.ts](https://github.com/ghostery/adblocker/blob/master/packages/adblocker-playwright/src/index.ts).

**MPL-2.0 is file-level weak copyleft.** Per the [Mozilla MPL-2.0 FAQ](https://www.mozilla.org/MPL/2.0/FAQ/):
- **Does MPL-2.0 require my code to be MPL?** No. MPL is per-file. Only the original MPL-licensed files (and modifications to those files) must remain under MPL when distributed. Code in *other* files in the same project — including code that imports/links to MPL files — can be under any compatible license, including proprietary/closed.
- **Can I ship MPL code in an npm package or Apify Actor?** Yes. Distributing as an unmodified dependency is a normal redistribution scenario.
- **Practical**: keep the LICENSE intact in redistributed copies (npm publish does this automatically); if you *modify* MPL source files, modified files must remain MPL with source available; you don't need to publish your own crawler/extraction code under MPL.

**Conclusion: SAFE** to ship in `@contextractor/crawler` (npm) and the Apify Actor's Docker image.

### `idcac-playwright` — GPL-3.0 ❌

[github.com/apify/idcac/blob/master/LICENSE](https://github.com/apify/idcac/blob/master/LICENSE) shows **GPL-3.0**. Strong copyleft — any project that links/distributes GPL-3.0 code may need to release the larger work under GPL-3.0. **Material risk for the standalone CLI on npm.**

> Snyk advisor occasionally shows ISC due to historical metadata; trust the LICENSE file in the GitHub repo. The Crawlee `closeCookieModals()` docs explicitly cite this licensing issue as the reason `idcac-playwright` is not bundled by default.

**Conclusion: AVOID.**

### `@duckduckgo/autoconsent` — MPL-2.0 ✅

[npm metadata](https://www.npmjs.com/package/@duckduckgo/autoconsent) and [package.json](https://github.com/duckduckgo/autoconsent/blob/main/package.json) declare MPL-2.0. Same analysis as Ghostery. Depends on `@ghostery/adblocker` (MPL-2.0) and `tldts-experimental` (MIT).

**Conclusion: SAFE** to ship.

### Bottom line

All three of (`@ghostery/adblocker-playwright` MPL-2.0, `@duckduckgo/autoconsent` MPL-2.0, `cross-fetch` MIT) can be combined and shipped in:
- `@contextractor/crawler` published to npm — ✅
- the Apify Actor Docker image — ✅
- a closed-source server consumer — ✅

…with no copyleft obligations on your own source code, provided you do not modify the MPL-licensed files themselves. **Avoid `idcac-playwright` (GPL-3.0).** Keep all MPL LICENSE files untouched in published artifacts (npm and Docker do this by default).
