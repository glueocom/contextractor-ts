# Files in `.claude/` That Reference CLI / API / MCP

Inventory taken 2026-04-25 from `/Users/miroslavsekera/r/contextractor-ts/.claude/`.

## Skills — `apify-ops` (primary target)

Wholesale rewrite of CLI/API/MCP guidance.

- `skills/apify-ops/SKILL.md` — has a "Tool Selection Guide" table that lists MCP / CLI / API per operation. Replace with mcpc-only guidance plus a "Local Dev (apify CLI)" carve-out.
- `skills/apify-ops/references/mcp-tools.md` — entirely `mcp__apify__*` examples. Replace with `skills/apify-ops/references/mcpc-tools.md` showing the same operations as `mcpc @apify tools-call ...`.
- `skills/apify-ops/references/api-endpoints.md` — raw REST examples. Delete or shrink to a one-paragraph "fallback" pointer.
- `skills/apify-ops/references/cli-commands.md` — mixes local-dev (`apify run`, `apify push`, `apify login`, `apify info`) with remote ops (`apify builds ls`, `apify runs ls`, `apify datasets`). Trim to local-dev only; everything else moves to `mcpc-tools.md`.

## Skills — platform scrapers (9 files, parallel updates)

Each already references `mcpc` but with the verbose inline-header form. Convert to the `@apify` session form.

- `skills/apify-content-analytics/SKILL.md`
- `skills/apify-market-research/SKILL.md`
- `skills/apify-competitor-intelligence/SKILL.md`
- `skills/apify-ultimate-scraper/SKILL.md`
- `skills/apify-lead-generation/SKILL.md`
- `skills/apify-brand-reputation-monitoring/SKILL.md`
- `skills/apify-audience-analysis/SKILL.md`
- `skills/apify-influencer-discovery/SKILL.md`
- `skills/apify-trend-analysis/SKILL.md`

Common pattern to replace (verbatim across all 9):

```
export $(grep APIFY_TOKEN .env | xargs) && mcpc --json mcp.apify.com --header "Authorization: Bearer $APIFY_TOKEN" tools-call fetch-actor-details actor:="ACTOR_ID" | jq -r ".content"
```

becomes:

```
mcpc --json @apify tools-call fetch-actor-details actor:="ACTOR_ID" | jq -r '.content'
```

Each skill also has `reference/scripts/run_actor.js` using `apify-client` SDK. Decision per QA: **keep** the JS scripts as-is for now — replacement is out of scope.

## Skills — actor development / actorization

- `skills/apify-actor-development/SKILL.md` — has a "MCP integration" mention plus mixed CLI usage (`apify create`, `apify run`, `apify push`, `apify login`). Keep all `apify` CLI usage (local-dev). Strip any reference to `mcp__apify__*`.
- `skills/apify-actor-development/references/output-schema.md` — minor `mcp__apify__*` mentions to scrub.
- `skills/apify-actorization/SKILL.md` and `references/schemas-and-output.md` and `references/cli-actorization.md` — mostly local-dev `apify create / run / push`; verify no remote-API guidance remains.

## Agents

- `agents/test-runner.md` — only uses `apify run` (local). Already mcpc-clean.

## Commands

- `commands/run.md` — `apify run` (local). Clean.
- `commands/local-tests/prompt.md` — `cargo`-only. Clean.
- `commands/platform/push-and-get-working.md` — uses `apify info`, `apify push` (keep), but also `apify builds ls`, `apify builds log`, `apify call`, `apify runs ls`, `apify runs log`. Replace remote-call lines with mcpc.

## Project root

- `CLAUDE.md` — already has a "Prefer the `mcpc` CLI" block that lists native `mcp__apify__*` as available. Update to match the new no-direct-MCP stance: drop the "Native MCP tools available: `mcp__apify__*`..." sentence; update example commands to use `@apify` session form.

## What stays

- `.mcp.json` — keep. The MCP server registration is what makes `@apify` discoverable.
- All `Bash(apify:*)` `allowed-tools` permissions in command frontmatter — extend with `Bash(mcpc:*)` rather than replace.
