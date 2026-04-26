# Step build-napi-binding

## TLDR

Replace the napi-rs stub crate from `step-prepare-workspace` with the real `rs-trafilatura` 0.2.x wrapper. Expose `extract`, `extractMetadata`, `extractAllFormats` to Node. Build a local `darwin-arm64` `.node` for development. Delete the Python `packages/contextractor_engine/` original — its API surface is mirrored in the next step (`step-port-engine-to-ts`).

## Skills and Agents

- Skills: `rust`, `rust-packaging`, `rust-testing-patterns`, `async-rust-patterns` (only if any wrapper path becomes async).
- Agents: `rust-pro` (primary), `web-research-specialist` (fallback for unexpected napi-rs / rs-trafilatura behavior), `code-reviewer` (diff).

## Reference reading

- `../migrate-py-to-ts-rust-v2-notes/rs-trafilatura-0.2.md` (full v0.2.2 API surface, what fields the `Options` struct does and does not have).
- `../migrate-py-to-ts-rust-v2-notes/napi-rs-monorepo-prebuilds.md` (layout, `Result<T>` pitfall, `exactOptionalPropertyTypes` pitfall).
- `../migrate-py-to-ts-rust-v2-notes/v1-lessons-codified.md` (strict Cargo lints; `expect_used` / `unwrap_used` / `missing_errors_doc` denied).
- `../user-entry-log/entry-qa-config-field-scope.md` (drop only `pruneXpath` and `dateExtractionParams`).
- Source: `/Users/miroslavsekera/r/contextractor/packages/contextractor_engine/src/contextractor_engine/{models.py, extractor.py}` for the API to mirror.

## Actions

### Capture the Python API surface before deleting

- Extract a one-page `PYTHON_API_REFERENCE.md` next to `packages/contextractor_engine/` listing every public method, every `TrafilaturaConfig` field with its default and type, and every `MetadataResult` field. The next step uses this as the single source for the TS port.
- Commit this reference file in the same commit as the deletion below so reviewers can cross-check.

### Replace the stub with the real Cargo crate

- `packages/contextractor-engine/native/Cargo.toml`:
  - `[package]` with `name = "contextractor-engine-native"`, the workspace version, `edition = "2024"`.
  - `[lib] crate-type = ["cdylib"]`.
  - Deps: `rs-trafilatura = "0.2"`, `napi = { version = "2", features = ["napi6"] }`, `napi-derive = "2"`, `serde = { version = "1", features = ["derive"] }`.
  - Build deps: `napi-build = "2"`.
  - `[lints.rust]` and `[lints.clippy]` set as denied: `expect_used`, `unwrap_used`, `missing_errors_doc`, plus the standard set from the `rust` skill. Fix every site that triggers them — do not allow.
- `packages/contextractor-engine/native/build.rs`: `fn main() { napi_build::setup(); }`.
- `packages/contextractor-engine/native/src/lib.rs`:
  - `#[napi(object)] pub struct TrafilaturaConfig` mirroring the Python dataclass field-by-field with snake_case Rust fields (napi-derive auto-converts to camelCase on the TS side). Drop `prune_xpath` and `date_extraction_params` — they have no rs-trafilatura backing. Keep `tei_validation` and `with_metadata` as forward-compat fields the binding accepts but does not pass into rs-trafilatura.
  - `#[napi(object)] pub struct ExtractionResult { pub content: String, pub format: String }`.
  - `#[napi(object)] pub struct Metadata` exposing every field rs-trafilatura's `Metadata` provides: `title`, `author`, `date`, `description`, `sitename`, `language`, `categories`, `tags`, `license`, `image`, `page_type`. All `Option<String>` / `Option<Vec<String>>`.
  - `#[napi] pub fn extract(html: String, options: ExtractOptions) -> Result<ExtractionResult>` — uses `rs_trafilatura::extract_with_options`. Returns errors via `napi::Error::from_reason`.
  - `#[napi] pub fn extract_metadata(html: String, url: Option<String>) -> Result<Metadata>` — calls `extract_with_options` and projects only the metadata.
  - `#[napi] pub fn extract_all_formats(html: String, options: ExtractOptions) -> Result<HashMap<String, ExtractionResult>>` — supported keys limited to `txt`, `markdown`, `json`, `html`. Set `output_markdown = true` on the rs-trafilatura `Options` when generating the `markdown` value.
  - Use the **bare** `napi::bindgen_prelude::Result<T>` everywhere. **Do not** alias it (`use ... as MyResult` produces broken `.d.ts`). See `napi-rs-monorepo-prebuilds.md`.
- `packages/contextractor-engine/native/package.json`:
  - `"name": "@contextractor/engine-native"`, private workspace package.
  - `"napi"` block with `name = "contextractor-engine-native"`, `triples = ["x86_64-apple-darwin", "aarch64-apple-darwin", "x86_64-unknown-linux-gnu", "aarch64-unknown-linux-gnu"]` (canonical napi-rs targets corresponding to `darwin-x64`, `darwin-arm64`, `linux-x64-gnu`, `linux-arm64-gnu`).
  - Scripts: `"build": "napi build --platform --release"`, `"build:debug": "napi build --platform"`.
  - `optionalDependencies` block left empty here — the prebuild step populates it.
- Add a `#[cfg(test)] mod tests` block in `lib.rs` with one Rust unit test calling `extract` on a small HTML literal and asserting the resulting `content` is non-empty and contains a substring from the input.

### Local prebuild

- `pnpm -F @contextractor/engine-native build` → produces `contextractor-engine-native.darwin-arm64.node` plus `index.js` + `index.d.ts` at the package root.
- The generated `index.js` and `index.d.ts` should be committed (they are the loader). Add `*.node` to `.gitignore` for this directory only — the cross-platform prebuilds in `npm/<platform>/` are committed there in the next step, but the package-root `.node` is a local-build artifact.

### Delete the Python original

- `git rm -r packages/contextractor_engine/` — the Python lib is replaced by the new TS engine plus this Rust crate.
- Delete the `PYTHON_API_REFERENCE.md` only after `step-port-engine-to-ts` is complete and passes.

## Constraints

- Do not introduce `xml` or `xmltei` output anywhere.
- Do not add `prune_xpath` or `date_extraction_params` to the Rust struct — they have no rs-trafilatura backing.
- Keep the napi-rs API surface to the three `#[napi]` functions above. Anything else is YAGNI.
- No `unsafe` outside what `#[napi]` macros require.
- Do not allow strict Cargo lints — fix the code so they pass.

## Done when

- `cargo build --workspace` succeeds.
- `cargo clippy --workspace --all-targets -- -D warnings` passes with `expect_used`, `unwrap_used`, `missing_errors_doc` denied.
- `cargo test --workspace` passes.
- `pnpm -F @contextractor/engine-native build` produces `*.darwin-arm64.node` plus `index.js` and `index.d.ts` at the package root.
- `packages/contextractor_engine/` no longer exists; `packages/contextractor-engine/PYTHON_API_REFERENCE.md` exists and lists every Python public symbol.
- The matching `../tests/step-test-build-napi-binding.md` passes.
