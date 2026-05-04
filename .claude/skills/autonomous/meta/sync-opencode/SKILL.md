---
name: autonomous:meta:sync-opencode
description: WHEN syncing the .claude/ config to .opencode/ — agents, rules, and MCP servers. Only run when the .claude/ master config has changed. WHEN-NOT if invoked from any AI tool other than Claude Code.
allowed-tools: Bash(pnpm:*), Read, Edit, Glob
model: sonnet
disable-model-invocation: true
---

**Only run this command if you are Claude Code. If you are any other agent (opencode or otherwise), skip this command entirely and report it as skipped.**

Sync the Claude Code config (`.claude/`) to opencode (`.opencode/`) so opencode reflects the same agents, commands, rules, and MCP servers. The `.claude/` config is the master; `.opencode/` is a mirror.

The tool purges `.opencode/` before regenerating, ensuring stale entries are removed.

## Step SYNC: Run opencode-sync

```bash
pnpm opencode:sync
```

This runs `tools/opencode-sync` which:
- Purges `.opencode/` and recreates it
- Copies agents (with Claude-specific frontmatter stripped, `mode: subagent` added)
- Copies commands (with `allowed-tools`, `argument-hint`, `model` stripped)
- Copies rules
- Copies `CLAUDE.md` to `AGENTS.md`

## Step REVIEW: Audit opencode.json

Read `.mcp.json` and `opencode.json`, then verify and fix both sections in `opencode.json`:

**MCP servers** — every server in `.mcp.json["mcpServers"]` must appear in `opencode.json["mcp"]` with matching key name, `type`, and `url`. Add missing entries, update stale ones, remove entries no longer in `.mcp.json`.

**Instructions** — `opencode.json["instructions"]` must list exactly the `.md` files present in `.opencode/rules/`, each prefixed with `.opencode/rules/`. Add missing entries, remove stale ones. Preserve order.

Edit `opencode.json` directly to apply any fixes.

## Step REPORT: Save Report

Save `autonomous-task-output/{agent}/reports/sync-opencode-report.md` with:
- Agents synced
- Commands synced
- Rules synced
- opencode.json audit: MCP servers checked, instructions checked, changes made (if any)
- Any errors encountered
