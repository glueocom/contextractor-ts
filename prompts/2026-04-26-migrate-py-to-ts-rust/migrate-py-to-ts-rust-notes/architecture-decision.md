# Architecture — Rust binary Apify Actor with TS tooling

## Decision

Defer to the existing `CLAUDE.md` and `.claude/commands/sync/*.md` declarations:

- `apps/contextractor-apify/` — Rust binary as the Apify Actor entrypoint. CLI flags via `clap`. Crawls and extracts inside the binary.
- `apps/contextractor-standalone/` — Rust CLI binary. No Apify dependency. npm-distributable via a thin `npm/` wrapper that ships the prebuilt platform binaries (mirroring the Python repo's `apps/contextractor-standalone/npm/` pattern).
- `packages/contextractor_engine/` — Rust library wrapping `rs-trafilatura`. Public surface: `ExtractionConfig` (mirrors Python `TrafilaturaConfig` minus the dropped fields), `ContentExtractor`, `OutputFormat` enum (`Txt | Html | Markdown | Json`), `ExtractionResult`, `MetadataResult`.
- `tools/platform-test-runner/` — TypeScript test orchestrator (kept).
- `tools/generated-unit-tests/` — Rust integration tests with HTML fixtures (Cargo, not pytest).

## Crawler choice for the Apify Actor

The Python source uses Crawlee + Playwright. Rust has no 1:1 Crawlee port. Two viable approaches inside the Rust binary:

1. **`chromiumoxide`** (CDP client) for browser-based crawling — closest to Playwright semantics; required if the Actor must execute JS, dismiss cookie modals, scroll, etc.
2. **`reqwest` + custom HTML parsing** for static fetch — much simpler; loses JS execution, cookie modal handling, scroll, navigation `waitUntil` semantics.

The implementation prompt picks `chromiumoxide` because the source schema exposes `closeCookieModals`, `maxScrollHeightPixels`, `waitUntil`, `launcher`, and `headless` toggles — all of which require a real browser. If the implementer hits a chromiumoxide blocker, the fallback is to keep the TS Crawlee/Playwright orchestration in `apps/contextractor-apify/` and have it shell out to a pure-extraction Rust binary; this fallback is documented in `step-engine-port.md`.

## Format/config field reduction

Per `entry-qa-format-gap.md`:

- Drop `xml` and `xmltei` from `OutputFormat` and from the Apify schema (`saveExtractedXmlToKeyValueStore`, `saveExtractedXmlTeiToKeyValueStore`).
- Drop `tei_validation` and `prune_xpath` from the engine config.
- Drop `with_metadata` (always populated in `ExtractResult.metadata`).
- Drop `fast` and `url_blacklist` and `date_extraction_params` (no rs-trafilatura equivalent; surface as a TODO in the engine README).

## Inter-language boundaries

- Schemas (`apps/contextractor-apify/.actor/input_schema.json`) are the JSON contract. Apify converts schema input to env vars / KV-store input; the Rust binary reads via the Apify Rust SDK if available, else via stdin / env. (Current Rust Apify SDK availability is a research item the implementer must confirm.)
- TypeScript test runner reads the same schema's defaults to build canonical fixtures; zod schemas in `tools/platform-test-runner/src/` mirror the Rust engine config.

## Open implementer choices flagged inside `step-engine-port.md`

- chromiumoxide vs TS-side Playwright orchestration.
- Apify Rust SDK readiness vs. shelling out to `apify` CLI for input/output.
