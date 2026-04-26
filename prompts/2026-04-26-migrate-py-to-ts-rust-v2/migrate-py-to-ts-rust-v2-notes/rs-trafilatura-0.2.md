# `rs-trafilatura` 0.2.x integration notes (v2)

Version verified live on 2026-04-26.

- Crate version: **0.2.2** at `Cargo.toml`. Repo: <https://github.com/Murrough-Foley/rs-trafilatura>. Crates.io: <https://crates.io/crates/rs-trafilatura>.
- Public API exported from `lib.rs`:
  - `pub fn extract(html: &str) -> Result<ExtractResult>`
  - `pub fn extract_with_options(html: &str, options: &Options) -> Result<ExtractResult>`
  - `pub fn extract_bytes(html: &[u8]) -> Result<ExtractResult>`
  - `pub fn extract_bytes_with_options(html: &[u8], options: &Options) -> Result<ExtractResult>`
  - `pub use error::{Error, Result};`
  - `pub use options::Options;`
  - `pub use result::{ExtractResult, ImageData, Metadata};`
  - Modules: `page_type`, `scoring`, `markdown`, `encoding`, `spider_integration` (feature-gated).

## Options struct shape (v0.2.x)

`Options` exposes 28 fields per the README. Confirmed present from usage examples and the entry prompt's "lessons" section:

- `include_comments`, `include_tables`, `include_images`, `include_links`
- `favor_precision`, `favor_recall`
- `output_markdown` — defaults to `false`; **must be set per call** to populate `content_markdown`
- `page_type`, `url`

**Confirmed absent** (do not bind in napi-rs wrapper):

- `prune_xpath`
- `tei_validation`
- `with_metadata` (metadata is always extracted on every call)

`content_html` is always populated; no flag controls it. No `xml` or `xml-tei` output format exists at 0.2.x — supported outputs are plain text, HTML, GitHub-flavored Markdown plus a rich `Metadata` struct (title, author, date, description, categories, tags, license, image, page_type).

## Mapping to TS engine config

Entry prompt v2 + `entry-qa-config-field-scope.md`: drop only `pruneXpath` and `dateExtractionParams` from the TS interface; keep `teiValidation` and `withMetadata` as forward-compat no-ops that mirror the Python source.

The napi-rs Rust struct should bind only the `Options` fields that exist in 0.2.x — do not include placeholders for fields the upstream crate lacks.

## Result struct (`ExtractResult`)

Confirmed fields used by callers:

- `content_text`, `content_html`, `content_markdown`
- `metadata: Metadata` — always populated. Includes `title`, `author`, `date`, `description`, `categories`, `tags`, `license`, `image`, `page_type` (broader than the Python `MetadataResult`).
- Image data via `ImageData` (alt, captions).
- Comments (when `include_comments` is true).

The Python `MetadataResult` exposes `title / author / date / description / sitename / language` only. The TS engine should expose the broader rs-trafilatura set; the Apify request handler may project a narrower view to keep the dataset schema stable.

## Pitfall: rs-trafilatura title heuristic

The 0.2.x metadata title heuristic differs from Python `trafilatura` and sometimes returns the meta description. Tests must assert metadata is non-empty / matches a regex, **not** exact string equality.
