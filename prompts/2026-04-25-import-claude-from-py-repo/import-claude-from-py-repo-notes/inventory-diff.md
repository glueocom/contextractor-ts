# Source vs Target `.claude/` Inventory Diff

Captured 2026-04-25.

- Source: `/Users/miroslavsekera/r/contextractor/.claude/` (Python repo)
- Target: `/Users/miroslavsekera/r/contextractor-ts/.claude/` (TS+Rust repo)

## Skills — nothing to import

Every Python skill in source has a Rust equivalent already in target:

| Source (Python) | Target (Rust) |
|---|---|
| `python` | `rust` |
| `python-packaging` | `rust-packaging` |
| `python-performance-optimization` | `rust-performance-optimization` |
| `python-testing-patterns` | `rust-testing-patterns` |
| `async-python-patterns` | `async-rust-patterns` |

All `apify-*` skills (13) are present in both. `skill-creator` is in both. No skill imports needed.

## Agents — nothing to import

Source has only `agents/dev/python-pro.md`. Target has the dual-language equivalent (`rust-pro.md` + `ts-pro.md`) plus `code-reviewer.md` and `test-runner.md`. Python-only agent is explicitly out of scope per user.

## Commands — three to port, one to skip

Source has these commands target lacks:

- `commands/publish/all.md` — multi-channel publish (Apify + npm + PyPI + Docker). **Skip** per `entry-qa-commands.md`. Target ships only to Apify (covered by `commands/platform/push-and-get-working.md`).
- `commands/git/release.md` — version bump + tag + push. Python-keyed (`pyproject.toml`). **Port** to Cargo+npm.
- `commands/sync/docs.md` — README sync from CLI source-of-truth. Python-keyed. **Port** to Rust + TypeScript.
- `commands/sync/gui.md` — cross-package consistency check. Python-keyed. **Port** to Rust + TypeScript.

Per the user note in `entry-qa-commands.md`, every port covers both Rust and TS surfaces — never just one.

## Rules — two to import, one to skip

Source has `.claude/rules/` (target has no rules dir):

- `rules/no-confirmation-prompts.md` — **import as-is**.
- `rules/json-config-only.md` — **import as-is**.
- `rules/config-case-conventions.md` — **skip**. Python-internal helpers (`utils.py`, `to_snake_case`); target case-handling uses serde and is structurally different.

## CLAUDE.md

Source `CLAUDE.md` has a `## Rules` section linking to `.claude/rules/`. Target lacks it. Per `entry-qa-claude-md.md`, append the equivalent section after the import.

## What stays out of scope (don't touch)

- All Python files under target `apps/contextractor/src/` (the `pyproject.toml` and Python codebase). The CLAUDE.md describes the target as Rust+TS, but the codebase is mid-migration. This prompt only touches `.claude/` and `CLAUDE.md`.
- `settings.json` and `settings.local.json` in either repo.
- `.mcp.json` in either repo.
- `prompts/` history.
