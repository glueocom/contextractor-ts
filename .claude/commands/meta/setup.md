---
description: Audit, cleanup, and update the .claude/ setup — agents, skills, commands, rules, MCP servers, settings. No args = full audit. With path = fix specific file/folder.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: [path to .md file or folder in .claude/]
model: sonnet
---

# Claude Setup — Audit & Fix

Audit `.claude/`, `CLAUDE.md`, `.mcp.json`, `settings.json`. Does NOT touch `prompts/` or source code.

No args = full audit. With path = fix that file/folder only.

## Step INVENTORY

Run in parallel:

```bash
# Line counts for all .claude/ content
for f in .claude/agents/*.md; do echo "$(wc -l < "$f") $f"; done
for f in .claude/skills/*/SKILL.md; do echo "$(wc -l < "$f") $f"; done
find .claude/commands -name "*.md" -exec sh -c 'echo "$(wc -l < "$1") $1"' _ {} \;
```

Also read: `CLAUDE.md`, `.claude/settings.json`, `.mcp.json`, `.claude/rules/*.md`.

In path-specific mode, read only the target — skip to step 3.

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

## Step CLEANUP: Cleanup (Interactive)

Present findings in a table (file, lines, issue) and use `AskUserQuestion` to confirm: **delete**, **keep**, or **trim**.

After confirmation:
- Delete confirmed files, remove empty directories
- Fix invalid frontmatter and stale references
- Trim bloated files
- Sync `.mcp.json` ↔ `settings.json`

## Step VALIDATE

```bash
# Skill references resolve
grep -h "^skills:" .claude/agents/*.md | tr ',' '\n' | sed 's/skills: //' | xargs -I{} test -f .claude/skills/{}/SKILL.md

# MCP alignment
diff <(grep -oE '"[a-z]+":' .mcp.json | tr -d '":' | sort) \
     <(grep -A20 enabledMcpjsonServers .claude/settings.json | grep '"' | tr -d ' ",' | sort)

# CLAUDE.md MCP server list matches .mcp.json keys
diff <(grep -oE '\*\*[A-Za-z]+\*\*' CLAUDE.md | tr -d '*' | tr '[:upper:]' '[:lower:]' | sort) \
     <(grep -oE '"[a-z]+":' .mcp.json | tr -d '":' | sort)

# No stale SDK methods in skills
grep -rn 'chargeableWithinLimit\|eventChargeLimitReached(' .claude/skills/ && echo "WARN: stale SDK methods found"

# CLAUDE.md has mcpc usage block
grep -q 'mcpc' CLAUDE.md && echo "OK: mcpc referenced" || echo "MISSING: mcpc usage in CLAUDE.md"

# CLAUDE.md has Security section
grep -q '## Security' CLAUDE.md && echo "OK: Security section" || echo "MISSING: Security section in CLAUDE.md"

# CLAUDE.md has Crawlee llms.txt links
grep -q 'crawlee.dev/llms' CLAUDE.md && echo "OK: Crawlee docs linked" || echo "MISSING: Crawlee llms.txt in CLAUDE.md"

# actor.json has generatedBy
grep -q 'generatedBy' .actor/actor.json && echo "OK: generatedBy set" || echo "MISSING: generatedBy in actor.json"

# apify-ops skill has mcpc preference
grep -q 'mcpc' .claude/skills/apify-ops/SKILL.md && echo "OK: mcpc in apify-ops" || echo "MISSING: mcpc preference in apify-ops"
```

Report summary: files deleted, created, modified, trimmed, validation issues.
