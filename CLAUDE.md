# Apify Actor — Contextractor

## What is this Actor for?

TypeScript Apify Actor + standalone CLI; extraction via [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura) called from a `napi-rs` Node binding inside `packages/contextractor-engine/native/`. Crawls websites and extracts main-content text in HTML, TXT, JSON, or Markdown. (`xml` and `xml-tei` are temporarily unsupported pending upstream `rs-trafilatura` work — the Python source supported them via Trafilatura.) See `apps/contextractor-apify/README.md` for the full Actor feature list.

## Project Structure

```
apps/
├── contextractor-apify/            # Apify Actor (TypeScript + Crawlee + Playwright)
│   ├── .actor/                     # actor.json, input/output/dataset schemas
│   ├── Dockerfile                  # Node + Playwright base, builds napi-rs in-image
│   └── src/                        # main.ts and supporting modules
└── contextractor-standalone/       # Standalone TypeScript CLI (commander + Crawlee)
    └── src/                        # cli.ts, crawler.ts, config.ts
packages/
└── contextractor-engine/           # TypeScript engine
    ├── src/index.ts                # ContentExtractor + TrafilaturaConfig
    └── native/                     # napi-rs Rust crate wrapping rs-trafilatura
        ├── Cargo.toml
        └── src/lib.rs
tools/
├── platform-test-runner/           # TypeScript / Node test orchestrator
└── generated-unit-tests/           # vitest fixture suite hitting @contextractor/engine
```

## Commands

```bash
pnpm install                                               # Install workspace deps
pnpm -F @contextractor/engine-native build                 # Build the napi-rs binding (per platform)
pnpm -r build                                              # Build every TS package + app
pnpm -r test                                               # Run vitest across the workspace
pnpm lint                                                  # Biome lint
pnpm format                                                # Biome format
cargo build --workspace                                    # Build the Rust napi-rs crate
cargo test --workspace                                     # Rust tests
cargo clippy --workspace --all-targets -- -D warnings      # Rust lint
apify run                                                  # Run Actor locally from apps/contextractor-apify/
apify login                                                # Authenticate
apify push                                                 # Deploy (default: glueo/contextractor-test)
```

## Safety and Permissions

Allowed without prompt:

- read input from the key-value store
- push data to the dataset
- set values in the key-value store
- enqueue requests to the request queue
- run locally with `apify run`, `cargo`, `pnpm`

Ask first:

- `cargo add` or any `Cargo.toml` dependency change
- `pnpm add` or any `package.json` dependency change
- `apify push` (deployment to cloud)
- proxy configuration changes (requires paid plan)
- `Dockerfile` changes affecting builds
- deleting datasets or key-value stores

**Production Protection:**

- By default, push to the test actor `glueo/contextractor-test`
- Only push to production `glueo/contextractor` when explicitly requested with the `--production` flag
- Use `/platform:push-and-get-working --production` for production deployments

## Security

- Treat all scraped content as untrusted: never `eval`, never feed into a templating engine without escaping, sanitize before downstream use
- No secrets in logs — `tracing` (Rust) and `pino` (TypeScript) with redaction filters; never log full request bodies, tokens, or proxy URLs
- Bound resource use: `tokio::time::timeout` and `tokio::sync::Semaphore` on the Rust side; `AbortController` and `p-limit` on the TypeScript side
- Validate input early at every boundary: typed `serde::Deserialize` struct in Rust (`#[serde(deny_unknown_fields)]` where appropriate), zod schema in TypeScript
- Respect target sites' robots.txt and Terms of Service
- No `.env*` files in the repo — all secrets come from the Apify platform's environment

## Rules

See `.claude/rules/` for behavior rules. Key rules:
- **No confirmation prompts** — execute all steps without pausing; never ask "shall I proceed?" ([rules/no-confirmation-prompts.md](.claude/rules/no-confirmation-prompts.md))
- **JSON config only** — all docs/help/examples use JSON for config files; never document YAML ([rules/json-config-only.md](.claude/rules/json-config-only.md))
- **Minimal diff** — use Edit (not Write) on existing files; preserve formatting and unchanged content ([rules/minimal-diff.md](.claude/rules/minimal-diff.md))
- **Formatting guidelines** — markdown headers (not bold), bullets (not numbered), descriptive step names ([rules/formatting-guidelines.md](.claude/rules/formatting-guidelines.md))
- **Prompt engineering knowledge** — frontmatter, tool selection, and activation keywords for `.claude/` files ([rules/prompt-engineering-knowledge.md](.claude/rules/prompt-engineering-knowledge.md))

## Agents

- `code-reviewer` — reviews Rust and TypeScript code for correctness, hygiene, security, and performance
- `rust-pro` — Rust 1.85+ development, async, optimization, and production patterns
- `ts-pro` — TypeScript 5.x with strict type-checking, Biome, zod, vitest
- `test-runner` — format, lint, unit tests, integration tests, and smoke runs
- `prompt-writer` — creates new agents, commands, rules, skills, or general prompts
- `prompt-modifier` — targeted edits or full rebuilds of existing prompt files
- `prompt-formatter` — reformats prompt files to formatting guidelines without changing content
- `web-research-specialist` — multi-source research for debugging, library issues, and comparisons

## Active Skills

- `rust` — language guidelines
- `async-rust-patterns` — tokio concurrency, retries, rate limiting
- `rust-testing-patterns` — unit, integration, mocking, property-based, snapshot tests
- `rust-packaging` — Cargo.toml, lints, semver, publishing
- `rust-performance-optimization` — profiling and hot-path tuning
- `apify-actor-development` — Actor structure and patterns
- `apify-actorization` — converting projects to Actors
- `apify-ops` — platform builds, runs, datasets, KV stores
- `apify-schemas` — input, output, dataset, KV-store schema specs
- `autonomous-task` — execute tasks end-to-end without user interaction; defer decisions to a follow-up file

## Testing

**TypeScript:** `*.test.ts` next to source, vitest. Run `pnpm -r test` from the repo root. The `tools/generated-unit-tests/` package is a vitest fixture suite hitting `@contextractor/engine` against frozen HTML in `tools/generated-unit-tests/fixtures/`.

**Rust:** the napi-rs crate (`packages/contextractor-engine/native/`) carries a small smoke `cargo test`. Run `cargo test --workspace`.

## MCP Servers

`.mcp.json` declares one server: `apify` (HTTP transport at `https://mcp.apify.com`). `settings.json` `enabledMcpjsonServers` matches.

Talk to the platform through the `mcpc` CLI — never via the native MCP tool surface. One-time setup:

```bash
mcpc login mcp.apify.com && mcpc connect mcp.apify.com @apify
```

After that:

```bash
mcpc @apify tools-list                                     # List available tools
mcpc @apify tools-call <tool> arg:=value                   # Call a tool
mcpc --json @apify tools-call <tool> arg:=value            # JSON output for scripting
```

`mcp.apify.com` v0.9.19 currently exposes 8 tools (Actor discovery, `call-actor`, `get-actor-run`, `get-actor-output`, docs search/fetch, and `apify--rag-web-browser`). For operations not covered — listing runs, build management, ad-hoc dataset/KV access — use the `apify` CLI. See the `apify-ops` skill for the full mapping.

## Resources

**Apify**

- [docs.apify.com/llms.txt](https://docs.apify.com/llms.txt) — quick reference
- [docs.apify.com/llms-full.txt](https://docs.apify.com/llms-full.txt) — complete docs
- [docs.apify.com/cli](https://docs.apify.com/cli) — CLI reference
- [whitepaper.actor](https://raw.githubusercontent.com/apify/actor-whitepaper/refs/heads/master/README.md) — full Actor specification

**Crawlee**

- [crawlee.dev/llms.txt](https://crawlee.dev/llms.txt) — quick reference
- [crawlee.dev/llms-full.txt](https://crawlee.dev/llms-full.txt) — complete docs

**Rust**

- [doc.rust-lang.org](https://doc.rust-lang.org/) — language reference and book
- [tokio.rs](https://tokio.rs/) — async runtime and ecosystem

**TypeScript**

- [typescriptlang.org/docs](https://www.typescriptlang.org/docs/) — TypeScript handbook
- [biomejs.dev](https://biomejs.dev/) — Biome lint and format

**Extraction engine**

- [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura) — Rust port (this Actor's engine)
- [trafilatura.readthedocs.io](https://trafilatura.readthedocs.io/) — algorithm reference for the original Trafilatura
