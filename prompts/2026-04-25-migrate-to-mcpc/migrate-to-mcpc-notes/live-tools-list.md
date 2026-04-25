# Live `mcp.apify.com` Tool List

Captured 2026-04-25 against `apify-mcp-server` v0.9.19 via `mcpc --json @apify tools-list`. Local mcpc: v0.2.6.

## Available (8 tools)

- `search-actors`
- `fetch-actor-details`
- `call-actor` (supports `step:="info"` / `step:="call"`, `async:=true|false`)
- `get-actor-run` (by `runId`)
- `get-actor-output` (by `datasetId`)
- `search-apify-docs`
- `fetch-apify-docs`
- `apify--rag-web-browser` (dedicated Actor tool)

## NOT available — confirmed via live `tools-call` errors

The server's `tools/list` response is the canonical surface. All of these were assumed available by the legacy `mcp__apify__*` docs and by `migration-target-inventory.md` / `mcpc-tool-equivalents.md`. They are NOT exposed by `mcp.apify.com`:

- `add-actor`
- `get-actor-run-list`
- `get-actor-log`
- `get-dataset`, `get-dataset-items`, `get-dataset-list`, `get-dataset-schema`
- `get-key-value-store`, `get-key-value-store-keys`, `get-key-value-store-record`, `get-key-value-store-list`
- any build-related tool

## Implication for the migration

The original equivalents table is materially wrong. Only operations whose New cell maps to one of the 8 available tools can actually move to mcpc. Everything else must either stay on `apify` CLI / `apify-client` SDK / raw API, or move to a different `mcpc`-compatible flow (e.g. fetch dataset via `get-actor-output` keyed off a known `datasetId` on a run object, instead of a free-standing `get-dataset-items`).

## What can be migrated

| Legacy operation | mcpc equivalent |
|---|---|
| Search Actors | `mcpc --json @apify tools-call search-actors keywords:="..." limit:=10` |
| Fetch Actor README/schema | `mcpc --json @apify tools-call fetch-actor-details actor:="..."` |
| Call an Actor | `mcpc @apify tools-call call-actor actor:="..." step:="info"` then `... step:="call" input:='<json>'` |
| Get a specific run's metadata | `mcpc --json @apify tools-call get-actor-run runId:="..."` |
| Get a run's output items (via its datasetId) | `mcpc --json @apify tools-call get-actor-output datasetId:="..." limit:=N fields:="..."` |
| Search Apify docs | `mcpc --json @apify tools-call search-apify-docs query:="..." limit:=5` |
| Fetch a docs page | `mcpc --json @apify tools-call fetch-apify-docs url:="..."` |
| Web-scrape a URL with the Apify RAG browser | `mcpc @apify tools-call apify--rag-web-browser ...` |

## What cannot be migrated — must stay on `apify` CLI or `apify-client` SDK

| Legacy operation | Reason | Recommended fallback |
|---|---|---|
| List recent runs (`apify runs ls`) | No `get-actor-run-list` | Keep `apify runs ls` |
| Stream/print a run's log (`apify runs log`) | No `get-actor-log` | Keep `apify runs log` |
| List builds, get build info/log (`apify builds *`) | No build tools at all | Keep `apify builds ls|info|log` |
| Free-standing dataset list / random KV store inspection | No `get-dataset-list`, no `get-key-value-store-*` | Keep `apify datasets ls|get-items`, `apify key-value-stores *`, or use `apify-client` SDK in scripts |
| Register an Actor as a tool (`add-actor`) | Tool not exposed | Use `call-actor` directly |

## Pivot for the migration plan

The user's intent ("mcpc instead of CLI/API/MCP") cannot be fully satisfied by the current `mcp.apify.com` surface. The remaining viable scope:

- Fully migrate the 7 operations that have a real mcpc equivalent.
- For the rest, keep `apify` CLI as the documented path. Drop `mcp__apify__*` everywhere (per QA decision) and rewrite docs to point at either mcpc *or* `apify` CLI on a per-operation basis.

This means the inventory still gets cleaner — only one path per operation — but the path isn't always mcpc.
