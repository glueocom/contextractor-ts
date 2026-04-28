# Cargo Workspace

Layout and dependency management for the Contextractor cargo workspace at `/Users/miroslavsekera/r/contextractor-ts/`. The TypeScript pnpm workspace lives alongside Cargo; the only Rust crate is the napi-rs binding.

## Layout

```
/Users/miroslavsekera/r/contextractor-ts/
├── Cargo.toml                                        # workspace root
├── Cargo.lock                                        # committed
├── package.json                                      # npm workspace root
└── packages/
    └── contextractor-engine/                         # TypeScript package
        ├── package.json
        ├── src/index.ts
        └── native/                                   # Rust crate (the only one)
            ├── Cargo.toml
            ├── build.rs
            └── src/lib.rs
```

## Workspace `Cargo.toml`

```toml
[workspace]
resolver = "3"
members = ["packages/contextractor-engine/native"]

[workspace.package]
edition = "2024"
rust-version = "1.85"
license = "Apache-2.0"
repository = "https://github.com/glueocom/contextractor-ts"

[workspace.dependencies]
napi = { version = "2", features = ["napi6"] }
napi-derive = "2"
napi-build = "2"
rs-trafilatura = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

## napi-rs crate `Cargo.toml`

```toml
[package]
name = "contextractor-engine-native"
version = "0.1.0"
edition.workspace = true
rust-version.workspace = true
license.workspace = true

[lib]
crate-type = ["cdylib"]

[dependencies]
napi.workspace = true
napi-derive.workspace = true
rs-trafilatura.workspace = true
serde.workspace = true
serde_json.workspace = true

[build-dependencies]
napi-build.workspace = true
```

## Conventions

- Inherit common dependencies via `workspace = true` to keep versions aligned.
- Use `path = "..."` references for any future in-workspace deps (no version).
- The crate is `cdylib` only — never `rlib` — because the consumer is the Node runtime.
- Use the bare `Result<T>` from `napi::bindgen_prelude::Result` in `#[napi]` function signatures (no `as` aliases — they leak into generated `.d.ts`).
- Run `cargo build --workspace` and `cargo test --workspace` from the root. Build the `.node` artifact via `npm run build -w @contextractor/engine-native` (which calls `@napi-rs/cli`).
- A virtual workspace with empty `members = []` fails `cargo metadata` — keep at least one member listed.
