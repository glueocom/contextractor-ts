# Step 02 — Rewrite `apify-ops` Skill

## TLDR

Make `apify-ops` an mcpc-only skill. Remove the "MCP / CLI / API" three-way tool-selection guide, replace `references/mcp-tools.md` with `references/mcpc-tools.md`, retire `references/api-endpoints.md`, and trim `references/cli-commands.md` to local-dev commands only. Touches `.claude/skills/apify-ops/`.

## Skills

- `apify-ops` (the skill being edited — read its current SKILL.md first)

## Inputs

- `../migrate-to-mcpc-notes/mcpc-tool-equivalents.md`
- `../migrate-to-mcpc-notes/live-tools-list.md` (produced by step-01)
- `../migrate-to-mcpc-notes/migration-target-inventory.md`
- `../user-entry-log/entry-qa-direct-mcp.md` (defines the no-direct-MCP stance)
- `../user-entry-log/entry-qa-scope.md` (defines what stays as `apify` CLI)

## Files

- `/Users/miroslavsekera/r/contextractor-ts/.claude/skills/apify-ops/SKILL.md`
- `/Users/miroslavsekera/r/contextractor-ts/.claude/skills/apify-ops/references/mcp-tools.md` → rename to `mcpc-tools.md`
- `/Users/miroslavsekera/r/contextractor-ts/.claude/skills/apify-ops/references/api-endpoints.md` → delete
- `/Users/miroslavsekera/r/contextractor-ts/.claude/skills/apify-ops/references/cli-commands.md` → trim

## Actions

1. **`SKILL.md`** — rewrite the body so `mcpc` is the single documented path:
   - Replace the opening line "using MCP tools, CLI, and API" with a one-line statement that mcpc is the only tool for remote operations and that `apify` CLI is reserved for local dev (run / push / login / info / whoami / create / validate-schema).
   - Drop the "Prefer mcpc for MCP tool calls" section (no longer needed once the skill is mcpc-only) and the trailing "Use direct `mcp__apify__*` calls only when..." sentence.
   - Replace the "Tool Selection Guide" table with a much smaller table that has two rows: "Remote ops (runs, builds, datasets, KV, discovery, docs)" → mcpc; "Local dev (run, push, login, ...)" → `apify` CLI.
   - Replace the "MCP Tools (Preferred for Runs & Storage)" section with "Remote Operations via mcpc" pointing to `references/mcpc-tools.md`.
   - Replace the "CLI Commands (Preferred for Builds)" section with "Local Development CLI" pointing to the trimmed `references/cli-commands.md`.
   - Delete the "API Endpoints (Alternative/Fallback)" section entirely.
   - In Prerequisites, add a one-line `mcpc connect mcp.apify.com @apify` requirement next to the existing `APIFY_TOKEN` and `apify` CLI requirements.
   - In the "New in CLI v1.x" appendix, remove every command that hits the platform remotely (`apify runs *`, `apify datasets *`, `apify key-value-stores *`, `apify builds *`, `apify actors search`, `apify actors calculate-memory`, `apify auth token`, `apify secrets ls`). Keep only commands that work without a network round-trip to the platform API (`apify upgrade`).
   - If step-01 confirmed mcpc exposes build tools, fold builds into the mcpc section and remove `apify builds *` everywhere. If not, document the build gap in one short paragraph at the bottom of `SKILL.md`.

2. **`references/mcpc-tools.md`** — create the file (rename `mcp-tools.md` → `mcpc-tools.md`, then rewrite). Mirror the existing structure (Actor Discovery, Running Actors, Monitoring Runs, Dataset Operations, Key-Value Store Operations, Documentation), but every example is `mcpc @apify tools-call <name> arg:=value` per the equivalents table. Keep the "Limitations" section but adjust it to describe limits of `mcp.apify.com`, not of the native MCP toolset.

3. **`references/api-endpoints.md`** — delete the file. Remove any links to it from the skill.

4. **`references/cli-commands.md`** — drastically shrink. Keep only:
   - Install & auth (`apify login`, `apify info`, `apify whoami`)
   - Local dev (`apify run`, `apify validate-schema`)
   - Deploy (`apify push`, `apify push --no-build`)
   - Project scaffolding (`apify create -t ...`)

   Delete every `apify builds`, `apify runs`, `apify datasets`, `apify key-value-stores`, `apify call`, `apify actors search` example. Add a one-line pointer at the top: "For remote operations (runs, datasets, KV, builds, discovery), see `mcpc-tools.md`."

## Constraints

- Use Edit for surgical changes; use Write only when renaming a file requires a new path.
- No motivational language. No code examples for things already covered in `mcpc-tools.md`.
- Keep frontmatter (`name:`, `description:`) intact — do not rename the skill.

## Done when

- `grep -r "mcp__apify__" .claude/skills/apify-ops/` returns nothing
- `grep -r "api.apify.com" .claude/skills/apify-ops/` returns nothing
- `grep -rE "apify (call|builds|runs|datasets|key-value-stores)" .claude/skills/apify-ops/` returns nothing
- `references/mcpc-tools.md` exists and references only verified tool names from step-01
- `references/api-endpoints.md` no longer exists
