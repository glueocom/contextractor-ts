# Spelling Autofix Report

**Date**: 2026-05-12
**Tool**: cspell via `npx cspell`

## Files Checked

- `apps/apify-actor/README.md`
- `apps/standalone/src/**/*.ts`
- `apps/apify-actor/src/**/*.ts`
- `packages/**/*.ts`, `packages/**/*.md`
- `.claude/**/*.md`
- Root `README.md`, `SPEC.md`, all package/app `SPEC.md` and `README.md` files

Excluded: `node_modules/`, `dist/`, `target/`, `examples/`, `apps/apify-actor/storage/`, `autonomous-task-output/`, `prompts/`, `docs/troubleshooting/`, `docs/todo/`

**Total files checked**: ~472 (across full glob) / ~50 project-owned source and doc files

## Genuine Typos Fixed

None. No genuine spelling errors were found in source files (TypeScript, Rust) or primary documentation (README, SPEC).

The cspell run on `apps/*/src/**/*.ts`, `packages/**/*.ts` returned **zero issues**.

## False Positives

All cspell flags in project-owned files are false positives:

| Word(s) | Location(s) | Reason |
|---|---|---|
| `DOMCONTENTLOADE` | `apps/apify-actor/README.md:74` | `DOMCONTENTLOADED` truncated with `…` in @generated region |
| `behaviour`, `prioritise` | `packages/crawler/SPEC.md:42`, `.claude/commands/sync/spec.md` | British spelling; intentional |
| `frontmatter` | `.claude/agents/*.md`, `.claude/commands/**/*.md`, `.claude/skills/**/*.md` | Common term for YAML/TOML metadata in markdown |
| `worktree`, `worktrees`, `WORKTREE` | `.claude/commands/git/*.md` | `git worktree` — technical git term |
| `miroslavsekera` | Multiple `.claude/` and `tools/` files | GitHub username |
| `thiserror`, `reqwest`, `mockall`, `proptest`, `insta`, `nextest`, `ahash`, `sqlx`, `indicatif` | `.claude/agents/*.md`, `.claude/skills/*.md` | Rust crate names |
| `println`, `eprintln` | `.claude/agents/code-reviewer.md`, `.claude/skills/rust/` | Rust macros |
| `Newtype` | `.claude/agents/rust-pro.md`, `.claude/skills/rust/SKILL.md` | Rust design pattern |
| `asyncio`, `nonlocal`, `isoformat`, `wfile` | `.claude/skills/apify-actorization/`, `.claude/skills/apify-actor-development/` | Python language keywords/builtins |
| `codegen` | `.claude/rules/test-maintenance.md`, `.claude/skills/rust-performance-optimization/` | Common abbreviation for code generation |
| `flamegraph`, `dhat`, `callgrind` | `.claude/skills/rust-performance-optimization/SKILL.md` | Rust profiling tools |
| `poidata`, `maxcopell`, `vdrmota` | `.claude/skills/apify-*.md` | Apify actor/user identifiers |
| `RAQSG` | `tools/platform-test-runner/src/apify-client.ts:4` | Part of Apify actor ID `nXCKPalCKnRAQSG5S` |
| `stackoverflow` | `tools/platform-test-runner/test-suites/complex-layouts/urls.json:7` | Domain name |
| `Technica` | `docs/troubleshooting/timeout/report.md:89` | Part of "Ars Technica" (publication name) |
| `qnfa` | `docs/troubleshooting/timeout/report.md:165` | Part of Apify run ID `QNaTc2onh9ng8qnfa` |
| `Initialises`, `behaviour` | `apps/standalone/dist/storage/resolveStorageDir.d.ts` | Generated dist file; British spelling |
| `ensureuninstalled` | `dev-utils/installation/lib/pkg.ts` | camelCase function identifier |
| `turbopack`, `oneline`, `distroless`, `Zscript` | `.claude/commands/**/*.md` | Technical tool names / CLI flags |
| `EBADPLATFORM`, `EACCES`, `glueocom` | `.claude/commands/platform/deploy-and-test.md` | npm error codes / compound domain name |
| `Millis` | `.claude/skills/apify-actor-development/SKILL.md` | Apify SDK constant name |
| `nextest` | `.claude/skills/rust-testing-patterns/SKILL.md`, `.claude/agents/rust-pro.md` | `cargo-nextest` test runner |
| `roundtrips` | `.claude/skills/rust-testing-patterns/SKILL.md` | Valid compound word |
| `Microbenchmarks` | `.claude/skills/rust-performance-optimization/SKILL.md` | Valid compound word |
| `doctest` | `.claude/skills/rust/SKILL.md` | Rust doc-test feature |
| `rlib` | `.claude/skills/rust/references/cargo-workspace.md` | Rust library crate type |
| `Geospatial` | `.claude/skills/apify-market-research/SKILL.md` | Valid geographic term |
| `influencers` | `.claude/skills/apify-influencer-discovery/SKILL.md` | Valid English word |
| `permissioning` | `.claude/rules/prompt-engineering-knowledge.md` | Valid English gerund |
| `unrequested` | `.claude/agents/prompt-modifier.md` | Valid English word |
| `lxml`, `langid` | `prompts/2026-01-31-docs/img.md` | Python library names |
| `Adrien Barbaresi` | `prompts/2026-01-31-docs/img.md` | Author of trafilatura |
| `OOXML`, `mnda`, `pdfplumber` | `.claude/skills/skill-creator/SKILL.md` | File format / Python library names |
| `asyncio` | `.claude/skills/apify-*.md` | Python standard library |
| `DATASETCONTENT`, `OUTPUTTYPE` | `autonomous-task-output/dead-code-autofix/` | Technical identifiers in generated prompts |
| `Mcpjson` | `.claude/commands/autonomous/meta/setup.md`, `.claude/commands/meta/setup.md` | Compound reference to `.mcp.json` |
| `METAMORPH`, `MILLIS`, `MBYTES`, `COEFF`, `SUBDIRS`, `MULTIFILE` | `examples/apify-api-ts/node_modules/` | Third-party package constants (excluded from fix scope) |

## Prompts File

No ambiguous cases required human review. See above table — all flagged words are confirmed false positives.

## Result

**Clean**: Zero genuine spelling errors in project source files or documentation.
