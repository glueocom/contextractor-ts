# Spelling Autofix Report

**Date:** 2026-05-20
**Tool:** cspell via `npx cspell`

## Files Checked

cspell scanned 191 first-party files matching:
- `apps/**/*.ts`, `apps/**/*.md`
- `packages/**/*.ts`, `packages/**/*.md`
- `tools/**/*.ts`, `tools/**/*.md`
- `.claude/**/*.md`
- `CLAUDE.md`, `SPEC.md`, `README.md`

Excluded: `node_modules/**`, `dist/**`, `**/*.d.ts`, `examples/**/node_modules/**`, `apps/apify-actor/storage/**`, `autonomous-task-output/**`, `docs/troubleshooting/**`, `docs/todo/**`

**Total issues flagged:** 205 across 53 files

## Genuine Typos Fixed

**None.** All 205 flagged items are false positives. No genuine spelling errors or grammar mistakes were found in first-party source files or documentation.

## False Positives

See `prompts/test-spelling-autofix-prompt.md` for the full list with rationale.

### Summary by category

- **Rust crate/tool names** — `thiserror`, `reqwest`, `nextest`, `mockall`, `proptest`, `insta`, `dhat`, `ahash` — Rust ecosystem package names; not typos
- **Rust macro/keyword identifiers** — `println`, `eprintln`, `Newtype`, `rlib`, `doctest`, `Zscript` — Rust language and toolchain terms
- **Git terms** — `worktree`, `worktrees`, `WORKTREE` — standard `git worktree` CLI terminology
- **Meta tooling terms** — `frontmatter`, `Frontmatter` — widely used YAML/markdown term in static-site and prompt tooling contexts
- **JSON property name fragments** — `Mcpjson` (in `enabledMcpjsonServers` camelCase identifier), `RAQSG` (part of Apify Actor ID `nXCKPalCKnRAQSG5S`)
- **Proper names** — `miroslavsekera` (GitHub username in file paths), `Adrien Barbaresi` (trafilatura author)
- **Python library names** — `lxml`, `langid` — appear in archived prompt documents about Python tooling
- **Common engineering abbreviations** — `dedup` (shorthand for "deduplication", used consistently across SPEC files and test descriptions), `codegen`, `Microbenchmarks`, `roundtrips`, `webscraping`, `subreddits`
- **British English spellings** — `behaviour`, `initialises` — used intentionally in `packages/crawler/SPEC.md`; consistent with British English used throughout the `prompts/` directory
- **Valid uncommon English** — `unrequested` (antonym of "requested")
- **Generated/truncated content** — `DOMCONTENTLOADE` in `apps/apify-actor/README.md` line 82 (inside `<!-- @generated -->` region; truncated `DOMCONTENTLOADED` due to table cell length — must not be hand-edited)
- **Performance profiling tools** — `callgrind`, `dhat` — Valgrind/DHAT profiler tool names
- **Document processing** — `pdfplumber`, `OOXML` — PDF and Office Open XML libraries in skill docs
- **Misc acronyms** — `mnda` (internal reference in skill), `RAQSG` (Actor ID fragment)
