# Step 06 — Update Project Root `CLAUDE.md`

## TLDR

Bring the root `CLAUDE.md` mcpc section in line with the rest of the migration: drop the line that advertises native `mcp__apify__*` tools as available, switch examples to the `@apify` session form, add a one-time setup note. Touches `/Users/miroslavsekera/r/contextractor-ts/CLAUDE.md`.

## Files

- `/Users/miroslavsekera/r/contextractor-ts/CLAUDE.md`

## Actions

1. Locate the "MCP Servers" section (currently begins with "`.mcp.json` declares one server: `apify`...").

2. Replace the example block. Current form uses bare `mcpc @apify` already — verify all examples use the persistent `@apify` session, not the inline-header form.

3. **Delete** the sentence: "Native MCP tools available: `mcp__apify__search-apify-docs`, `mcp__apify__fetch-apify-docs`, plus the full Actor / dataset / key-value-store toolkit." — per `entry-qa-direct-mcp.md`, native MCP tools are no longer a documented option.

4. **Add** a one-time setup line just above the example block:

   ```
   One-time setup: `mcpc login mcp.apify.com && mcpc connect mcp.apify.com @apify`
   ```

5. Re-read the rest of `CLAUDE.md` and confirm no other section recommends `apify call|builds|runs|datasets|key-value-stores` or `mcp__apify__*`. The "Commands" section near the top lists `apify push` and `apify login` (both keep) — leave those alone.

## Constraints

- Edit-only. Keep section ordering and formatting identical.
- Do not modify the "Active Skills" list.

## Done when

- `grep -n "mcp__apify__" CLAUDE.md` returns nothing
- The one-time setup line is present
- All `mcpc` examples use the `@apify` session form
