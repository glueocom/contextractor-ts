# Spelling Autofix — False Positives Log

**Date**: 2026-05-03

All words below were flagged by cspell but are legitimate in context.

## Generated / Runtime Files (not source)

- `apps/apify-actor/storage/key_value_stores/default/SDK_CRAWLER_STATISTICS_0.json` — `Millis` (Crawlee SDK key names)
- `tools/platform-test-runner/test-suites-output/*/result.json` — `miroslavsekera` (filesystem path in crawled URLs)

## Technical Identifiers

- `tools/platform-test-runner/src/apify-client.ts:4` — `RAQSG` (substring of Apify Actor ID `nXCKPalCKnRAQSG5S`)
- `tools/platform-test-runner/test-suites/complex-layouts/urls.json:7` — `stackoverflow` (domain name)
- `docs/troubleshooting/timeout/report.md:165` — `qnfa` (substring of Apify run ID `QNaTc2onh9ng8qnfa`)

## Proper Nouns

- `docs/troubleshooting/timeout/report.md:89` — `Technica` (part of "Ars Technica")
- `prompts/2026-01-31-docs/*.md` — `Adrien Barbaresi` (trafilatura author name)

## .claude/ Agents and Commands

- `reqwest`, `thiserror`, `nextest`, `proptest`, `mockall`, `insta` — Rust library names
- `println`, `eprintln` — Rust macros
- `Newtype` — Rust design pattern name
- `frontmatter`, `Frontmatter` — standard YAML/markdown term
- `worktree`, `Worktree` — git term
- `webscraping`, `subreddits` — compound words in context
- `unrequested` — valid English compound
- `Mcpjson` — cspell word-split artifact of `mcp.json`

## Archived Prompts (prompts/ directory)

These prompts were written for a Python repo and contain Python-specific terms:
- `pytest`, `pyproject`, `asyncio`, `Pydantic`, `conftest`, `kwargs`, `getattr`, `classmethod`
- `mypy`, `lxml`, `langid`, `virtualenv`, `browserforge`, `typer`, `isort`, `venv`, `numpy`
- `dataclasses`, `compileall`, `pipefail`, `IGNORECASE`, `settingsfile`, `Pythonic`
- `argh`, `bpaf` — Python/Rust CLI libraries
- `miroslavsekera` — filesystem path component
- `heredocs` — shell term

## Other .claude/ False Positives

- `streamable` — MCP transport protocol term
- `stringization` — C preprocessor / Rust doc term
- `debuginfo` — cargo/build artifact term
