# Step 04 — Scrub Actor-Dev and Actorization Skills

## TLDR

Strip residual `mcp__apify__*` mentions and remote-API guidance from `apify-actor-development` and `apify-actorization`. Local-dev `apify` CLI commands stay (per `entry-qa-scope.md`). Touches `.claude/skills/apify-actor-development/` and `.claude/skills/apify-actorization/`.

## Skills

- `apify-actor-development` and `apify-actorization` (the skills being edited)

## Files

- `.claude/skills/apify-actor-development/SKILL.md`
- `.claude/skills/apify-actor-development/references/output-schema.md`
- `.claude/skills/apify-actorization/SKILL.md`
- `.claude/skills/apify-actorization/references/cli-actorization.md`
- `.claude/skills/apify-actorization/references/schemas-and-output.md`
- `.claude/skills/apify-actorization/references/js-ts-actorization.md`
- `.claude/skills/apify-actorization/references/python-actorization.md`

## Actions

1. In each file, find every `mcp__apify__*` reference and replace it with the equivalent `mcpc @apify tools-call <name> ...` form per `../migrate-to-mcpc-notes/mcpc-tool-equivalents.md`. If the surrounding paragraph is about MCP integration as a concept (not a specific call), rewrite it to describe Actors as MCP-callable tools without showing native `mcp__apify__*` syntax.

2. Find every `apify call`, `apify runs *`, `apify builds *`, `apify datasets *`, `apify key-value-stores *`, and curl against `api.apify.com` invocation. Replace with the mcpc equivalent.

3. Keep all of these CLI commands intact wherever they appear:
   - `apify create -t <template>`
   - `apify run`
   - `apify push`
   - `apify push --no-build`
   - `apify login` / `apify login -t $APIFY_TOKEN`
   - `apify info` / `apify whoami`
   - `apify validate-schema`
   - `apify --help`

4. In `apify-actor-development/SKILL.md`, the Prerequisites & Setup section is mostly about logging the `apify` CLI in. Add one line: "For remote operations (run monitoring, dataset access, build inspection), use `mcpc` — see the `apify-ops` skill."

## Constraints

- Edit-only.
- Do not modify input/output/dataset schema reference content (those describe schema fields, not platform calls).
- Keep all template names (`project_empty`, `ts_empty`, `python-empty`) unchanged.

## Done when

- `grep -rn "mcp__apify__" .claude/skills/apify-actor-development .claude/skills/apify-actorization` returns nothing
- `grep -rnE "apify (call|runs|builds|datasets|key-value-stores)" .claude/skills/apify-actor-development .claude/skills/apify-actorization` returns nothing
- `grep -rn "api.apify.com" .claude/skills/apify-actor-development .claude/skills/apify-actorization` returns nothing
