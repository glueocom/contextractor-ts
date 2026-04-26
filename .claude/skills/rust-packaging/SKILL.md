---
name: rust-packaging
description: Modern Rust packaging with Cargo.toml, lints config, semver, and crates.io publishing best practices. Use when configuring a new crate, preparing a release, or wiring up CI publishing.
---

# Rust Packaging

How to package a Rust crate for distribution or in-workspace use.

## Cargo.toml (this project's napi-rs crate)

The only Rust crate in this workspace is the napi-rs binding at `packages/contextractor-engine/native/`. It is **not** published to crates.io — it is consumed by the TypeScript engine through `@napi-rs/cli` per-platform prebuilds (`linux-x64-gnu`, `linux-arm64-gnu`, `darwin-arm64`, `darwin-x64`) shipped via npm `optionalDependencies`.

```toml
[package]
name = "contextractor-engine-native"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"
authors = ["Glueo <hello@glueo.com>"]
license = "Apache-2.0"
repository = "https://github.com/glueocom/contextractor-ts"
description = "napi-rs binding for rs-trafilatura, consumed by @contextractor/engine."

[lib]
crate-type = ["cdylib"]

[dependencies]
napi = { version = "2", features = ["napi6"] }
napi-derive = "2"
rs-trafilatura = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[build-dependencies]
napi-build = "2"
```

For a hypothetical pure-library crate (would need its own `[lib]` section without `crate-type = ["cdylib"]`):

```toml
[package]
name = "example-lib"
version = "0.1.0"
edition = "2024"

[lib]
path = "src/lib.rs"
```

## Lints

```toml
[lints.rust]
missing_docs = "warn"
unsafe_code = "forbid"
unused_must_use = "deny"

[lints.clippy]
must_use_candidate = "warn"
needless_pass_by_value = "warn"
unwrap_used = "deny"
expect_used = "deny"
missing_errors_doc = "warn"
```

These can be inherited workspace-wide via `[lints]` `workspace = true` in member crates. **Do not relax `unwrap_used` / `expect_used` to silence napi-rs build errors** — fix the code instead, or convert the panic site to a typed error.

## Semver

- `0.x.y` — bump `x` for breaking changes, `y` for everything else
- `1.0.0+` — bump major for breaking, minor for additive, patch for bug fixes
- Mark public enums `#[non_exhaustive]` if you might add variants
- Mark public structs `#[non_exhaustive]` if you might add fields

## Pre-Publish Check

For **internal-only** crates (the napi-rs binding here is one — it ships through npm prebuilds, not crates.io):

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm -F @contextractor/engine-native build       # produces the .node prebuild
```

For a crates.io-bound crate (not this project):

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace --all-features
cargo publish --dry-run -p <crate-name>
```

## Publishing

This project does **not** publish Rust crates to crates.io. The napi-rs `.node` prebuilds are published as npm packages (`@contextractor/engine-native-{platform}-{arch}`) consumed via `optionalDependencies` from `@contextractor/engine`.

For a hypothetical crates.io-bound crate:

```bash
cargo login    # interactive — accepts CARGO_REGISTRY_TOKEN env var as well
cargo publish -p <crate-name>
```

For workspaces, publish dependent crates first.

## CI Publishing (this project — napi-rs prebuilds)

The CI matrix builds `.node` files for `linux-x64-gnu`, `linux-arm64-gnu`, `darwin-arm64`, `darwin-x64` per the `napi-rs/package-template-pnpm` template, then publishes them as npm packages so the in-image `pnpm install` picks the matching prebuild without a Rust toolchain. See `napi.rs/docs/deep-dive/release` for the canonical pipeline.
