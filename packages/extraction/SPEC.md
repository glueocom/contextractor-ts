# `@contextractor/extraction`

TypeScript content-extraction engine built on `rs-trafilatura` via the napi-rs binding `@contextractor/extraction-native`. Exposes a unified API for extracting main-content text from raw HTML in multiple formats.

## Role

Consumed by `@contextractor/crawler`, which is used by both apps. No Crawlee dependency — pure extraction from HTML strings.

## Key Exports

- `ContentExtractor` — main class
  - `extract(html, opts): ExtractionResult | null`
  - `extractMetadata(html, url): Metadata | null`
  - `extractAllFormats(html, opts): AllFormatsResult`
- `OutputFormat` — `'txt' | 'markdown' | 'json' | 'html'`
- `TrafilaturaConfig` — extraction config interface
- `DEFAULT_CONFIG` — balanced defaults matching `rs-trafilatura`'s balanced factory
- `ExtractionResult`, `Metadata`, `AllFormatsResult` — result types

## Output Formats

`txt | markdown | json | html`. XML and XML-TEI are temporarily unsupported pending upstream `rs-trafilatura` support.

## Native Binding

Located at `packages/extraction/native/` (`crate-type = "cdylib"`). The `@contextractor/extraction-native` package wraps `rs-trafilatura` via napi-rs. Per-platform prebuilds (`darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu`) ship as `optionalDependencies` — no Rust toolchain needed at runtime.

napi-rs auto-converts snake_case Rust struct fields to camelCase in the generated `.d.ts`. The TypeScript `TrafilaturaConfig` interface is canonical; the Rust `#[napi(object)]` struct must mirror it field-for-field.

## Dependencies

- `@contextractor/extraction-native` (workspace)
- Rust: `napi`, `napi-derive`, `rs-trafilatura ^0.2`, `serde`, `serde_json`, `chrono`
