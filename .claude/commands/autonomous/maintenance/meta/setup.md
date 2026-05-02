---
description: Autonomously audit and fix .claude/ setup — frontmatter, stale references, MCP alignment, CLAUDE.md consistency. Saves report to autonomous-task-output/{agent}/.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---

Audit `.claude/`, `CLAUDE.md`, `.mcp.json`, `settings.json`. Auto-fix safe issues (frontmatter, stale references, MCP alignment). Flag risky changes (file deletion, trim) for human review. Save a report to `autonomous-task-output/{agent}/`.

## Step INVENTORY

Run in parallel:

```bash
for f in .claude/agents/*.md; do echo "$(wc -l < "$f") $f"; done
for f in .claude/skills/*/SKILL.md; do echo "$(wc -l < "$f") $f"; done
find .claude/commands -name "*.md" -exec sh -c 'echo "$(wc -l < "$1") $1"' _ {} \;
```

Also read: `CLAUDE.md`, `.claude/settings.json`, `.mcp.json`, `.claude/rules/*.md`.

## Step SCAN: Codebase Scan

Read `package.json`, `src/` files, `.actor/actor.json` to build a technology domain map. Identify frameworks, tools, and key domains actually in use.

## Step ANALYZE: Gap Analysis

Compare inventory against codebase. Find:

**Cleanup candidates:**
- Orphaned agents/skills for technologies not in this repo
- Commands referencing paths/projects that don't exist here
- Stale references to removed tools (e.g., ESLint when using Biome)
- Bloated files over 100 lines — trim generic content, keep actionable parts
- `CLAUDE.md` referencing agents/skills/MCP servers that don't exist as files or `.mcp.json` entries
- `.mcp.json` ↔ `settings.json` `enabledMcpjsonServers` misalignment (every key in one must appear in the other)
- `.mcp.json` stale tool category names — verify `--tools` flags match current MCP server docs
- `.mcp.json` deprecated transport — prefer `type: http` with hosted URL over stdio `npx` when available
- Skills with stale SDK API references — grep for method names and verify against installed package versions
- `CLAUDE.md` missing mcpc usage block under MCP servers section — agents should prefer mcpc over direct MCP tool calls
- `CLAUDE.md` missing `## Security` section with scraped-data handling rules
- `CLAUDE.md` missing Crawlee llms.txt resource links
- `.actor/actor.json` missing or stale `meta.generatedBy` field
- `apify-ops` skill missing mcpc-preference section before Tool Selection Guide

**Gaps:**
- Missing agents for technology domains in use
- Missing skills for patterns used repeatedly
- `CLAUDE.md` not listing all actual agents/skills/MCP servers

**Frontmatter validation:**
- Agents: must have `name`, `description` (with activation keywords like `Use PROACTIVELY`/`Use when`/`Use for`), `tools`, `model`
- Agent `tools:` must include file access tools (Read, Write, Edit) if the agent writes code
- Skills: must have `name`, `description`
- Commands: must have `description`
- All `skills:` references in agents must resolve to `.claude/skills/{name}/SKILL.md`

## Step FIX: Auto-fix Safe Issues

Apply fixes immediately without confirmation:
- Fix invalid or incomplete frontmatter in agents, skills, commands
- Fix stale tool references (e.g., ESLint → Biome)
- Sync `.mcp.json` ↔ `settings.json` `enabledMcpjsonServers` alignment
- Fix stale SDK method references in skills
- Fix missing `meta.generatedBy` in `actor.json`
- Remove empty directories

Do NOT auto-delete agent or skill files, and do NOT trim bloated files — flag these in the report instead.

## Step VALIDATE

```bash
grep -h "^skills:" .claude/agents/*.md 2>/dev/null | tr ',' '\n' | sed 's/skills: //' | xargs -I{} sh -c 'test -f ".claude/skills/{}/SKILL.md" && echo "OK: {}" || echo "MISSING: {}"'

diff <(grep -oE '"[a-z]+":' .mcp.json | tr -d '":' | sort) \
     <(grep -A20 enabledMcpjsonServers .claude/settings.json | grep '"' | tr -d ' ",' | sort) \
  && echo "OK: MCP alignment" || echo "WARN: MCP alignment mismatch"

grep -rn 'chargeableWithinLimit\|eventChargeLimitReached(' .claude/skills/ \
  && echo "WARN: stale SDK methods found" || echo "OK: no stale SDK methods"

grep -q 'mcpc' CLAUDE.md && echo "OK: mcpc referenced" || echo "MISSING: mcpc usage in CLAUDE.md"
grep -q '## Security' CLAUDE.md && echo "OK: Security section" || echo "MISSING: Security section in CLAUDE.md"
grep -q 'crawlee.dev/llms' CLAUDE.md && echo "OK: Crawlee docs linked" || echo "MISSING: Crawlee llms.txt in CLAUDE.md"
grep -q 'generatedBy' .actor/actor.json && echo "OK: generatedBy set" || echo "MISSING: generatedBy in actor.json"
grep -q 'mcpc' .claude/skills/apify-ops/SKILL.md && echo "OK: mcpc in apify-ops" || echo "MISSING: mcpc preference in apify-ops"
```

## Step REPORT: Save Report

Save `autonomous-task-output/{agent}/reports/meta-setup-report.md` with:
- Files fixed (frontmatter, stale references, MCP alignment)
- Orphaned or bloated files flagged for human review (do not delete)
- Validation results (pass/fail per check)
- Gaps identified (missing agents/skills)
- Any issues that could not be auto-fixed (save to `autonomous-task-output/{agent}/prompts/meta-setup-prompt.md`)
