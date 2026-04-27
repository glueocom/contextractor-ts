# Contextractor

Crawl websites and extract clean, readable main-content text. Built on
[`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura)
(extraction) and [Crawlee](https://crawlee.dev/) (TypeScript crawler driving
Playwright).

This monorepo hosts:

- **[`apps/contextractor-apify`](./apps/contextractor-apify/README.md)** —
  Apify Actor.
- **[`apps/contextractor-standalone`](./apps/contextractor-standalone/README.md)**
  — TypeScript CLI.
- **[`packages/contextractor-engine`](./packages/contextractor-engine/README.md)**
  — TypeScript engine wrapping the napi-rs binding around `rs-trafilatura`.

## Supported output formats

`txt`, `markdown`, `json`, `html`. XML and XML-TEI are temporarily unsupported
pending upstream `rs-trafilatura` work — the Python source supported them via
Trafilatura.

## Local prerequisites

- **Rust toolchain** via `rustup` (cargo + rustc on PATH for napi build).
- **Apify CLI ≥ 1.4** (older versions reject the modern `actor.json` format
  with "Actor is of an unknown format").
- **Node 22+**, **pnpm 10+**.

## Workspace commands

```bash
pnpm -r build                                          # Build all TS packages
pnpm -r test                                           # Run all vitest suites
pnpm -r lint                                           # Biome lint
pnpm -F @contextractor/engine-native build             # Build the napi-rs .node
cargo build --workspace                                # Build the napi-rs Rust crate
cargo test --workspace                                 # Cargo unit tests
cargo clippy --workspace --all-targets -- -D warnings  # Strict Rust lints
biome check .                                          # Workspace lint + format
apify run                                              # Run the Actor locally (from apps/contextractor-apify/)
```

## Architecture

```
apps/
├── contextractor-apify/        # TypeScript Apify Actor (Crawlee + Playwright + @contextractor/engine)
└── contextractor-standalone/   # TypeScript CLI
packages/
└── contextractor-engine/       # TypeScript engine
    └── native/                 # napi-rs Rust crate wrapping rs-trafilatura
        └── npm/<platform>/     # Per-platform .node prebuilds (workspace packages)
tools/
├── platform-test-runner/       # TypeScript test orchestrator
└── generated-unit-tests/       # vitest cases against @contextractor/engine
```

## Docs version

Docs version: 2026-04-27.
