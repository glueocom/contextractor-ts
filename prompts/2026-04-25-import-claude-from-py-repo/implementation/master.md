# Import Claude Setup from `contextractor` (Python repo) into `contextractor-ts` (TS+Rust)

## TLDR

Bring the missing pieces of the source Claude setup at `/Users/miroslavsekera/r/contextractor/.claude/` into target `/Users/miroslavsekera/r/contextractor-ts/.claude/`, dropping Python-only content. Specifically: import 2 universal rules, port 3 Python-keyed commands (`git/release`, `sync/docs`, `sync/gui`) to cover both Rust **and** TypeScript source-of-truth, and add a `## Rules` section to `CLAUDE.md`. No skills or agents need to be imported — the target already has Rust equivalents of every Python skill, plus `rust-pro` and `ts-pro` covering the agent gap.

## Why

The source repo is the Python version of the same product. Its Claude setup encodes patterns (release flow, package consistency, doc sync, behavioral rules) that the target repo will benefit from once translated. The user's directive: skip Python, port what carries over, cover both languages where applicable. Background: see `../user-entry-log/entry-initial-prompt.md` and the three Q&A files alongside it.

## Skills and Agents

Activate during execution:

- `apify-schemas` — applies to the `sync/gui` port, since the Apify schemas are part of the consistency check
- `rust` — applies to anything that touches Rust source-of-truth files or `Cargo.toml`
- `apify-ops` — applies to the `git/release` port for the actor-name conventions

Use as implementers / reviewers:

- `general-purpose` agent — for all search-and-port work
- `code-reviewer` agent — final review of the 3 ported command files for consistency

No language-specific reviewer needed — this work edits Markdown only.

## Shared context

- Source: `/Users/miroslavsekera/r/contextractor/.claude/`
- Target: `/Users/miroslavsekera/r/contextractor-ts/.claude/`
- Inventory diff: `../import-claude-from-py-repo-notes/inventory-diff.md`
- Target source-of-truth files: `../import-claude-from-py-repo-notes/target-source-of-truth.md`
- Target uses `shortc/contextractor` (prod) / `shortc/contextractor-test` (test). Source uses `glueo/contextractor*`. Translate actor names where they appear.
- `.mcp.json`, `settings.json`, `settings.local.json`, all skills and agents stay untouched.

## Steps

1. `step-01-import-rules.md` — create `.claude/rules/`, copy `no-confirmation-prompts.md` and `json-config-only.md` verbatim.
2. `step-02-port-git-release.md` — port `commands/git/release.md` to `Cargo.toml` + `tools/*/package.json` version bump.
3. `step-03-port-sync-docs.md` — port `commands/sync/docs.md` reading Rust + TS source-of-truth and the Apify input schema.
4. `step-04-port-sync-gui.md` — port `commands/sync/gui.md` as a cross-package consistency check across Rust + TS + Apify schemas.
5. `step-05-update-claude-md.md` — append a `## Rules` section to `CLAUDE.md` linking the imported rules.
6. `step-review.md` — review all diffs, smoke-test that the new commands and rules load, autofix any gap.
