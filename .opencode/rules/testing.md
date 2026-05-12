# Testing Guidelines

## TypeScript

`*.test.ts` next to source, vitest preferred (or `node:test` for zero-dep scripts). Run `pnpm test` from the repo root. HTML fixture-based tests for `@contextractor/extraction` live in `packages/extraction/test/` with fixtures under `packages/extraction/test/fixtures/`. Apps without tests need `vitest run --passWithNoTests` in their `test` script, otherwise the recursive `pnpm test` fails.

## Rust

Unit tests in `#[cfg(test)] mod tests { ... }` next to source in `packages/extraction/native/src/`. Run `cargo test --workspace`. The crate is the only Rust crate in the workspace; `cargo clippy --workspace --all-targets -- -D warnings` keeps strict lints (`expect_used`, `unwrap_used`, `missing_errors_doc`) — fix the code rather than allowing them.
