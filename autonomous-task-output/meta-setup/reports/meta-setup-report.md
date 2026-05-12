# Meta Setup Audit Report

**Date:** 2026-05-12
**Branch:** feature/npm-only3

---

## Files Fixed

### Stale `npm run` → `pnpm` references

| File | Line | Change |
|------|------|--------|
| `.claude/agents/ts-pro.md` | 32 | `Run with \`npm test\`` → `Run with \`pnpm test\`` |
| `.claude/commands/autonomous/maintenance/sync/gui.md` | 52 | `npm run docs:check` → `pnpm docs:check`, `npm run docs:update` → `pnpm docs:update` |
| `.claude/commands/autonomous/maintenance/sync/docs.md` | 65 | `npm run docs:update` → `pnpm docs:update` |
| `.claude/commands/autonomous/maintenance/sync/docs.md` | 75 | `npm run docs:update` → `pnpm docs:update` |

---

## Validation Results

| Check | Result | Notes |
|-------|--------|-------|
| Agent frontmatter (name, description, tools, model) | PASS | All 8 agents valid |
| Activation keywords in agent descriptions | WARN | See flagged issues below |
| `skills:` references in agents | PASS | No agents use `skills:` field |
| MCP alignment (`.mcp.json` ↔ `enabledMcpjsonServers`) | PASS | Both reference `apify` only |
| Stale SDK methods (`chargeableWithinLimit`, `eventChargeLimitReached`) | PASS | None found |
| `mcpc` referenced in `CLAUDE.md` | PASS |  |
| `## Security` section in `CLAUDE.md` | PASS |  |
| Crawlee `llms.txt` linked in `CLAUDE.md` | PASS |  |
| `generatedBy` in `actor.json` | PASS | Value: `"claude-code"` |
| `mcpc` preference in `apify-ops` skill | PASS |  |
| Stale ESLint/Prettier/Jest/Yarn tool references | PASS | None (ESLint only appears as a named anti-pattern example in ts-pro and meta:setup commands — correct usage) |
| All commands have `description:` frontmatter | PASS |  |
| Empty directories | WARN | See flagged issues below |

---

## Flagged for Human Review

### `test-runner` agent: non-standard activation keyword

`.claude/agents/test-runner.md` description ends with `"Use after implementing features."` — this does not match the required patterns (`USE PROACTIVELY when...`, `ACTIVATE for...`, or `ALWAYS use this agent`). This may cause the orchestrator to skip invoking it automatically. Consider updating to: `"USE PROACTIVELY after implementing features or fixing bugs."`

### Empty `.claude/worktrees/` directory

`.claude/worktrees/` exists but is empty. It may be a placeholder for the `/git:add-worktree` command. Safe to delete if worktrees are managed elsewhere; keep if the command expects the directory to exist.

### 10 skills not listed in CLAUDE.md Active Skills

The following skills exist in `.claude/skills/` but are absent from the `## Active Skills` section in `CLAUDE.md`. They are likely general-purpose Apify skills installed globally, not project-specific:

- `apify-audience-analysis`
- `apify-brand-reputation-monitoring`
- `apify-competitor-intelligence`
- `apify-content-analytics`
- `apify-influencer-discovery`
- `apify-lead-generation`
- `apify-market-research`
- `apify-trend-analysis`
- `apify-ultimate-scraper`
- `skill-creator`

No action needed unless these should be surfaced to agents operating on this project.

### MCP validation script false positive

The validation diff command in the meta:setup prompt (`diff <(grep -oE '"[a-z]+":' .mcp.json...)`) produces a false positive because it matches `"type":` and `"url":` keys inside the `mcpServers.apify` HTTP config object. The actual alignment is correct — both `.mcp.json` and `settings.json` reference only the `apify` server.

### `npm install` references in Apify skills (intentional)

Several Apify skills (`apify-ops`, `apify-actorization`, `apify-actor-development`, and analytics skills) reference `npm install -g apify-cli` and `npm install -g @apify/mcpc`. These are global CLI install commands where `npm` is the conventional installer — **not** project workspace commands. No fix needed.

---

## Gaps

No missing agents or skills detected for the current technology domains (TypeScript + Rust + Crawlee + Apify + napi-rs). All CLAUDE.md-listed agents and skills resolve to actual files.
