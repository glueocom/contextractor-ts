# Apify Actor — Contextractor

TypeScript Apify Actor and standalone CLI built on [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura) (extraction) and [Crawlee](https://crawlee.dev/) (Playwright crawler). Extracts main-content text in `txt`, `markdown`, `json`, or `html`. See `apps/contextractor-apify/README.md` for the full feature list.

## Project Structure

```
apps/
├── contextractor-apify/       # Apify Actor (Crawlee + Playwright + @contextractor/engine)
└── contextractor-standalone/  # CLI
packages/
└── contextractor-engine/      # TS engine + napi-rs Rust crate (rs-trafilatura binding)
tools/
├── platform-test-runner/      # test orchestrator
└── generated-unit-tests/      # vitest tests + HTML fixtures
```

## Commands

```bash
pnpm build                                                 # Build all TS packages (via turbo)
pnpm test                                                  # All vitest tests (via turbo)
pnpm lint                                                  # Biome lint (via turbo)
pnpm --filter @contextractor/engine-native build:rebuild   # Build napi-rs .node
cargo build --workspace                                    # Build napi-rs crate
cargo test --workspace                                     # Cargo tests
cargo clippy --workspace --all-targets -- -D warnings      # Rust lint
cargo fmt --all                                            # Rust format
apify run                                                  # Run Actor locally
```

Production deploys go through a **Git-connected build** in Apify Console (not `apify push`). `.node` prebuilds ship via `optionalDependencies` — no Rust toolchain needed in the image.

## Local Prerequisites

- **Rust toolchain** via `rustup`
- **Apify CLI ≥ 1.4**
- **Node 22+**, **pnpm 10+**

## MCP

`.mcp.json`: `apify` server at `https://mcp.apify.com`. Use `mcpc` CLI — never the native MCP surface.

```bash
mcpc login mcp.apify.com && mcpc connect mcp.apify.com @apify
mcpc @apify tools-list
mcpc @apify tools-call <tool> arg:=value
```

## Rules

- [No confirmation prompts](.claude/rules/no-confirmation-prompts.md)
- [Apify production protection](.claude/rules/apify-production.md) — never push to prod unless explicitly asked
- [Security](.claude/rules/security.md)
- [Testing](.claude/rules/testing.md)
- [JSON config only](.claude/rules/json-config-only.md)
- [Minimal diff](.claude/rules/minimal-diff.md)
- [Formatting guidelines](.claude/rules/formatting-guidelines.md)
- [Prompt engineering knowledge](.claude/rules/prompt-engineering-knowledge.md)

## Agents

- `code-reviewer` — Rust and TypeScript code review
- `rust-pro` — Rust 1.85+ development
- `ts-pro` — TypeScript 5.x, Biome, zod, vitest
- `test-runner` — format, lint, unit, integration, smoke
- `prompt-writer` — creates agents, commands, rules, skills
- `prompt-modifier` — edits or rebuilds existing prompts
- `prompt-formatter` — reformats prompts to guidelines
- `web-research-specialist` — multi-source research

## Active Skills

- `rust`, `async-rust-patterns`, `rust-testing-patterns`, `rust-packaging`, `rust-performance-optimization`
- `apify-actor-development`, `apify-actorization`, `apify-ops`, `apify-schemas`
- `autonomous-task`

## Resources

- [docs.apify.com/llms.txt](https://docs.apify.com/llms.txt) — Apify quick ref
- [docs.apify.com/llms-full.txt](https://docs.apify.com/llms-full.txt) — Apify full docs
- [crawlee.dev/llms.txt](https://crawlee.dev/llms.txt) — Crawlee quick ref
- [rs-trafilatura](https://github.com/Murrough-Foley/rs-trafilatura) — extraction engine
- [trafilatura.readthedocs.io](https://trafilatura.readthedocs.io/) — algorithm reference
