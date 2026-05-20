# Meta Setup Audit Report

**Date:** 2026-05-20
**Audited:** `.claude/`, `CLAUDE.md`, `.mcp.json`, `settings.json`

---

## Files Fixed

None. All auto-fixable checks passed — no changes required.

---

## Validation Results

| Check | Result |
|-------|--------|
| Agent frontmatter (name, description, tools, model) | PASS — all 8 agents valid |
| Skill frontmatter (name, description) | PASS — all 20 skills valid |
| Command frontmatter (description) | PASS — all 33 commands valid |
| MCP alignment (.mcp.json ↔ enabledMcpjsonServers) | PASS — `apify` in both |
| Stale SDK methods (chargeableWithinLimit, eventChargeLimitReached) | PASS — none found |
| CLAUDE.md: mcpc usage block | PASS |
| CLAUDE.md: Security section | PASS |
| CLAUDE.md: Crawlee llms.txt resource link | PASS |
| actor.json: meta.generatedBy field | PASS — `"claude-code"` |
| apify-ops skill: mcpc preference section | PASS |
| Agents: no `skills:` frontmatter field | PASS |
| Stale ESLint/Prettier refs | PASS — all mentions are exclusions, not usage |

---

## Orphaned Skills Flagged for Human Review

The following 10 skills exist in `.claude/skills/` but are **not listed** in `CLAUDE.md`'s Active Skills section and have **no references** in any agent, command, or CLAUDE.md. They appear to be generic Apify marketplace/business-intelligence skills from a starter template, not relevant to developing a web content extraction Actor.

- `apify-audience-analysis` — audience demographics across social platforms
- `apify-brand-reputation-monitoring` — reviews, ratings, brand mentions
- `apify-competitor-intelligence` — competitor analysis across platforms
- `apify-content-analytics` — engagement metrics, campaign ROI
- `apify-influencer-discovery` — influencer search and evaluation
- `apify-lead-generation` — B2B/B2C lead scraping
- `apify-market-research` — market conditions and geographic data
- `apify-trend-analysis` — trend discovery across social platforms
- `apify-ultimate-scraper` — universal AI-powered scraper skill
- `skill-creator` — generic guide for creating skills

**Recommendation:** Delete these 10 skills unless you plan to use this repo for Apify marketplace operations or content strategy work. They add noise to the skills list and may cause the model to suggest irrelevant skills. Run `rm -rf .claude/skills/{apify-audience-analysis,apify-brand-reputation-monitoring,apify-competitor-intelligence,apify-content-analytics,apify-influencer-discovery,apify-lead-generation,apify-market-research,apify-trend-analysis,apify-ultimate-scraper,skill-creator}` to remove them.

---

## Gaps Identified

None. All agents and skills listed in CLAUDE.md exist as files. No missing agents for active technology domains.

---

## Issues That Could Not Be Auto-Fixed

None. The orphaned skills are flagged for human review — they require a deliberate decision before deletion.
