# Test — build-napi-binding

## TLDR

Review the diff from `implementation/step-build-napi-binding.md`. Verify the napi-rs crate compiles, exposes the agreed three functions, and produces a darwin-arm64 prebuild. Auto-fix any deviation.

## Inputs

- `../implementation/step-build-napi-binding.md`
- `../migrate-py-to-ts-rust-notes/rs-trafilatura.md`
- `../user-entry-log/entry-qa-rust-bridge.md`
- `../user-entry-log/entry-qa-xml-formats.md`

## Review

- `packages/contextractor-engine/native/{Cargo.toml, build.rs, src/lib.rs, package.json}` exist.
- `Cargo.toml`: `crate-type = ["cdylib"]`; deps `rs-trafilatura`, `napi`, `napi-derive`, `napi-build`; lints from the `rust` skill applied.
- `src/lib.rs` exports `extract`, `extract_metadata`, `extract_all_formats` (Rust naming; napi-rs converts to camelCase on the JS side).
- `extract_all_formats` only handles `txt`, `markdown`, `json`, `html` — no `xml`, no `xmltei`. Must error or return empty for any unknown format.
- The crate is a member of the root `Cargo.toml` workspace.
- Agent: delegate the Rust-specific checks to `rust-pro` (lints, idiom, error handling, no `unsafe` outside macro requirements).

## Verify

- `cargo build --workspace` exits 0.
- `cargo test --workspace` passes the smoke test in `native/src/lib.rs`.
- `cargo clippy --workspace --all-targets -- -D warnings` exits 0.
- `pnpm -F @contextractor/engine-native build` produces `*.darwin-arm64.node`.
- `grep -ri 'xml\\|xmltei' packages/contextractor-engine/native/src/` returns nothing.

## Auto-fix

Use `rust-pro` to address clippy warnings or test failures with the smallest possible patch. Rerun the suite after each fix.
