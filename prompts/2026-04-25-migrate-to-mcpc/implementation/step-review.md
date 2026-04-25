# Step Review — Verify, Test, Autofix

## TLDR

Run the migration through a verification pass: confirm every requirement in `entry-initial-prompt.md` is reflected in the diff, every Q&A decision is honored, no stray references survived, and `mcpc` actually works against `mcp.apify.com`. Autofix any mismatch.

## Skills and Agents

- `code-reviewer` agent (subagent) — independent read of the full diff
- `apify-ops` skill — for spot-checking that the rewritten `apify-ops` skill is still internally consistent

## Inputs (read all)

- `../user-entry-log/entry-initial-prompt.md` — original user request
- `../user-entry-log/entry-qa-scope.md` — Remote ops only
- `../user-entry-log/entry-qa-direct-mcp.md` — Remove direct MCP entirely
- `../user-entry-log/entry-qa-session-model.md` — Pre-connect once
- All step files in this directory
- `../migrate-to-mcpc-notes/migration-target-inventory.md`
- `../migrate-to-mcpc-notes/mcpc-tool-equivalents.md`
- `../migrate-to-mcpc-notes/live-tools-list.md`

## Actions

1. **Capture the diff:**

   ```
   git diff --stat
   git diff
   ```

   Save the full diff for cross-reference.

2. **Per-step verification.** For each step file:
   - Read the step's "Done when" block.
   - Run each grep / shell check listed there. Every check must pass.
   - For any check that fails, autofix the offending file and re-run.

3. **Requirement coverage.** For each requirement in `entry-initial-prompt.md`:
   - "research does apify already fully support this?" → confirmed in `migrate-to-mcpc-notes/mcpc-capability.md`. ✓
   - "the new mcpc is used instead of CLI, Api and MCP in skills agents at .claude" → verify with the global grep below.
   - Verify the migration honored the "remote ops only" scope (CLI commands `apify run`, `apify push`, `apify login`, `apify info`, `apify whoami`, `apify create`, `apify validate-schema` must still appear where they did before, unchanged).

4. **Q&A coverage.** For each `../user-entry-log/entry-qa-*.md`:
   - `entry-qa-scope.md` — local-dev `apify` calls preserved. Sample: `grep -rn "apify run" .claude/` and `grep -rn "apify push" .claude/` should still return the same hits as before migration (modulo cosmetic edits).
   - `entry-qa-direct-mcp.md` — `grep -rn "mcp__apify__" .claude/ CLAUDE.md` must return zero.
   - `entry-qa-session-model.md` — `grep -rn "mcpc --json mcp.apify.com" .claude/ CLAUDE.md` must return zero; `mcpc @apify` must be the only documented form.

5. **Global grep guards** — these must each return nothing:

   ```
   grep -rn "mcp__apify__" .claude/ CLAUDE.md
   grep -rnE "apify (call|builds|runs|datasets|key-value-stores)" .claude/ CLAUDE.md
   grep -rn "api.apify.com" .claude/ CLAUDE.md
   grep -rn "Authorization: Bearer \$APIFY_TOKEN" .claude/
   ```

   Permitted exception: `skills/*/reference/scripts/run_actor.js` and any prose that explicitly references those JS scripts — they are out of scope per `entry-qa-scope.md`.

6. **Live smoke test.** After all docs edits, confirm mcpc still works:

   ```
   mcpc --version
   mcpc @apify tools-list | head -5
   mcpc --json @apify tools-call search-apify-docs query:="actor input schema" limit:=2 | jq '.content | length'
   ```

   All three must succeed.

7. **Independent review.** Spawn the `code-reviewer` agent with the full diff and `entry-initial-prompt.md`. Brief it: "Confirm every remote Apify operation in `.claude/` and `CLAUDE.md` is now invoked through `mcpc`, every native `mcp__apify__*` reference is gone, every local-dev `apify` CLI call is preserved, and the 9 platform skills use identical phrasing for the schema-fetch step." Apply the agent's findings.

8. **Autofix loop.** Any failing grep, broken example, or contradiction with a Q&A entry → fix in place, re-run the affected check. Repeat until all checks pass.

## Done when

- All step "Done when" blocks pass
- All global grep guards return nothing (modulo the JS-script exception)
- `mcpc @apify tools-list` succeeds against the live server
- `code-reviewer` agent reports no gaps
- `git diff` is internally consistent — no half-edited file
