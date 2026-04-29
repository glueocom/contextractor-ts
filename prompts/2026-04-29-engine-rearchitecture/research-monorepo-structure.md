# Monorepo structure review — contextractor-ts

*Research date: 29 April 2026.*

## Current local layout

```
contextractor-ts/
├── apps/
│   ├── contextractor-apify/         # Apify Actor entry (Actor.init/exit, INPUT_SCHEMA.json)
│   └── contextractor-standalone/    # CLI (commander.js)
├── packages/
│   ├── contextractor-engine/        # trafilatura wrapper + napi-rs Rust crate at ./native
│   └── contextractor-schema/        # zod → INPUT_SCHEMA.json generator
└── tools/
    ├── platform-test-runner/
    └── generated-unit-tests/
```

Toolchain: **pnpm workspaces + Turborepo + Biome + vitest + TS 5.x**, Cargo workspace nested under `packages/contextractor-engine/native`.

### Duplicated symbols (apify ↔ standalone)

| Duplicated symbol | Apify path | Standalone path | Hard dependency |
|---|---|---|---|
| `COOKIE_DISMISS_SCRIPT` | `handler.ts` | `crawler.ts` | none (pure DOM string) |
| infinite-scroll loop | `handler.ts` | `crawler.ts` | Playwright `Page` |
| `buildBrowserLaunchOptions` | `main.ts` | `crawler.ts` | Playwright + Crawlee `BrowserLaunchContext` |
| `PlaywrightCrawler` setup | `main.ts` | `crawler.ts` | `@crawlee/playwright` |
| Per-page request handler | `handler.ts` | `crawler.ts` | Crawlee + engine |
| KVS save helpers | `extraction.ts` | — | `apify` (`Actor.openKeyValueStore`) |
| `computeContentInfo` | `extraction.ts` | (likely standalone too) | none |
| `projectMetadata` | `extraction.ts` | — | none |

## Reference layout #1 — `apify/actor-scraper`

[github.com/apify/actor-scraper](https://github.com/apify/actor-scraper) — Apache-2.0, **`packages/`-only — no `apps/` directory**. Each shippable Actor is a sibling package alongside the shared library. Lerna + Turborepo + npm.

```
packages/
├── actor-scraper/
│   ├── cheerio-scraper/
│   ├── jsdom-scraper/
│   ├── puppeteer-scraper/
│   ├── playwright-scraper/
│   ├── web-scraper/
│   └── website-content-crawler/
└── scraper-tools/                # @apify/scraper-tools — shared
```

Shared = **`@apify/scraper-tools`** — exports `browserTools`, `constants`, `tools`, `createContext`, `CrawlerSetupOptions`, `RequestMetadata`. **A toolkit, not a fully-baked crawler**. Each Actor owns its own `crawler_setup.ts` wiring the toolkit into a concrete `PlaywrightCrawler`/`PuppeteerCrawler`. **"Thin entry + shared toolkit" pattern.**

Naming: short, role-based, no project prefix (`web-scraper`, `puppeteer-scraper`).

## Reference layout #2 — `apify/crawlee`

[github.com/apify/crawlee](https://github.com/apify/crawlee) — root [`package.json`](https://github.com/apify/crawlee/blob/master/package.json) declares `"workspaces": ["packages/*"]`.

| Package | Role |
|---|---|
| [`core`](https://github.com/apify/crawlee/blob/master/packages/core) | runtime primitives (`Configuration`, `EventManager`, `RequestQueue`, `Dataset`, `KeyValueStore` interfaces) |
| `basic-crawler` | `BasicCrawler` — base for browser/cheerio crawlers |
| `browser-crawler` | abstract `BrowserCrawler` — common request-handler shape for Pup/PW |
| `playwright-crawler` | concrete `PlaywrightCrawler` |
| `puppeteer-crawler` | concrete `PuppeteerCrawler` |
| `cheerio-crawler`, `jsdom-crawler`, `linkedom-crawler`, `http-crawler`, `camoufox-crawler` | other crawlers |
| `browser-pool` | browser-instance lifecycle |
| `utils` | shared helpers |
| `types` | shared TS types |
| `memory-storage` | local FS-backed storage client |
| `templates` | starter templates |

**`@crawlee/core` has zero browser dependency**; `@crawlee/playwright` depends on `core` + `browser-crawler` + `browser-pool` + Playwright. Textbook layering: **pure → infra → adapter**. Strongest precedent in this ecosystem for the engine-split decision below.

## Reference layout #3 — Generic Turborepo + pnpm

Authoritative: [Turborepo "Structuring a repository"](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository).

> *"Turborepo does not support nested packages like `apps/**` or `packages/**`… If you'd like to group packages by directory, you can do this using globs like `packages/*` and `packages/group/*`."*

Standard root `package.json`: `{ "private": true, "workspaces": ["apps/*", "packages/*"], "packageManager": "pnpm@..." }`. **`apps/` vs `packages/` is convention, not enforcement.**

- **`apps/*`** → shippable end-user artifacts: services, CLIs, websites, Actors. *Not* published to npm.
- **`packages/*`** → libraries (`@scope/foo`), internal-only or publishable. May depend on each other.
- **`tools/*`** → repo-internal automation. Equally valid to live under `packages/*` with `private: true`.

Internal package strategies ([Turborepo docs](https://turborepo.dev/docs/core-concepts/internal-packages)): **Just-in-Time** (TS source consumed directly), **Compiled** (tsc/bundler output), **Publishable** (npm-ready).

## Single-vs-split engine decision

### Option A — single `@contextractor/engine`

- ✅ Less plumbing; one version to bump; matches current state.
- ❌ Trafilatura/Rust extraction layer ships Crawlee+Playwright as deps — heavyweight for future server consumer.
- ❌ Mixed graph: `extract(html)` user must `npm install crawlee playwright`.
- ❌ npm publish footprint balloons (Playwright = ~100 MB browser binaries on install).

### Option B — split (RECOMMENDED)

```
@contextractor/extraction   # pure HTML → content (trafilatura, Rust napi-rs, metadata, content-info)
@contextractor/crawler      # URL → HTML (Crawlee + Playwright); depends on extraction
@contextractor/apify-runtime  # KVS/Dataset sinks; depends on apify + crawler
```

- ✅ Mirrors **Crawlee's own layering** (`@crawlee/core` pure → `@crawlee/playwright` adapter).
- ✅ Future server consumer with pre-fetched HTML installs **only `@contextractor/extraction`** — no Playwright, no Chromium.
- ✅ Clean dependency graph.
- ✅ Independently versionable; Rust napi-rs stays in `extraction`.
- ❌ Refactor cost: ~1 day of moves + import rewrites.
- ❌ Three `package.json` instead of one.

**Decision: Option B.** The deciding factor is the future "server consumer with pre-fetched HTML" requirement — that consumer must not be forced to download Chromium. Crawlee's own packaging is the proof point.

## Per-piece move-target table

| Duplicated piece | New home | Rationale |
|---|---|---|
| `COOKIE_DISMISS_SCRIPT` (delete) | `packages/crawler/src/browser/cookies.ts` | Replace bespoke string with `@ghostery/adblocker-playwright` (see `research-cookie-dismissal.md`). |
| Infinite-scroll loop | `packages/crawler/src/browser/scroll.ts` | Thin wrapper over Crawlee `infiniteScroll` with project defaults. |
| `buildBrowserLaunchOptions` | `packages/crawler/src/browser/launchOptions.ts` | Returns Crawlee `BrowserLaunchContext`. |
| `PlaywrightCrawler` factory | `packages/crawler/src/createCrawler.ts` | `createContextractorCrawler(opts)` taking a `requestHandler` hook. |
| Per-page handler (cookie → scroll → page.content() → extract → save) | `packages/crawler/src/handler.ts`; `save` step is a `sink` callback | Sink injection keeps `crawler` neutral. Apify provides KVS sink; CLI provides FS sink. |
| KVS save helpers | `packages/apify-runtime/src/kvsSink.ts` | Apify-specific; depends on `apify`. |
| `computeContentInfo` | `packages/extraction/src/contentInfo.ts` | Pure function, no Crawlee. |
| `projectMetadata` | `packages/extraction/src/metadata.ts` | Pure projection over extraction result. |

## Naming review

| Current | Recommended | Reasoning |
|---|---|---|
| `apps/contextractor-apify` | **`apps/apify-actor`** | Drops redundant `contextractor-` prefix; matches apify/actor-scraper convention. |
| `apps/contextractor-standalone` | **`apps/standalone`** | Drops `contextractor-` prefix; keeps the role name. |
| `packages/contextractor-engine` | split → **`@contextractor/extraction`**, **`@contextractor/crawler`**, **`@contextractor/apify-runtime`** | See decision above. |
| `packages/contextractor-schema` | **`packages/schema`** (`@contextractor/schema`) | Drop project prefix; consistent with `extraction` and `crawler`. |

apify/actor-scraper precedent: directories named by role (`cheerio-scraper`, `web-scraper`, `playwright-scraper`, `scraper-tools`) — no project prefix.

## `tools/` directory

`tools/platform-test-runner` and `tools/generated-unit-tests` are internal-only test infra. Keep both in `tools/` — the `tools/*` workspace glob remains in `pnpm-workspace.yaml`.

## Target tree (post-refactor)

```
contextractor-ts/
├── apps/
│   ├── apify-actor/                       # renamed from contextractor-apify
│   │   ├── .actor/
│   │   │   ├── actor.json
│   │   │   └── INPUT_SCHEMA.json          # generated from @contextractor/schema
│   │   ├── src/main.ts                    # ~30 lines: Actor.init → input → createCrawler({sink:kvsSink}) → exit
│   │   ├── Dockerfile
│   │   └── package.json
│   └── standalone/                        # renamed from contextractor-standalone
│       ├── src/cli.ts                     # ~40 lines: argv → createCrawler({sink:fileSink}) → run
│       ├── bin/contextractor              # shebang launcher
│       └── package.json
├── packages/
│   ├── extraction/                        # @contextractor/extraction (pure HTML → content)
│   │   ├── native/                        # Rust napi-rs crate (Cargo workspace member)
│   │   ├── src/
│   │   │   ├── index.ts                   # extract, extractMetadata, extractAllFormats, ContentExtractor, TrafilaturaConfig, normalizeConfigKeys
│   │   │   ├── contentInfo.ts             # computeContentInfo (moved here)
│   │   │   └── metadata.ts                # projectMetadata (moved here)
│   │   └── package.json                   # NO crawlee/playwright deps
│   ├── crawler/                           # @contextractor/crawler (URL → HTML)
│   │   ├── src/
│   │   │   ├── index.ts                   # createContextractorCrawler, types, Sink, fileSink, memorySink
│   │   │   ├── createCrawler.ts           # PlaywrightCrawler factory
│   │   │   ├── handler.ts                 # cookies → scroll → page.content() → extract → sink
│   │   │   ├── browser/
│   │   │   │   ├── cookies.ts             # @ghostery/adblocker-playwright integration
│   │   │   │   ├── scroll.ts              # autoScroll(page, opts) wrapping Crawlee's infiniteScroll
│   │   │   │   └── launchOptions.ts       # buildBrowserLaunchOptions
│   │   │   └── sinks/
│   │   │       ├── memory.ts              # in-memory sink for tests
│   │   │       ├── file.ts                # filesystem sink for the CLI
│   │   │       └── types.ts               # Sink<T> interface
│   │   └── package.json                   # deps: @contextractor/extraction, crawlee, playwright, @ghostery/adblocker-playwright, cross-fetch
│   ├── apify-runtime/                     # @contextractor/apify-runtime (Apify glue)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── kvsSink.ts                 # KVS save helpers as a Sink
│   │   │   └── datasetSink.ts             # Dataset.pushData wrapper
│   │   └── package.json                   # deps: apify, @contextractor/crawler
│   └── schema/                            # @contextractor/schema (zod → INPUT_SCHEMA.json)
├── tools/
│   ├── platform-test-runner/              # private, internal test infra
│   └── generated-unit-tests/              # private, vitest fixtures
├── pnpm-workspace.yaml                    # packages: ["apps/*", "packages/*", "tools/*"]
├── turbo.json
├── tsconfig.base.json
├── biome.json
├── Cargo.toml                             # Rust workspace; member: packages/extraction/native
└── package.json
```

## Example refactored entry points

### `apps/apify-actor/src/main.ts` (~25 LOC)

```ts
import { Actor } from 'apify';
import { createContextractorCrawler } from '@contextractor/crawler';
import { kvsSink } from '@contextractor/apify-runtime';
import { parseInput } from '@contextractor/schema';

await Actor.init();
try {
  const input = parseInput(await Actor.getInput());
  const crawler = await createContextractorCrawler({
    startUrls: input.startUrls,
    crawlerOptions: input.crawlerOptions,
    extractionConfig: input.extraction,
    sink: kvsSink({ dataset: 'default' }),
  });
  await crawler.run();
} finally {
  await Actor.exit();
}
```

### `apps/cli/src/cli.ts` (~35 LOC)

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { createContextractorCrawler, fileSink } from '@contextractor/crawler';
import { readFileSync } from 'node:fs';

const program = new Command();
program
  .name('contextractor')
  .argument('<urls...>', 'URLs to extract')
  .option('-o, --output <dir>', 'output directory', './out')
  .option('--config <path>', 'JSON config file')
  .action(async (urls, opts) => {
    const config = opts.config ? JSON.parse(readFileSync(opts.config, 'utf8')) : {};
    const crawler = await createContextractorCrawler({
      startUrls: urls,
      extractionConfig: config.extraction,
      sink: fileSink({ outDir: opts.output }),
    });
    await crawler.run();
  });

program.parseAsync();
```

Both files **<40 LOC**, **no Playwright import**, no cookie scripts, no scroll logic, no `buildBrowserLaunchOptions`, no save helpers. Pure wiring.
