# Step 03 — Sweep Platform Scraper Skills

## TLDR

Update the 9 platform scraper skills so every documented `mcpc` invocation uses the persistent `@apify` session form. Replace the verbose `mcpc --json mcp.apify.com --header "Authorization: Bearer $APIFY_TOKEN"` pattern with `mcpc --json @apify`. Touches `.claude/skills/apify-{content-analytics,market-research,competitor-intelligence,ultimate-scraper,lead-generation,brand-reputation-monitoring,audience-analysis,influencer-discovery,trend-analysis}/SKILL.md`.

## Skills

- `apify-ops` for cross-skill consistency
- `code-reviewer` agent at the end of this step to confirm all 9 files use identical phrasing for the same change

## Inputs

- `../migrate-to-mcpc-notes/migration-target-inventory.md` — full file list
- `../user-entry-log/entry-qa-session-model.md` — defines the `@apify` session form

## Files

All 9 `SKILL.md` files under `.claude/skills/apify-{content-analytics,market-research,competitor-intelligence,ultimate-scraper,lead-generation,brand-reputation-monitoring,audience-analysis,influencer-discovery,trend-analysis}/`.

## Actions

1. In each `SKILL.md`, find the verbose mcpc command in the "Fetch Actor Schema" step:

   ```
   export $(grep APIFY_TOKEN .env | xargs) && mcpc --json mcp.apify.com --header "Authorization: Bearer $APIFY_TOKEN" tools-call fetch-actor-details actor:="ACTOR_ID" | jq -r ".content"
   ```

   Replace with:

   ```
   mcpc --json @apify tools-call fetch-actor-details actor:="ACTOR_ID" | jq -r '.content'
   ```

2. In each Prerequisites section, replace the bullet "`mcpc` CLI tool (for fetching Actor schemas)" with "`mcpc` CLI tool with `@apify` session connected (see `apify-ops` skill for one-time setup)".

3. Remove `.env` / `APIFY_TOKEN` bullets from Prerequisites in each skill — auth is now handled once by `mcpc login`. The `reference/scripts/run_actor.js` files still need `APIFY_TOKEN` for the `apify-client` SDK; keep a one-line note in Step 4 of each skill: "The helper script reads `APIFY_TOKEN` from `.env`." Do not edit the JS scripts themselves.

4. In Error Handling sections, replace "`APIFY_TOKEN not found` — Ask user to create `.env` with `APIFY_TOKEN=your_token`" pair-wise with two entries: one for the script (`.env` missing) and one for mcpc (`mcpc login mcp.apify.com` not done).

5. Confirm no `mcp__apify__*` references remain in any of the 9 skills (the inventory says they don't, but verify).

## Constraints

- Edit-only; do not rewrite. All 9 files share near-identical structure — keep the rewrite mechanical so the diffs read as a single sweep.
- Do not touch `reference/scripts/run_actor.js`. Out of scope.
- Do not change the Actor selection tables, output-format options, or per-platform copy.

## Done when

- `grep -rn "mcpc --json mcp.apify.com" .claude/skills/` returns nothing
- `grep -rn "Authorization: Bearer \$APIFY_TOKEN" .claude/skills/` returns nothing (the SDK scripts use the SDK's own auth, not curl)
- All 9 skills reference the `@apify` session form identically
