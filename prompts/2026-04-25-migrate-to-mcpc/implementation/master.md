# Migrate `.claude/` to mcpc

## TLDR

Make `mcpc` the single documented way to talk to the Apify platform from skills, agents, and slash commands at `/Users/miroslavsekera/r/contextractor-ts/.claude/`. Strip every `mcp__apify__*` example, every `apify call|runs|builds|datasets|key-value-stores` invocation, and every raw `api.apify.com` curl. Local-dev `apify` CLI commands (`run`, `push`, `login`, `info`, `whoami`, `create`, `validate-schema`) stay. The `apify-client` Node SDK in `skills/*/reference/scripts/run_actor.js` stays — out of scope.

## Why

`@apify/mcpc` (<https://github.com/apify/mcpc>, latest v0.2.6) is officially supported by Apify and exposes every remote Apify operation through `mcp.apify.com`. It replaces the three documentation surfaces currently maintained in parallel — direct MCP, CLI remote calls, and raw API — with one. Less drift, fewer permission prompts, less context spent loading native MCP schemas. Background and rationale: see `../user-entry-log/entry-initial-prompt.md` and the three Q&A files alongside it.

## Skills and Agents

Activate during execution:

- `apify-ops` — guides every step that documents Apify platform operations
- `apify-actor-development` — applies to step-04 actor-dev skill scrub
- `meta:setup` (slash command at `commands/meta/setup.md`) — invoke after edits to re-validate the `.claude/` setup

Use as implementers / reviewers:

- `general-purpose` agent — can do any of the search-and-edit steps below
- `code-reviewer` agent — final review pass for consistency across the 9 platform-skill rewrites

No language-specific reviewer is needed — this work edits Markdown only.

## Shared context

- Repo root: `/Users/miroslavsekera/r/contextractor-ts/`
- All edits land under `.claude/` and the project-root `CLAUDE.md`
- `.mcp.json` and `settings.json` `enabledMcpjsonServers` stay untouched — the MCP server registration is what makes `@apify` discoverable to mcpc
- Canonical equivalent table: `../migrate-to-mcpc-notes/mcpc-tool-equivalents.md`
- File inventory: `../migrate-to-mcpc-notes/migration-target-inventory.md`
- mcpc capability and version note: `../migrate-to-mcpc-notes/mcpc-capability.md`

## Steps

1. `step-01-prereqs.md` — verify mcpc install (≥ v0.2.6), run `mcpc login` and `mcpc connect mcp.apify.com @apify`, list remote tool names so later steps can use the verified names.
2. `step-02-apify-ops-skill.md` — rewrite the `apify-ops` skill: drop `mcp__apify__*` reference, retire `api-endpoints.md`, split `cli-commands.md` into local-dev only, replace `mcp-tools.md` with `mcpc-tools.md`.
3. `step-03-platform-skills.md` — sweep the 9 platform scraper skills, replace verbose `mcpc --header ...` calls with `mcpc @apify ...`.
4. `step-04-actor-dev-skills.md` — scrub `apify-actor-development` and `apify-actorization` skills of `mcp__apify__*` and remote-API guidance.
5. `step-05-agents-commands.md` — update `commands/platform/push-and-get-working.md` (only file with non-local `apify` calls) and any other slash command that calls remote ops; verify `agents/test-runner.md` and `commands/run.md` need no change.
6. `step-06-claude-md.md` — update root `CLAUDE.md` "Prefer the `mcpc` CLI" block: drop the native `mcp__apify__*` mention, switch examples to `@apify` session form.
7. `step-review.md` — review all diffs against user intent, run `mcpc @apify tools-list` smoke check, grep for residual `mcp__apify__` / `apify call` / `apify runs` / `apify builds` / `apify datasets` / `apify key-value-stores` / `api.apify.com` references and autofix.
