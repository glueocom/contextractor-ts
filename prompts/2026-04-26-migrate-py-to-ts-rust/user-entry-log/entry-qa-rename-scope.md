# QA — Rename scope

## Question

The raw prompt asks to rename `apps/contextractor` → `apps/contextractor-apify` and add `apps/contextractor-standalone`. CLAUDE.md, both `sync/*` commands, README, and Dockerfile paths all reference `apps/contextractor`. Should the rename land in this prompt?

## Answer

**Rename + update all references.**

## Implication

- `git mv apps/contextractor apps/contextractor-apify` (preserves history).
- New directory `apps/contextractor-standalone/` propagated from source.
- Update every reference to the old path:
  - `CLAUDE.md` — Project Structure block, Commands block, Production Protection, MCP Servers, Resources.
  - `.claude/commands/sync/docs.md` and `.claude/commands/sync/gui.md` — every `apps/contextractor/` path becomes `apps/contextractor-apify/`.
  - `.claude/commands/platform/push-and-get-working.md` (if it hard-codes a path).
  - `.claude/commands/local-tests/prompt.md`, `.claude/commands/platform-tests/*.md` (if they hard-code a path).
  - Root `README.md`, root `Dockerfile` (if it `COPY`s from `apps/contextractor/`).
  - Workspace `Cargo.toml` `members = [...]` once Rust scaffolding lands.
- Add new docs sections covering `apps/contextractor-standalone`.
