research does Apify already fully support this? https://github.com/apify/mcpc
if yes, write a prompt to set up '/Users/miroslavsekera/r/contextractor-ts/.claude' so the new mcpc is used instead of direct MCP references, raw API usage, and `apify call` where mcpc has a real equivalent in skills and agents at '/Users/miroslavsekera/r/contextractor-ts/.claude'

---

## Key Decisions

**Direct MCP**: Strip every `mcp__apify__*` example and reference. Agents use `mcpc` from Bash only. `.mcp.json` stays (it configures the `apify` MCP server; `mcpc connect mcp.apify.com @apify` makes `@apify` discoverable).

**Scope**: Use `mcpc` for remote ops that the live `@apify` session exposes. Keep `apify` CLI for local dev: `run`, `push`, `login`, `info`, `create`, `validate-schema`. Replace `mcp__apify__*`, `apify call`, and raw API curl with `mcpc` where a real equivalent exists. Keep `apify builds`, `apify runs`, `apify datasets`, and `apify key-value-stores` where the live `@apify` session does not expose equivalents.

**Pivot**: The current live `@apify` session exposes only 8 tools. Docs mention more optional/dynamic tools (`add-actor`, run-list, run-log, dataset/KV ops), but they are NOT exposed in this live session. Use `mcpc` where a real equivalent exists; keep `apify` CLI elsewhere.

**Session model**: One-time `mcpc login mcp.apify.com && mcpc connect mcp.apify.com @apify`. All examples use `mcpc @apify ...`. No inline `--header "Authorization: Bearer $APIFY_TOKEN"` in docs.

---

## Live Tools (verified 2026-04-29, apify-mcp-server v0.9.20, mcpc v0.2.6)

**Available (8)**: `search-actors`, `fetch-actor-details`, `call-actor` (`input:=<json>`, optional `async:=true|false`, optional `previewOutput:=true|false`, optional `callOptions:=<json>`), `get-actor-run`, `get-actor-output`, `search-apify-docs`, `fetch-apify-docs`, `apify--rag-web-browser`

**NOT exposed in the live `@apify` session**: `add-actor`, `get-actor-run-list`, `get-actor-log`, dataset/KV/build tools.

---

## Translation Table

| Operation | Command |
|-----------|---------|
| Search Actors | `mcpc --json @apify tools-call search-actors keywords:="..." limit:=10` |
| Fetch Actor details | `mcpc --json @apify tools-call fetch-actor-details actor:="..."` |
| Call an Actor | `mcpc --json @apify tools-call call-actor actor:="..." input:='<json>'` (`async:=true` optional) |
| Get run metadata | `mcpc --json @apify tools-call get-actor-run runId:="..."` |
| Get run output (via datasetId) | `mcpc --json @apify tools-call get-actor-output datasetId:="..." limit:=N fields:="..."` |
| Search docs | `mcpc --json @apify tools-call search-apify-docs query:="..." limit:=5` |
| Fetch docs page | `mcpc --json @apify tools-call fetch-apify-docs url:="..."` |
| List runs | **keep** `apify runs ls` — no live-session equivalent |
| Run log | **keep** `apify runs log <runId>` — no live-session equivalent |
| Builds | **keep** `apify builds ls|info|log` — no live-session equivalent |
| Dataset/KV ops | **keep** `apify datasets` / `apify key-value-stores` — not exposed in the live `@apify` session |

---

## Files to Edit

**`.claude/skills/apify-ops/`**
- `SKILL.md` — replace three-way tool-selection guide with two-row table (remote exposed by the live `@apify` session → mcpc, local / no-live-session-equivalent → apify CLI); drop API Endpoints section if still present
- `references/mcpc-tools.md` — rewrite old two-step `call-actor` examples as `mcpc @apify tools-call call-actor actor:="..." input:='<json>'`
- `references/cli-commands.md` — keep local-dev commands plus remote CLI fallbacks that the live `@apify` session does not expose; fix stale examples like `apify whoami` and `apify runs ls --actor <actorId>`; add pointer to `mcpc-tools.md`

**9 platform scraper skills** (`apify-{content-analytics,market-research,competitor-intelligence,ultimate-scraper,lead-generation,brand-reputation-monitoring,audience-analysis,influencer-discovery,trend-analysis}/SKILL.md`)
- Replace verbose auth form:
  ```
  export $(grep APIFY_TOKEN .env | xargs) && mcpc --json mcp.apify.com --header "Authorization: Bearer $APIFY_TOKEN" tools-call fetch-actor-details actor:="ACTOR_ID" | jq -r ".content"
  ```
  with:
  ```
  mcpc --json @apify tools-call fetch-actor-details actor:="ACTOR_ID" | jq -r '.content'
  ```
- Drop `.env`/`APIFY_TOKEN` from Prerequisites (keep one-line note in Step 4: "Helper script reads `APIFY_TOKEN` from `.env`.")
- Update error handling: split `.env` missing (script) from `mcpc login` not done (mcpc)
- Do not touch `reference/scripts/run_actor.js` — out of scope

**`.claude/skills/apify-actor-development/`** and **`.claude/skills/apify-actorization/`**
- Strip all `mcp__apify__*` references; replace with `mcpc @apify tools-call ...`
- Replace `apify call` and other remote ops that the live `@apify` session exposes; keep all local-dev `apify` calls and remote CLI fallbacks without live `mcpc` equivalents
- Add one line in actor-dev Prerequisites: "For remote ops, use `mcpc` — see `apify-ops` skill."

**`.claude/commands/platform/push-and-get-working.md`** (now renamed `deploy-and-test.md`)
- Wait for Build step: `apify builds ls` → `apify builds ls glueo/contextractor-test` (build tools not in mcpc — keep apify CLI)
- Run Test Crawl: replace `apify call` with `mcpc --json @apify tools-call call-actor actor:="..." input:='<json>'`
- Keep `apify info`, `git push`, `apify builds ls|log`, and `apify runs ls|log` as-is
- Verify `allowed-tools` still permits `mcpc` (`Bash(*)` already does)

**`CLAUDE.md`**
- Verify there is no "Native MCP tools available: `mcp__apify__search-apify-docs`..." sentence
- Ensure the MCP block includes `mcpc login mcp.apify.com && mcpc connect mcp.apify.com @apify`
- Verify all `mcpc` examples use `@apify` session form

---

## Steps

### Step PREREQS
```bash
mcpc --version                              # must be ≥ v0.2.6; if not: npm install -g @apify/mcpc@latest
mcpc login mcp.apify.com
mcpc connect mcp.apify.com @apify
mcpc --json @apify tools-list              # verify live tool names
mcpc @apify tools-get call-actor           # verify current call-actor schema
```

### Step APIFY-OPS
Rewrite `apify-ops` skill per files-to-edit above.

### Step PLATFORM-SKILLS
Mechanical sweep of all 9 platform skills — identical auth-form replacement in each.

### Step ACTOR-DEV
Strip `mcp__apify__*` from actor-dev and actorization skills.

### Step COMMANDS
Update `deploy-and-test.md` (and any other command with remote ops). Sweep agents.

### Step CLAUDE-MD
Update root `CLAUDE.md` mcpc block.

### Step REVIEW
```bash
grep -rn "mcp__apify__" .claude/ CLAUDE.md
grep -rnE 'step:="(info|call)"' .claude/ CLAUDE.md
grep -rn "apify whoami" .claude/ CLAUDE.md
grep -rn "apify runs ls --actor" .claude/
grep -rn "Authorization: Bearer \$APIFY_TOKEN" .claude/
grep -rn "mcpc --json mcp.apify.com" .claude/ CLAUDE.md
grep -rn "api.apify.com" .claude/ CLAUDE.md
```
All must return nothing (exception: `reference/scripts/run_actor.js` content).

Smoke test:
```bash
mcpc @apify tools-get call-actor
mcpc --json @apify tools-call search-apify-docs query:="actor input schema" limit:=2
```
