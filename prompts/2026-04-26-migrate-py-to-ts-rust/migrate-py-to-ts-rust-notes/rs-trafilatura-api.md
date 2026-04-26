# rs-trafilatura 0.2.2 — API surface and gaps vs Python Trafilatura

## Crate metadata

- Name: `rs-trafilatura`, version 0.2.2 on crates.io.
- Author: Murrough-Foley (port author).
- Cargo: `rs-trafilatura = "0.2"`.
- Docs: https://docs.rs/rs-trafilatura/0.2.2/
- Source: https://github.com/Murrough-Foley/rs-trafilatura

## Public API

Library entry points:

- `extract(html: &str) -> Result<ExtractResult>`
- `extract_with_options(html: &str, options: &Options) -> Result<ExtractResult>`
- `extract_bytes(html: &[u8]) -> Result<ExtractResult>` — handles unknown encodings.

Result struct (`ExtractResult`):

- `metadata: Metadata` (title, author, date, sitename, language, description, etc.).
- `content_text: String` (always present).
- `content_html: Option<String>`.
- `content_markdown: Option<String>` (only when `Options::output_markdown == true`).
- Image entries via `ImageData`.

Bundled binary (under `[[bin]]`): `extract_stdin` — reads HTML from stdin, prints JSON; supports `--url <U>` and `--page-type <T>`.

## `Options` fields (verbatim from docs.rs)

| Field | Type | Default |
|---|---|---|
| `include_comments` | `bool` | `false` |
| `include_tables` | `bool` | `true` |
| `include_images` | `bool` | `false` |
| `include_links` | `bool` | `false` |
| `favor_precision` | `bool` | `false` |
| `favor_recall` | `bool` | `false` |
| `target_language` | `Option<String>` | `None` |
| `url` | `Option<String>` | `None` |
| `author_blacklist` | `Option<Vec<String>>` | `None` |
| `deduplicate` | `bool` | `false` |
| `min_extracted_size` | `usize` | `200` |
| `min_extracted_len` | `usize` | `200` |
| `max_extracted_len` | `usize` | `1000000` |
| `min_output_size` | `usize` | `50` |
| `min_output_comm_size` | `usize` | `10` |
| `min_score` | `usize` | `1000` |
| `max_duplicate_ratio` | `f64` | `0.5` |
| `max_link_density` | `f64` | `0.8` |
| `min_paragraph_cluster` | `usize` | `3` |
| `include_formatting` | `bool` | `false` |
| `only_with_metadata` | `bool` | `false` |
| `max_tree_depth` | `usize` | `100` |
| `min_word_length` | `usize` | `2` |
| `use_fallback_extraction` | `bool` | `true` |
| `dedup_cache_size` | `usize` | `1000` |
| `include_title_in_content` | `bool` | `false` |
| `output_markdown` | `bool` | `false` |
| `page_type` | `Option<PageType>` | `None` |

## Gaps vs Python `trafilatura.extract()`

| Python option | rs-trafilatura | Action |
|---|---|---|
| `output_format="xml"` | not supported | drop from schema (per QA decision) |
| `output_format="xmltei"` | not supported | drop from schema (per QA decision) |
| `output_format="json"` | not natively; serialise `ExtractResult` to JSON in our crate | implement JSON serialiser in `contextractor_engine` |
| `output_format="markdown"` | `Options::output_markdown = true` | map directly |
| `output_format="txt"` | default `content_text` | map directly |
| `output_format="html"` | optional `content_html` | gate behind a flag, default off |
| `tei_validation` | not applicable (XML-TEI dropped) | remove field |
| `prune_xpath` | not in `Options` | remove field, document as not supported |
| `with_metadata` | always populated in `ExtractResult.metadata` | remove field, metadata is always present |
| `fast` | no equivalent flag | drop or alias to `use_fallback_extraction = false` |
| `url_blacklist` | not in `Options` | drop |
| `date_extraction_params` | not in `Options` | drop |

## Python config field → rs-trafilatura `Options` map

| Python `TrafilaturaConfig` | rs-trafilatura `Options` |
|---|---|
| `favor_precision` | `favor_precision` |
| `favor_recall` | `favor_recall` |
| `include_comments` | `include_comments` |
| `include_tables` | `include_tables` |
| `include_images` | `include_images` |
| `include_formatting` | `include_formatting` |
| `include_links` | `include_links` |
| `deduplicate` | `deduplicate` |
| `target_language` | `target_language` |
| `with_metadata` | (always present, drop) |
| `only_with_metadata` | `only_with_metadata` |
| `tei_validation` | (drop, XML-TEI dropped) |
| `prune_xpath` | (drop, no equivalent) |
| `author_blacklist` | `author_blacklist` |
| `url_blacklist` | (drop, no equivalent) |
| `fast` | (drop or alias `use_fallback_extraction = false`) |

The `contextractor_engine` Rust crate must own the JSON serialiser for `ExtractResult` and a `OutputFormat` enum: `Txt | Html | Markdown | Json`.
