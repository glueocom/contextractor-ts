# Step PORT_APIFY_APP: Replace Python actor with Rust binary

## TLDR

Replace `apps/contextractor-apify/src/*.py` with a Rust binary that mirrors the Python actor's behaviour: read Apify input, crawl start URLs, extract content per page, save to KVS, push records to the dataset. The binary uses `chromiumoxide` for browser-based crawling unless a fallback is documented and chosen.

## Skills and agents

- `rust`, `async-rust-patterns`, `apify-actor-development` — primary.
- `apify-schemas` — schema/struct alignment.
- `rust-pro` — implementer.

## Inputs

- Python source: `/Users/miroslavsekera/r/contextractor/apps/contextractor-apify/src/{main.py,handler.py,extraction.py,config.py}`.
- Engine: target `packages/contextractor_engine` (after `step-engine-port.md`).
- Schema: target `apps/contextractor-apify/.actor/input_schema.json` (after `step-propagate-schemas.md`, which may run after this step — coordinate field names against the source schema directly).
- Architecture: `../migrate-py-to-ts-rust-notes/architecture-decision.md`.

## Step DELETE_PY: Remove Python sources

Delete `apps/contextractor-apify/src/`, `apps/contextractor-apify/storage/`, `apps/contextractor-apify/pyproject.toml`, `apps/contextractor-apify/dist/`, `apps/contextractor-apify/.pytest_cache/`, `apps/contextractor-apify/.dockerignore` (rewrite later if needed), `apps/contextractor-apify/.DS_Store`. Keep `apps/contextractor-apify/.actor/` for `step-propagate-schemas.md`.

## Step CARGO_BIN: Add Rust crate

- Create `apps/contextractor-apify/Cargo.toml` with binary target `contextractor-apify`.
- Dependencies: `contextractor_engine = { path = "../../packages/contextractor_engine" }`, `clap`, `tokio`, `chromiumoxide`, `reqwest`, `serde`, `serde_json`, `tracing`, `tracing-subscriber`, `anyhow`, `url`, `globset` (for `globs`/`excludes`/`pseudoUrls`), `regex`.
- Apify SDK: research current Rust SDK availability. If a maintained crate exists, depend on it; otherwise read input from `INPUT.json` in the KVS directory and write outputs via the `apify` CLI's KVS / dataset commands invoked through `tokio::process::Command`. Document the choice at the top of `main.rs`.
- Add `apps/contextractor-apify` to the workspace `Cargo.toml` `members`.

## Step CONFIG_MODULE: Port `config.py` → Rust

Build a `Config` struct deserialised from the Apify input schema. Field names use `#[serde(rename_all = "camelCase")]`. Implement helpers equivalent to `build_browser_context_options`, `build_browser_launch_options`, and `build_crawl_config`.

## Step CRAWLER_MODULE: Crawl loop

Implement an async crawl loop that:

- Takes start URLs, dedupes, enqueues into a request queue (in-memory or via Apify SDK).
- Honours `globs`, `excludes`, `pseudoUrls`, `linkSelector`, `keepUrlFragments`, `respectRobotsTxtFile`, `maxPagesPerCrawl`, `maxResultsPerCrawl`.
- Spawns a chromiumoxide browser with `launcher`, `headless`, `userAgent`, `ignoreCorsAndCsp`, `ignoreSslErrors` honoured.
- Per page: navigates with `waitUntil` semantics, runs the cookie-modal dismissal script (port from Python `handler.py`), scrolls up to `maxScrollHeightPixels`, captures HTML.
- Calls `ContentExtractor::extract_all_formats` for the requested formats.
- Saves outputs to KVS per `saveExtracted{Txt|Html|Json|Markdown}ToKeyValueStore` toggles.
- Pushes a dataset record with URL, content hashes, KVS keys, and metadata.

Drop XML / XML-TEI handling per `../user-entry-log/entry-qa-format-gap.md`.

## Step LIMITS: Resource bounds

- `tokio::time::timeout` on every page navigation (`pageLoadTimeoutSecs`).
- `tokio::sync::Semaphore` to bound concurrent in-flight pages.
- `tracing` logs with no secret bodies; never log `initialCookies` or `customHttpHeaders`.

## Step DOCKER: New Dockerfile

Replace `apps/contextractor-apify/Dockerfile` with a multi-stage build:

- Builder stage: `rust:1.85-slim` (or current stable), `cargo build --release -p contextractor-apify`.
- Runtime stage: an Apify base image that ships Chromium (`apify/actor-node-playwright-chrome` is JS — for Rust use `debian:bookworm-slim` with `chromium` installed manually, or `mcr.microsoft.com/playwright`).
- Copy the binary, set `CMD ["/usr/local/bin/contextractor-apify"]`.
- Update repo-root `Dockerfile` if it is the canonical Actor Dockerfile (verify via `apps/contextractor-apify/.actor/actor.json` `dockerfile` field).

## Step BIN_TESTS: Smoke tests

Under `apps/contextractor-apify/tests/`:

- One integration test that builds the binary and runs it against a recorded HTML fixture, asserting dataset records and KVS keys.
- One test that validates input-schema parsing for a representative `INPUT.json`.

Run `cargo build --release -p contextractor-apify` and `cargo test -p contextractor-apify` before declaring done.
