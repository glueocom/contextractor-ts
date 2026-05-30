# `@contextractor/crawler`

Shared Crawlee + Playwright crawler package for Contextractor.

Built on [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura)
(extraction) and [Crawlee](https://crawlee.dev/) (TypeScript crawler driving
Playwright).

It owns the browser-facing pieces of the re-architecture:

- `createContextractorCrawler()` and `buildRequests()`
- Cookie defences via Ghostery and optional autoconsent fallback
- Built-in scrolling via Crawlee `infiniteScroll()`
- Shared sink core: `memorySink()`, `Sink<T>`, and the storage helpers
  (`kvsKey`, `buildSuccessRecord` / `buildFailedRecord` / `buildSkippedRecord`,
  `ContentRef` / `KvsLike`) that assemble dataset records and derive KVS keys

Both the Apify Actor and the standalone CLI/lib are thin wrappers over the
shared storage core, so their dataset and key-value-store output is identical:

- `apps/apify-actor/src/` wires the Apify dataset / key-value store to the core
- `apps/standalone/src/` wires the Crawlee dataset / key-value store to the core
