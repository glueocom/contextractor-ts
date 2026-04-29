# `@contextractor/crawler`

Shared Crawlee + Playwright crawler package for Contextractor.

It owns the browser-facing pieces of the rearchitecture:

- `createContextractorCrawler()` and `buildRequests()`
- Cookie defences via Ghostery and optional autoconsent fallback
- Built-in scrolling via Crawlee `infiniteScroll()`
- Shared sink helpers: `fileSink()`, `memorySink()`, and `Sink<T>`

App-specific sinks stay outside this package:

- `apps/apify-actor/src/` owns the Apify dataset / key-value-store sinks
- `apps/standalone/src/` owns any CLI-only sink composition
