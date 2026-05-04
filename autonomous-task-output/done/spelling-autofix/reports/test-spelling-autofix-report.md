# Spelling Autofix Report

**Date**: 2026-05-03
**Tool**: cspell

## Files Checked

- `apps/**/*.ts`, `apps/**/*.md`, `apps/**/*.json`
- `packages/**/*.ts`, `packages/**/*.md`
- `tools/**/*.ts`, `tools/**/*.md`
- `.claude/**/*.md`
- `*.md` (root-level)
- `docs/**/*.md`
- `prompts/**/*.md`

**Total TypeScript source files**: 93
**Total markdown/doc files**: 28

## Genuine Typos Fixed

None. No genuine spelling errors were found in source code or primary documentation.

## False Positives

All flagged words were false positives. See `prompts/test-spelling-autofix-prompt.md` for the full list.

### Summary by category

- **Technical identifiers**: `RAQSG` (Apify Actor ID), `qnfa` (Apify run ID), `stackoverflow` (URL fragment in test fixture)
- **SDK-generated data**: `Millis` (Crawlee SDK key-value store JSON — generated file, not source)
- **Rust library names**: `thiserror`, `reqwest`, `nextest`, `proptest`, `mockall`, `insta`
- **Rust terms**: `println`, `eprintln`, `Newtype`
- **Git terms**: `worktree`, `Worktree`
- **Standard prompt/markdown terms**: `frontmatter`, `Frontmatter`
- **Proper nouns**: `Adrien Barbaresi` (trafilatura author), `Ars Technica` (tech publication)
- **Python tech terms** (in archived prompts): `pytest`, `pyproject`, `asyncio`, `Pydantic`, `conftest`, `kwargs`, `getattr`, `classmethod`, `mypy`, `lxml`, `langid`, `virtualenv`, `browserforge`, `typer`, `isort`, `venv`, `numpy`, `dataclasses`, `compileall`, `pipefail`, `IGNORECASE`
- **Username paths**: `miroslavsekera` (filesystem path component)
- **Other**: `Millis` (standard SDK abbreviation), `debuginfo`, `streamable`, `subreddits`, `webscraping`, `unrequested`, `heredocs`, `argh`, `bpaf`, `Mcpjson`
