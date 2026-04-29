ressearch does apify already fully support this? https://github.com/apify/mcpc
if yes, write a promt to setup '/Users/miroslavsekera/r/contextractor-ts/.claude' so the new mcpc is used instead of CLI, Api and MCP in skills agetnts at '/Users/miroslavsekera/r/contextractor-ts/.claude'

---

## Key Decisions

**Direct MCP**: Strip every `mcp__apify__*` example and reference. Agents use `mcpc` from Bash only. `.mcp.json` stays (it's what makes `@apify` discoverable).

**Scope**: Remote ops only. Keep `apify` CLI for local dev: `run`, `push`, `login`, `info`, `whoami`, `create`, `validate-schema`. Replace all remote calls — `mcp__apify__*`, `apify call`, `apify builds`, `apify runs`, `apify datasets`, `apify key-value-stores`, raw API curl — with `mcpc`.

**Pivot**: `mcp.apify.com` exposes only 8 tools. Many assumed tools (run-list, run-log, build tools, dataset/KV ops) are NOT available. Use `mcpc` where a real equivalent exists; keep `apify` CLI elsewhere.

**Session model**: One-time `mcpc login mcp.apify.com && mcpc connect mcp.apify.com @apify`. All examples use `mcpc @apify ...`. No inline `--header "Authorization: Bearer $APIFY_TOKEN"` in docs.

---

## Live Tools (verified 2026-04-25, apify-mcp-server v0.9.19, mcpc v0.2.6)

**Available (8)**: `search-actors`, `fetch-actor-details`, `call-actor` (`step:="info"|"call"`, `async:=true|false`), `get-actor-run`, `get-actor-output`, `search-apify-docs`, `fetch-apify-docs`, `apify--rag-web-browser`

**NOT available**: `add-actor`, `get-actor-run-list`, `get-actor-log`, all dataset/KV/build tools.

---

## Translation Table

| Operation | Command |
|-----------|---------|
| Search Actors | `mcpc --json @apify tools-call search-actors keywords:="..." limit:=10` |
| Fetch Actor details | `mcpc --json @apify tools-call fetch-actor-details actor:="..."` |
| Call an Actor | `mcpc @apify tools-call call-actor actor:="..." step:="info"` then `step:="call" input:='<json>'` |
| Get run metadata | `mcpc --json @apify tools-call get-actor-run runId:="..."` |
| Get run output (via datasetId) | `mcpc --json @apify tools-call get-actor-output datasetId:="..." limit:=N fields:="..."` |
| Search docs | `mcpc --json @apify tools-call search-apify-docs query:="..." limit:=5` |
| Fetch docs page | `mcpc --json @apify tools-call fetch-apify-docs url:="..."` |
| List runs | **keep** `apify runs ls` — no `get-actor-run-list` |
| Run log | **keep** `apify runs log <runId>` — no `get-actor-log` |
| Builds | **keep** `apify builds ls|info|log` — no build tools |
| Dataset/KV ops | **keep** `apify datasets` / `apify key-value-stores` — not exposed |

---

## Files to Edit

**`.claude/skills/apify-ops/`**
- `SKILL.md` — replace three-way tool-selection guide with two-row table (remote → mcpc, local → apify CLI); drop API Endpoints section
- `references/mcp-tools.md` → rename to `mcpc-tools.md`, rewrite all examples as `mcpc @apify tools-call ...`
- `references/api-endpoints.md` → delete
- `references/cli-commands.md` → keep only: install/auth, `apify run`, `apify push`, `apify create`, `apify validate-schema`; add pointer to `mcpc-tools.md`

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
- Replace any `apify call`/remote ops; keep all local-dev `apify` calls
- Add one line in actor-dev Prerequisites: "For remote ops, use `mcpc` — see `apify-ops` skill."

**`.claude/commands/platform/push-and-get-working.md`** (now renamed `deploy-and-test.md`)
- Wait for Build step: `apify builds ls` → `apify builds ls glueo/contextractor-test` (build tools not in mcpc — keep apify CLI)
- Run Test Crawl: replace `apify call` with `mcpc @apify tools-call call-actor actor:="..." step:="call" input:='<json>'`
- Keep `apify info`, `apify push`, `apify builds ls|log` as-is
- Add `Bash(mcpc:*)` to `allowed-tools`

**`CLAUDE.md`**
- Drop: "Native MCP tools available: `mcp__apify__search-apify-docs`..." sentence
- Add above examples: `mcpc login mcp.apify.com && mcpc connect mcp.apify.com @apify`
- Verify all `mcpc` examples use `@apify` session form

---

## Steps

### Step PREREQS
```bash
mcpc --version                              # must be ≥ v0.2.6; if not: npm install -g @apify/mcpc@latest
mcpc login mcp.apify.com
mcpc connect mcp.apify.com @apify
mcpc --json @apify tools-list              # verify live tool names
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
grep -rnE "apify (call|builds|runs|datasets|key-value-stores)" .claude/ CLAUDE.md
grep -rn "api.apify.com" .claude/ CLAUDE.md
grep -rn "Authorization: Bearer \$APIFY_TOKEN" .claude/
grep -rn "mcpc --json mcp.apify.com" .claude/ CLAUDE.md
```
All must return nothing (exception: `reference/scripts/run_actor.js` content).

Smoke test:
```bash
mcpc @apify tools-list | head -5
mcpc --json @apify tools-call search-apify-docs query:="actor input schema" limit:=2
```
