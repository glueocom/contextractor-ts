# Meta Setup Audit Report

**Date**: 2026-05-03  
**Branch**: dev  
**Audit scope**: `.claude/`, `CLAUDE.md`, `.mcp.json`, `settings.json`

---

## Validation Results

| Check | Result |
|-------|--------|
| MCP `.mcp.json` ↔ `settings.json` alignment | PASS — both have `apify` only |
| `CLAUDE.md` mcpc usage block | PASS |
| `CLAUDE.md` `## Security` section | PASS |
| `CLAUDE.md` Crawlee llms.txt link | PASS |
| `actor.json` `meta.generatedBy` | PASS — set to `"claude-code"` |
| `apify-ops` mcpc preference section | PASS |
| Stale SDK methods (`chargeableWithinLimit`, `eventChargeLimitReached`) | PASS — none found |
| Agent frontmatter (`name`, `description`, `tools`) | PASS — all 8 agents valid |
| Agent `model` assignments | PASS — haiku/sonnet/unspecified match knowledge base |
| `skills:` references in agents | PASS — no dangling references |
| CLAUDE.md agent list vs agent files | PASS — all 8 agents listed and present |

---

## Files Fixed

None. All auto-fixable checks passed without intervention.

---

## Flags for Human Review

### Unlisted Skills (not in `CLAUDE.md` Active Skills)

These 10 skills are present in `.claude/skills/` but not referenced in `CLAUDE.md`. They appear to be generic Apify analysis/marketing skills that may have been installed from a shared library but are not relevant to this project (a content extraction Actor):

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

**Recommended action**: Review and remove skills unrelated to this project. `skill-creator` may be worth keeping as a meta-skill. The nine `apify-*` analysis/marketing skills are unlikely to be used in a content extraction Actor.

### `apify-actor-development` — Stale `generatedBy` Instruction

`.claude/skills/apify-actor-development/SKILL.md` line 8 instructs agents:

> "Before you begin, fill in the `generatedBy` property in the meta section of `.actor/actor.json`. Replace it with the tool and model you're currently using, such as 'Claude Code with Claude Sonnet 4.6'."

The current `actor.json` already has `"generatedBy": "claude-code"` (static). This instruction would cause agents to overwrite it on every invocation with a dynamic value (e.g., "Claude Code with Claude Sonnet 4.6"). Decide whether to:
- Keep the static value and remove the instruction from the skill
- Accept dynamic updates and document the expected format ("Claude Code with Claude Sonnet 4.6")

### Large Skill Files (> 200 lines)

| File | Lines | Note |
|------|-------|------|
| `skill-creator/SKILL.md` | 318 | Generic skill-writing guide — review if used |
| `apify-ultimate-scraper/SKILL.md` | 232 | Generic scraper skill — not used in this project |
| `rust-performance-optimization/SKILL.md` | 192 | Actively used — size is appropriate |
| `apify-actor-development/SKILL.md` | 190 | Actively used — size is appropriate |

---

## Gaps Identified

None. All agents listed in `CLAUDE.md` exist as files, and all validation checks passed. The project is well-configured for its technology stack (TypeScript + Rust + Apify).

---

## Summary

Configuration is clean. The only actionable items are the 10 unlisted skills that should be pruned, and the ambiguous `generatedBy` instruction in `apify-actor-development`. No auto-fixes were needed.
