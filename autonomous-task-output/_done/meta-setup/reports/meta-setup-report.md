---
date: 2026-05-12
agent: meta-setup
---

# Meta Setup Audit Report

## Summary

- **Files fixed**: 10
- **Validation**: All 6 checks pass
- **Orphaned skills flagged**: 10 (not deleted — require human review)
- **Numbered header violations in active files**: Resolved

---

## Files Fixed

### Formatting — Numbered Lists Converted to Bullet Points

| File | Issue |
|------|-------|
| `.claude/commands/run.md` | Steps 1–4 → bullets |
| `.claude/commands/docs/update-docs-version.md` | Steps 1–4 → bullets |
| `.claude/commands/meta/delete-prompt.md` | Steps 1–7 → bullets |
| `.claude/commands/scaffold/rust-scaffold.md` | Steps 1–6 → bullets |
| `.claude/agents/code-reviewer.md` | "When Invoked" steps 1–5 → bullets |
| `.claude/skills/apify-ops/SKILL.md` | "Fix Build Errors", "Diagnose Failed Run", "Access Run Output" steps → bullets |
| `.claude/skills/apify-actor-development/SKILL.md` | "Quick Start Workflow" steps 1–8 → bullets |
| `.claude/skills/apify-actorization/SKILL.md` | "Quick Start" and "Step 1: Analyze" numbered lists → bullets |

### Formatting — Numbered Headers Renamed to Descriptive Names

| File | Old | New |
|------|-----|-----|
| `.claude/commands/meta/setup.md` | `## 1. Inventory` | `## Step INVENTORY` |
| `.claude/commands/meta/setup.md` | `## 2. Codebase Scan` | `## Step SCAN: Codebase Scan` |
| `.claude/commands/meta/setup.md` | `## 3. Gap Analysis` | `## Step ANALYZE: Gap Analysis` |
| `.claude/commands/meta/setup.md` | `## 4. Cleanup (Interactive)` | `## Step CLEANUP: Cleanup (Interactive)` |
| `.claude/commands/meta/setup.md` | `## 5. Validate` | `## Step VALIDATE` |
| `.claude/skills/apify-actorization/SKILL.md` | `## Step 1: Analyze the Project` | `## Step ANALYZE: Analyze the Project` |
| `.claude/skills/apify-actorization/SKILL.md` | `## Step 2: Initialize Actor Structure` | `## Step INITIALIZE: Initialize Actor Structure` |
| `.claude/skills/apify-actorization/SKILL.md` | `## Step 3: Apply Language-Specific Changes` | `## Step IMPLEMENT: Apply Language-Specific Changes` |
| `.claude/skills/apify-actorization/SKILL.md` | `## Steps 4-6: Configure Schemas` | `## Step CONFIGURE: Configure Schemas` |
| `.claude/skills/apify-actorization/SKILL.md` | `## Step 7: Test Locally` | `## Step TEST: Test Locally` |
| `.claude/skills/apify-actorization/SKILL.md` | `## Step 8: Deploy` | `## Step DEPLOY: Deploy` |

---

## Validation Results

| Check | Result |
|-------|--------|
| MCP alignment (`.mcp.json` ↔ `settings.json`) | PASS — both have `apify` |
| `mcpc` referenced in `CLAUDE.md` | PASS |
| `## Security` section in `CLAUDE.md` | PASS |
| Crawlee `llms.txt` linked in `CLAUDE.md` | PASS |
| `meta.generatedBy` set in `actor.json` | PASS — value: `claude-code` |
| Stale SDK methods in skills | PASS — none found |
| `mcpc` preference in `apify-ops` skill | PASS |
| Agent frontmatter completeness | PASS — all 8 agents have valid `name`, `description`, `tools` |
| Skills listed in `CLAUDE.md` resolve to files | PASS — all 10 active skills exist |
| No `skills:` field in any agent frontmatter | PASS |

---

## Orphaned Skills — Flagged for Human Review

These 10 skills exist in `.claude/skills/` but are **not listed in `CLAUDE.md` Active Skills**. They appear to be general Apify marketplace skills, not specific to this content extraction project. None were deleted.

| Skill | Description |
|-------|-------------|
| `apify-audience-analysis` | Social media audience demographics |
| `apify-brand-reputation-monitoring` | Reviews and brand mentions across platforms |
| `apify-competitor-intelligence` | Competitor strategy and pricing analysis |
| `apify-content-analytics` | Content engagement metrics |
| `apify-influencer-discovery` | Influencer finding across social platforms |
| `apify-lead-generation` | B2B/B2C lead scraping |
| `apify-market-research` | Market conditions and geographic analysis |
| `apify-trend-analysis` | Trending content discovery |
| `apify-ultimate-scraper` | Universal AI-powered scraper |
| `skill-creator` | Guide for creating Claude Code skills |

**Recommendation**: Remove these skills if this project will not use social-media scraping capabilities. Run `/meta:delete-prompt` for each one to clean up references.

Note: the 5 orphaned skills with numbered lists (`apify-content-analytics`, `apify-market-research`, `apify-competitor-intelligence`, `apify-ultimate-scraper`, `skill-creator`) were not reformatted since they are candidates for deletion.

---

## No Gaps Found

- All agents listed in `CLAUDE.md` have corresponding `.md` files
- All active skills listed in `CLAUDE.md` have corresponding `SKILL.md` files
- MCP server `apify` is consistent across `.mcp.json` and `settings.json`
- `AGENTS.md` exists at repo root (referenced in `meta/setup.md` checklist)

---

## No Issues That Could Not Be Auto-Fixed

All identified issues were either auto-fixed (formatting violations) or flagged for human review (orphaned skills). No prompt file is written.
