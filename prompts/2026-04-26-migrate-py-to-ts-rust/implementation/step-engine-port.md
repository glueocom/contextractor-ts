# Step ENGINE_PORT: Port `contextractor_engine` from Python to Rust

## TLDR

Replace `/Users/miroslavsekera/r/contextractor-ts/packages/contextractor_engine/` (currently Python) with a Rust crate wrapping `rs-trafilatura` 0.2.2. Mirror the Python public surface minus dropped fields. Establish the workspace `Cargo.toml` if missing.

## Skills and agents

- `rust`, `async-rust-patterns`, `rust-packaging` — language guidelines.
- `rust-testing-patterns` — engine unit tests.
- `rust-pro` — implementer.

## Inputs

- Python engine: `/Users/miroslavsekera/r/contextractor/packages/contextractor_engine/src/contextractor_engine/{extractor.py,models.py,utils.py,__init__.py}`.
- Field-level mapping: `../migrate-py-to-ts-rust-notes/rs-trafilatura-api.md`.
- Format decision: `../user-entry-log/entry-qa-format-gap.md`.

## Step DELETE_PY: Remove Python sources

- Delete `packages/contextractor_engine/src/contextractor_engine/`, `tests/`, `pyproject.toml`, `dist/`.
- Delete repo-root `pyproject.toml` and `uv.lock` once no remaining target file references them.

## Step CARGO_INIT: Workspace and crate scaffolding

- Add a workspace `Cargo.toml` at the repo root (if absent) listing `packages/contextractor_engine` and the two app crates as members.
- Set workspace edition to 2024, MSRV to a recent stable, and standard lints (`-D warnings`, `clippy::pedantic` minus opinionated lints).
- Create `packages/contextractor_engine/Cargo.toml` with dependency `rs-trafilatura = "0.2"`, plus `serde`, `serde_json`, `thiserror`, `tracing`.
- Create `packages/contextractor_engine/src/lib.rs`.

## Step API_PORT: Public API

Implement these public types in `lib.rs`:

- `OutputFormat` enum with variants `Txt`, `Html`, `Markdown`, `Json` (no XML, no XML-TEI). `#[derive(serde::Deserialize, serde::Serialize)]` with `#[serde(rename_all = "lowercase")]`.
- `ExtractionConfig` struct mirroring the Python `TrafilaturaConfig` minus the dropped fields (`tei_validation`, `prune_xpath`, `with_metadata`, `fast`, `url_blacklist`, `date_extraction_params`). Each field maps to `rs_trafilatura::Options` per the mapping table in `rs-trafilatura-api.md`. `#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]`, `#[serde(rename_all = "camelCase")]`, `#[serde(deny_unknown_fields)]` is **not** set (forward-compat with Apify schema additions).
- `ExtractionResult { content: String, output_format: OutputFormat, metadata: MetadataResult }`.
- `MetadataResult { title, author, date, description, sitename, language: Option<String> }`.
- `ContentExtractor` with `new(config: ExtractionConfig) -> Self`, `extract(html: &str, url: Option<&str>, format: OutputFormat) -> Result<Option<ExtractionResult>, EngineError>`, and `extract_all_formats(html, url, formats: &[OutputFormat]) -> HashMap<OutputFormat, ExtractionResult>`.
- `EngineError` via `thiserror`, wrapping `rs_trafilatura::Error`.

JSON serialiser: when `OutputFormat::Json` is requested, build a JSON object containing the metadata fields plus `content_text` and serialise via `serde_json`.

## Step PRESETS: Config presets

Mirror Python `TrafilaturaConfig.balanced()` / `precision()` / `recall()` as `ExtractionConfig::balanced()` / `precision()` / `recall()`. Defaults are the rs-trafilatura defaults from `rs-trafilatura-api.md` except where the Python balanced default disagrees — when in conflict, **the Python default wins** (the Apify schema and prior README docs already match Python).

## Step UTIL_PORT: utility helpers

Port `to_camel_case` and `normalize_config_keys` to Rust if needed for serde rename interop. Otherwise rely on `#[serde(rename_all = "camelCase")]`.

## Step UNIT_TESTS: Engine tests

Add `#[cfg(test)] mod tests` in `lib.rs` covering:

- `OutputFormat` round-trip via serde JSON.
- `ExtractionConfig::balanced()` defaults match Python expectations (one assertion per non-trivial field).
- `extract` happy path on a small embedded HTML fixture (assert non-empty content, expected title in metadata).
- `extract_all_formats` returns one entry per requested format.

Run `cargo test -p contextractor_engine` and `cargo clippy -p contextractor_engine -- -D warnings` before declaring the step done.

## Step DOC_FALLBACK_FLAG: Crawler architecture choice

Add a top-level doc comment in `lib.rs` recording the crawler-architecture decision per `../migrate-py-to-ts-rust-notes/architecture-decision.md`. The engine itself is crawler-agnostic — this is just provenance for downstream apps.
