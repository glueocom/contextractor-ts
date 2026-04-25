# Cargo Workspace

Layout and dependency management for the Contextractor cargo workspace at `/Users/miroslavsekera/r/contextractor-ts/`.

## Layout

```
/Users/miroslavsekera/r/contextractor-ts/
├── Cargo.toml                     # workspace root
├── Cargo.lock                     # committed (binary workspace)
├── apps/
│   └── contextractor/
│       ├── Cargo.toml
│       └── src/main.rs
└── packages/
    └── contextractor_engine/
        ├── Cargo.toml
        └── src/lib.rs
```

## Workspace `Cargo.toml`

```toml
[workspace]
resolver = "3"
members = ["apps/contextractor", "packages/contextractor_engine"]

[workspace.package]
edition = "2024"
rust-version = "1.85"
license = "Apache-2.0"
repository = "https://github.com/shortc/contextractor-ts"

[workspace.dependencies]
anyhow = "1"
thiserror = "1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
tracing = "0.1"
```

## Member crate `Cargo.toml`

```toml
[package]
name = "contextractor"
version = "0.1.0"
edition.workspace = true
rust-version.workspace = true
license.workspace = true

[dependencies]
contextractor_engine = { path = "../../packages/contextractor_engine" }
anyhow.workspace = true
serde.workspace = true
tokio.workspace = true
```

## Conventions

- Inherit common dependencies via `workspace = true` to keep versions aligned across crates
- Use `path = "..."` references for in-workspace deps (no version)
- Run `cargo build --workspace` and `cargo test --workspace` from the root
- Add new crates by listing them in `[workspace] members`
