# Step ADD_STANDALONE: Propagate `apps/contextractor-standalone`

## TLDR

Create `apps/contextractor-standalone/` as a Rust CLI binary mirroring the Python `typer` + Crawlee CLI in `/Users/miroslavsekera/r/contextractor/apps/contextractor-standalone/`. Provide an `npm/` distribution wrapper that ships prebuilt platform binaries.

## Skills and agents

- `rust`, `rust-packaging` — crate scaffolding.
- `apify-actorization` — npm wrapper layout precedent.
- `rust-pro`, `ts-pro` — implementer for Rust binary and the npm wrapper respectively.

## Inputs

- Python source: `/Users/miroslavsekera/r/contextractor/apps/contextractor-standalone/`.
- npm wrapper precedent: `/Users/miroslavsekera/r/contextractor/apps/contextractor-standalone/npm/`.
- Build script precedent: `/Users/miroslavsekera/r/contextractor/apps/contextractor-standalone/build.py`.

## Step CARGO_BIN: Rust CLI scaffold

- Create `apps/contextractor-standalone/Cargo.toml`. Binary name `contextractor`.
- Dependencies: `contextractor_engine = { path = "../../packages/contextractor_engine" }`, `clap` (with `derive`), `tokio`, `reqwest` (for `--url` mode), `serde_json`, `anyhow`, `tracing`.
- Add to workspace `Cargo.toml` members.

## Step CLI_PORT: Port subcommands

Mirror the Python CLI surface:

- `extract --url <URL> [--format <fmt>] [--config <path>]` — fetches one URL and prints extracted content.
- `extract --html <PATH> [--format <fmt>] [--config <path>]` — extracts from a local HTML file.
- `extract --stdin [--format <fmt>] [--config <path>]` — reads HTML from stdin.
- `crawl --config <path>` — multi-page crawl, mirroring the Python crawler.
- `defaults` — prints the default JSON config (per `../migrate-py-to-ts-rust-notes/rs-trafilatura-api.md`).

Format flag accepts `txt | html | markdown | json`. Drop `xml` and `xmltei` per `../user-entry-log/entry-qa-format-gap.md`.

Config file is JSON only per `.claude/rules/json-config-only.md` (YAML may be silently accepted in code, but never documented). The CLI help string says "Path to JSON config file".

## Step NPM_WRAPPER: npm distribution

Create `apps/contextractor-standalone/npm/`:

- `package.json` declaring `bin` entry, `optionalDependencies` per platform sub-package, `postinstall` script that picks the right prebuilt binary.
- One sub-package per target: `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `win32-x64`. Each sub-package ships a single platform binary.
- Build pipeline that runs `cargo build --release --target <triple>` for each, then bundles each binary into the matching sub-package.
- Replace `build.py` (PyInstaller) with `build.sh` or a Cargo-driven Rust build script — no Python.

## Step STANDALONE_TESTS: Tests

- `cargo test -p contextractor` covering CLI argument parsing, config-file loading, and an extraction smoke test.
- A small npm wrapper smoke test: `node npm/bin.js extract --url <fixture-url>` should return content (run only when binaries are built).

## Step STANDALONE_README: README

Write `apps/contextractor-standalone/README.md` covering installation (`cargo install`, `npm install -g contextractor`), usage examples, and config-file reference. Drop every PyPI mention.
