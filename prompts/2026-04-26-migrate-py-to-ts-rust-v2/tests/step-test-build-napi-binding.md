# Test step build-napi-binding

## TLDR

Reviews `../implementation/step-build-napi-binding.md`. Verifies the napi-rs crate compiles, passes strict lints, exposes the three `#[napi]` functions, and builds a local `.node`. Auto-fixes drift.

## Inputs

- `../implementation/step-build-napi-binding.md`.
- `../migrate-py-to-ts-rust-v2-notes/rs-trafilatura-0.2.md`.
- `../migrate-py-to-ts-rust-v2-notes/napi-rs-monorepo-prebuilds.md`.
- `../migrate-py-to-ts-rust-v2-notes/v1-lessons-codified.md`.

## Verification

- `cargo build --workspace` succeeds.
- `cargo clippy --workspace --all-targets -- -D warnings` passes; verify `expect_used`, `unwrap_used`, `missing_errors_doc` are denied in `Cargo.toml` and no `#[allow(...)]` blanket overrides exist.
- `cargo test --workspace` passes.
- `pnpm -F @contextractor/engine-native build` produces `*.darwin-arm64.node`, `index.js`, `index.d.ts` at the package root.
- `index.d.ts` exposes `extract`, `extractMetadata`, `extractAllFormats`, `Metadata`, `ExtractionResult`, `TrafilaturaConfig`. The `Result<T>` type is bare (no aliased name leaking into `.d.ts` — see `napi-rs-monorepo-prebuilds.md`).
- The Rust `Options` mapping does not pass `prune_xpath`, `tei_validation`, `with_metadata`, or `date_extraction_params` into rs-trafilatura — they are accepted by the binding but not forwarded.
- `packages/contextractor_engine/` (Python original) is gone.
- `packages/contextractor-engine/PYTHON_API_REFERENCE.md` exists and lists every Python public symbol that the next step ports.

## Auto-fix examples

- A `#[allow(clippy::unwrap_used)]` — replace with proper error handling.
- Aliased `Result` import — change to bare import.
- Missing `extract_metadata` — implement using rs-trafilatura's `extract_with_options` and project the metadata.
- Python original still present — `git rm -r packages/contextractor_engine/`.

## Done when

All checks pass. The crate compiles, lints clean, builds a `.node`, and the Python original is removed.
