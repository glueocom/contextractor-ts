---
name: rust-packaging
description: Modern Rust packaging with Cargo.toml, lints config, semver, and crates.io publishing best practices. Use when configuring a new crate, preparing a release, or wiring up CI publishing.
---

# Rust Packaging

How to package a Rust crate for distribution or in-workspace use.

## Cargo.toml

```toml
[package]
name = "contextractor_engine"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"
authors = ["Shortc <hello@shortc.dev>"]
license = "Apache-2.0"
repository = "https://github.com/shortc/contextractor-ts"
homepage = "https://github.com/shortc/contextractor-ts"
documentation = "https://docs.rs/contextractor_engine"
description = "Web content extraction engine wrapping rs-trafilatura."
keywords = ["scraping", "extraction", "trafilatura", "html"]
categories = ["text-processing", "web-programming"]
readme = "README.md"

[lib]
name = "contextractor_engine"
path = "src/lib.rs"

[dependencies]
serde = { version = "1", features = ["derive"] }
thiserror = "1"

[dev-dependencies]
insta = "1"
```

For a binary crate, add a `[[bin]]` section:

```toml
[[bin]]
name = "contextractor"
path = "src/main.rs"
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
unwrap_used = "warn"
expect_used = "warn"
```

These can be inherited workspace-wide via `[lints]` `workspace = true` in member crates.

## Semver

- `0.x.y` — bump `x` for breaking changes, `y` for everything else
- `1.0.0+` — bump major for breaking, minor for additive, patch for bug fixes
- Mark public enums `#[non_exhaustive]` if you might add variants
- Mark public structs `#[non_exhaustive]` if you might add fields

## Pre-Publish Check

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace --all-features
cargo publish --dry-run -p contextractor_engine
```

## Publishing

```bash
cargo login    # interactive — accepts CARGO_REGISTRY_TOKEN env var as well
cargo publish -p contextractor_engine
```

For workspaces, publish dependent crates first.

## CI Publishing

GitHub Actions release-on-tag pattern:

```yaml
name: publish
on:
  push:
    tags: ["v*"]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo publish -p contextractor_engine --token ${{ secrets.CARGO_REGISTRY_TOKEN }}
```
