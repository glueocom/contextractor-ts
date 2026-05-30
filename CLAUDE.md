# Apify Actor — Contextractor

TypeScript Apify Actor and standalone CLI built on [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura) (extraction) and [Crawlee](https://crawlee.dev/) (Playwright crawler). Extracts main-content text in `txt`, `markdown`, `json`, or `html`. See `apps/apify-actor/README.md` for the full feature list.

## Project Structure

```
apps/
├── apify-actor/               # Apify Actor
└── standalone/                # CLI
packages/
├── extraction/                # Pure extraction package + napi-rs Rust crate
├── crawler/                   # Shared Crawlee + Playwright crawler package (incl. shared sink core)
└── schema/                    # Shared input + output schema package
tools/
├── platform-test-runner/      # test orchestrator
├── gen-input-schema/          # generates all four .actor/*.json schemas from Zod
├── gen-md-regions/            # rewrites @generated markdown regions in READMEs
├── proxy-simulator/           # mock HTTP proxy server for testing
└── proxy-rotation-tester/     # proxy rotation test suite for all entry points
```

## Commands

```bash
pnpm build                                                 # Build all TS packages (via turbo)
pnpm test                                                  # All vitest tests (via turbo)
pnpm lint                                                  # Biome lint (via turbo)
pnpm docs:update                                           # Regenerate @generated markdown regions
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

## TypeScript LSP

The `typescript-lsp@claude-plugins-official` plugin wires `typescript-language-server` into the built-in `LSP` tool, providing go-to-definition, find-all-references, hover type info, and real-time diagnostics across `.ts`, `.tsx`, `.js`, `.jsx` files.

- Use `Grep`/`Glob` for **discovery** (finding files, searching patterns)
- Use `LSP` for **understanding** (definitions, references, type errors) — prefer it over reading whole files
- The `LSP` tool requires no `permissions.allow` entry — it auto-approves
- `ENABLE_LSP_TOOL=1` is set in `.claude/settings.json`; `typescript-language-server` must be installed globally (`npm install -g typescript-language-server typescript`)
- For Rust: `rust-analyzer-lsp@claude-plugins-official` is enabled in user settings (`~/.claude/settings.json`)

## Rules

- [No confirmation prompts](.claude/rules/no-confirmation-prompts.md)
- [Task completion](.claude/rules/task-completion.md) — always finish all pending tasks; never stop between steps or after context compression
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
- [Preserve TODOs](.claude/rules/preserve-todos.md) — never delete a TODO unless the fix directly resolves it
- [Rule coverage](.claude/rules/rule-coverage.md) — every rule must be referenced in CLAUDE.md, an agent, or a command
- [User-facing docs](.claude/rules/user-facing-docs.md) — deploy and maintenance info must not appear in the public Actor README

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
- `docs/` — local notes, troubleshooting guides, and unit test case documentation
