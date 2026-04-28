---
description: Scaffold production-ready Rust projects with modern tooling. Creates project structure with Cargo workspace, Edition 2024, clippy, rustfmt, and Apify Actor patterns. Use for axum microservices, CLI tools, libraries, data pipelines, and Rust-based Apify Actors.
---

# Rust Project Scaffold

Create a production-ready Rust project with modern tooling and best practices.

## Usage

```
/scaffold:rust-scaffold <project-type> [project-name]
```

## Project Types

### `axum-microservice`

HTTP service with:
- `axum` 0.8 router with typed extractors and shared state
- `tokio` runtime, `tower-http` middleware (trace, compression, CORS)
- `sqlx` (PostgreSQL) with compile-time-checked queries
- `tracing` + `tracing-subscriber` for structured logging
- `Dockerfile` with multi-stage build, distroless runtime
- Health and readiness endpoints

### `cli-tool`

Modern CLI with:
- `clap` 4.x derive API
- `anyhow` for application errors, `thiserror` for typed errors
- `indicatif` for progress, `console` for colored output
- `assert_cmd` integration tests
- Single binary distribution

### `library`

Reusable crate with:
- `src/lib.rs` layout
- `Cargo.toml` with full metadata (license, repository, keywords, categories)
- `[lints.rust]` and `[lints.clippy]` strict
- `criterion` benches in `benches/`
- `cargo doc` configuration
- GitHub Actions CI publishing on tag

### `data-pipeline`

Async data processing app with:
- `tokio` `JoinSet` worker pool with `Semaphore` rate limit
- `serde` + `serde_json` for I/O, `csv` or `parquet` for storage
- `tracing` for observability
- `backoff` for retries with exponential backoff
- Graceful shutdown via `tokio::signal`

### `apify-actor`

Rust binary Apify Actor (CLI-wrapped) with:
- `apps/<name>/` Cargo binary crate
- `.actor/` directory with `actor.json`, `input_schema.json`, `output_schema.json`, `dataset_schema.json`, `Dockerfile`
- `serde` input parsing from `INPUT.json` in the key-value store
- `tracing` logging that goes to stdout (Apify captures it)
- Graceful exit via `Actor.exit(...)` shim or process exit codes

## Project Structure

```
{project-name}/
├── Cargo.toml
├── Cargo.lock
├── rust-toolchain.toml
├── rustfmt.toml
├── deny.toml
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── README.md
├── src/
│   ├── lib.rs        # for library
│   └── main.rs       # for binary
└── tests/
    └── integration.rs
```

## Toolchain

`rust-toolchain.toml`:

```toml
[toolchain]
channel = "1.85"
components = ["rustfmt", "clippy", "rust-src"]
profile = "minimal"
```

`rustfmt.toml`:

```toml
edition = "2024"
max_width = 100
imports_granularity = "Module"
group_imports = "StdExternalCrate"
```

## Cargo.toml

```toml
[package]
name = "{project-name}"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"
license = "Apache-2.0"

[dependencies]
anyhow = "1"
thiserror = "1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[dev-dependencies]
mockall = "0.13"
wiremock = "0.6"

[lints.rust]
unsafe_code = "forbid"
missing_docs = "warn"

[lints.clippy]
unwrap_used = "warn"
expect_used = "warn"

[profile.release]
lto = "fat"
codegen-units = 1
strip = "symbols"
```

## Supply-chain checks

```bash
cargo install cargo-deny cargo-audit
cargo deny check
cargo audit
```

`deny.toml` blocks GPL-only deps, duplicate versions, and known-vuln crates.

## Execution

When invoked, this command will:

1. **Analyze Context** — check for an existing workspace and either add a new member crate or scaffold standalone
2. **Create Structure** — generate the project layout above
3. **Configure Tooling** — write `Cargo.toml`, `rust-toolchain.toml`, `rustfmt.toml`, `deny.toml`
4. **Initialize Git** — `.gitignore` (`target/`, `Cargo.lock` only for libraries), initial commit
5. **Add Tests** — sample unit test in `src/`, integration test in `tests/`
6. **Document** — `README.md` with build, test, run instructions

## Activated Skills

This command activates these skills when executed:

- `rust` — language guidelines
- `async-rust-patterns` — for projects using `tokio`
- `rust-testing-patterns` — for test setup
- `rust-packaging` — for library projects
- `rust-performance-optimization` — for projects with hot paths
