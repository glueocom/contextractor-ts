# Step 05 — Update Agents and Slash Commands

## TLDR

Replace remote `apify` CLI calls (`apify call`, `apify builds *`, `apify runs *`) in slash commands with mcpc. Keep all local-dev `apify` calls. Verify no agent/command still references native `mcp__apify__*` tools. Touches `.claude/agents/` and `.claude/commands/`.

## Skills

- `apify-ops` — for command equivalents

## Files

- `.claude/commands/platform/push-and-get-working.md` — primary edit target
- `.claude/commands/run.md` — verify clean (only uses local `apify run`)
- `.claude/commands/local-tests/prompt.md` — verify clean (cargo only)
- `.claude/agents/test-runner.md` — verify clean (uses local `apify run` only)
- All other files under `.claude/commands/` — sweep for remote calls

## Actions

1. **`commands/platform/push-and-get-working.md`** — primary changes:
   - In `allowed-tools` frontmatter, add `Bash(mcpc:*)`. Keep `Bash(*)` if already present; otherwise extend the explicit list.
   - Step "Wait for Build" — replace `apify builds ls --limit 3` with `mcpc --json @apify tools-call get-actor-build-list limit:=3 actor:="<TARGET_ACTOR>"`. If step-01 confirmed `mcp.apify.com` does not expose build tools, keep `apify builds ls` and add a note.
   - Step "Check Build Result / FAILED" — replace `apify builds log <BUILD_ID>` with `mcpc --json @apify tools-call get-actor-build-log buildId:="<BUILD_ID>"` (same fallback rule).
   - Step "Run Test Crawl" — replace `apify call <TARGET_ACTOR> --input '<json>'` with the two-step mcpc form per the equivalents table:

     ```
     mcpc @apify tools-call call-actor actor:="<TARGET_ACTOR>" step:="info"
     mcpc --json @apify tools-call call-actor actor:="<TARGET_ACTOR>" step:="call" input:='<json>'
     ```

   - Step "Inspect dataset / If RUN SUCCEEDED" — replace `apify runs ls --limit 3` with `mcpc --json @apify tools-call get-actor-run-list actor:="<TARGET_ACTOR>" limit:=3 desc:=true`.
   - Step "If RUN FAILED" — replace `apify runs log <RUN_ID>` with `mcpc --json @apify tools-call get-actor-log runId:="<RUN_ID>" lines:=200`.
   - **Keep** `apify info`, `apify push`, `apify push shortc/contextractor*` exactly as-is — they are local-dev / deploy commands.

2. **Sweep remaining commands** — `grep -rnE "apify (call|builds|runs|datasets|key-value-stores)|mcp__apify__|api\\.apify\\.com" .claude/commands/`. For every hit, apply the same translation. Confirm `commands/run.md` and `commands/local-tests/prompt.md` and `commands/validate.md` need no edits.

3. **Agents** — `grep -rnE "apify (call|builds|runs|datasets|key-value-stores)|mcp__apify__|api\\.apify\\.com" .claude/agents/`. Expected: zero hits. If any appear, translate.

4. In any command frontmatter that has restrictive `allowed-tools` (`Bash(apify:*)`), extend with `Bash(mcpc:*)` so the new commands run without a permission prompt. Match user-style allowlist precedent in `settings.json`.

## Constraints

- Edit-only.
- Do not change any `apify run`, `apify push`, `apify info`, `apify whoami`, `apify login` invocation.
- Polling sleep / loop logic in `push-and-get-working.md` stays — only the inner command changes.

## Done when

- `grep -rnE "apify (call|builds|runs|datasets|key-value-stores)" .claude/agents .claude/commands` returns nothing
- `grep -rn "mcp__apify__" .claude/agents .claude/commands` returns nothing
- `grep -rn "api.apify.com" .claude/agents .claude/commands` returns nothing
- `Bash(mcpc:*)` appears in `allowed-tools` of every command that previously had `Bash(apify:*)` for remote ops
