# Step build-napi-binding

## TLDR

Add `packages/contextractor-engine/native/` Cargo crate with `napi-rs` macros wrapping `rs-trafilatura`. Exposes `extract`, `extractMetadata`, `extractAllFormats` to Node. Produce a darwin-arm64 prebuild for local dev. The TS engine in the next step consumes it via `require('./native/index.node')` (or `@napi-rs/cli`-generated loader).

## Skills and agents

- `rust`, `rust-packaging`, `async-rust-patterns`, `rust-testing-patterns`.
- Agent: `rust-pro` (primary), `web-research-specialist` (only if napi-rs / rs-trafilatura API surfaces something unexpected).

## Inputs

- Read `../migrate-py-to-ts-rust-notes/rs-trafilatura.md` (full API surface and per-platform build matrix).
- Read `../user-entry-log/entry-qa-rust-bridge.md` (napi-rs decision and platform list).
- Read `../user-entry-log/entry-qa-xml-formats.md` (drop xml / xmltei).

## Actions

- Create `packages/contextractor-engine/native/Cargo.toml` with:
  - `[lib] crate-type = ["cdylib"]`
  - deps: `rs-trafilatura = "<latest>"`, `napi = { version = "2", features = ["napi6"] }`, `napi-derive = "2"`, `serde = { version = "1", features = ["derive"] }`.
  - build-deps: `napi-build = "2"`.
  - Cargo lints from `rust` skill.
- Add `packages/contextractor-engine/native/build.rs` calling `napi_build::setup()`.
- Implement `packages/contextractor-engine/native/src/lib.rs`:
  - `#[napi(object)] pub struct TrafilaturaConfig { ... }` mirroring the Python config (snake_case Rust fields, `#[napi]` auto-converts to camelCase on the TS side).
  - `#[napi(object)] pub struct ExtractionResult { content: String, format: String }`.
  - `#[napi(object)] pub struct Metadata { title, author, date, description, sitename, language, ... }`.
  - `#[napi] pub fn extract(html: String, options: ExtractOptions) -> Result<ExtractionResult>`.
  - `#[napi] pub fn extract_metadata(html: String, url: Option<String>) -> Result<Metadata>`.
  - `#[napi] pub fn extract_all_formats(html: String, options: ExtractOptions) -> Result<HashMap<String, ExtractionResult>>` — supported formats limited to `txt`, `markdown`, `json`, `html`.
- Add the napi-rs crate to the root `Cargo.toml` workspace `members` (uncomment / add the entry left out in `step-prepare-workspace`).
- Add `packages/contextractor-engine/native/package.json` with `@napi-rs/cli` triple config (`darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu`) and a `build` script: `napi build --platform --release`.
- Add a minimal `cargo test` in `native/src/lib.rs`: one test calling `extract` on a small HTML string asserting non-empty `content`.
- Run `pnpm -F @contextractor/engine-native build` to emit the local `darwin-arm64` `.node` artifact.

## Constraints

- Do not implement xml / xmltei output.
- Keep the napi-rs API minimal — just the three functions above. Anything else is YAGNI.
- No `unsafe` outside what `#[napi]` macros require.

## Done when

- `cargo build --workspace` succeeds.
- `cargo test --workspace` passes.
- `pnpm -F @contextractor/engine-native build` produces `*.darwin-arm64.node` in the package root.
- The matching `tests/step-test-build-napi-binding.md` passes.
