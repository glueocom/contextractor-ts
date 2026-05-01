---
description: Sync the .claude/ config to .opencode/ — agents, commands, rules, MCP servers
---

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
- Regenerates `opencode.json` with MCP servers and instruction paths from rules

## Step REPORT: Save Report

Save `autonomous-task-output/sync-opencode-report.md` with:
- Agents synced
- Commands synced
- Rules synced
- MCP servers written to `opencode.json`
- Any errors encountered
