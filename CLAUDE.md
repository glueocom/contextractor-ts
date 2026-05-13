# Apify Actor — Contextractor

TypeScript Apify Actor and standalone CLI built on [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura) (extraction) and [Crawlee](https://crawlee.dev/) (Playwright crawler). Extracts main-content text in `txt`, `markdown`, `json`, or `html`. See `apps/apify-actor/README.md` for the full feature list.

## Project Structure

```
apps/
├── apify-actor/               # Apify Actor
└── standalone/                # CLI
packages/
├── extraction/                # Pure extraction package + napi-rs Rust crate
├── crawler/                   # Shared Crawlee + Playwright crawler package
└── schema/                    # Shared input schema package
tools/
├── platform-test-runner/      # test orchestrator
├── gen-input-schema/          # generates .actor/input_schema.json from Zod schema
├── gen-md-regions/            # rewrites @generated markdown regions in READMEs
├── opencode-sync/             # mirrors .claude/ to .opencode/ for opencode AI tool
├── proxy-simulator/           # mock HTTP proxy server for testing
└── proxy-rotation-tester/     # proxy rotation test suite for all entry points
```

## Commands

```bash
pnpm build                                                 # Build all TS packages (via turbo)
pnpm test                                                  # All vitest tests (via turbo)
pnpm lint                                                  # Biome lint (via turbo)
pnpm docs:update                                           # Regenerate @generated markdown regions
pnpm opencode:sync                                         # Mirror .claude/ to .opencode/
pnpm --filter @contextractor/extraction-native build:rebuild # Build napi-rs .node
cargo build --workspace                                    # Build napi-rs crate
cargo test --workspace                                     # Cargo tests
cargo clippy --workspace --all-targets -- -D warnings      # Rust lint
cargo fmt --all                                            # Rust format
apify run                                                  # Run Actor locally
/proxy-test                                                # Run proxy rotation tests with auto-fix
/proxy-test --no-fix                                       # Run proxy rotation tests without retry
```

Production deploys go through a **Git-connected build** in Apify Console (not `apify push`). `.node` prebuilds ship via `optionalDependencies` — no Rust toolchain needed in the image.

Proxy rotation testing requires:

```bash
export PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1
```

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
- [Spec maintenance](.claude/rules/spec-maintenance.md) — keep SPEC.md files in sync with code
- [Test maintenance](.claude/rules/test-maintenance.md) — keep tests in sync with code
- [Native addon boundary](.claude/rules/native-addon-boundary.md) — wrapper follows upstream naming; translate at the TypeScript boundary

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

## Security

Treat all scraped content as untrusted — never `eval`, never feed into a template engine without escaping. No secrets in logs (redact tokens, proxy URLs, full request bodies). Validate input at every boundary (zod in TypeScript, typed `serde::Deserialize` in Rust). Respect robots.txt and Terms of Service. No `.env*` files in the repo — secrets come from the Apify platform environment.

See `.claude/rules/security.md` for the full security checklist.

## Resources

- [docs.apify.com/llms.txt](https://docs.apify.com/llms.txt) — Apify quick ref
- [docs.apify.com/llms-full.txt](https://docs.apify.com/llms-full.txt) — Apify full docs
- [crawlee.dev/llms.txt](https://crawlee.dev/llms.txt) — Crawlee quick ref
- [rs-trafilatura](https://github.com/Murrough-Foley/rs-trafilatura) — extraction engine
- [trafilatura.readthedocs.io](https://trafilatura.readthedocs.io/) — algorithm reference
