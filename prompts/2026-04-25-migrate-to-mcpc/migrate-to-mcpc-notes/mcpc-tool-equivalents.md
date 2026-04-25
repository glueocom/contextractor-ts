# mcpc Equivalents for Removed CLI / API / MCP Calls

Reference table for rewrites. Assumes `mcpc connect mcp.apify.com @apify` has been run once.

## Actor discovery

| Old | New |
|-----|-----|
| `mcp__apify__search-actors keywords:"..."` | `mcpc --json @apify tools-call search-actors keywords:="..." limit:=10` |
| `mcp__apify__fetch-actor-details actor:"..."` | `mcpc --json @apify tools-call fetch-actor-details actor:="..."` |

## Running Actors

| Old | New |
|-----|-----|
| `apify call <actor> --input '<json>'` | `mcpc @apify tools-call call-actor actor:="<actor>" step:="info"` then `... step:="call" input:='<json>'` |
| `mcp__apify__add-actor actor:"..."` | `mcpc @apify tools-call add-actor actor:="..."` |

## Run monitoring

| Old | New |
|-----|-----|
| `apify runs info <runId>` | `mcpc --json @apify tools-call get-actor-run runId:="<runId>"` |
| `apify runs ls --limit N` | `mcpc --json @apify tools-call get-actor-run-list limit:=N desc:=true` |
| `apify runs log <runId>` | `mcpc --json @apify tools-call get-actor-log runId:="<runId>" lines:=200` |

## Builds

| Old | New |
|-----|-----|
| `apify builds ls --limit N` | `mcpc --json @apify tools-call get-actor-build-list limit:=N` *(verify name with `mcpc @apify tools-list \| grep build`)* |
| `apify builds info <buildId>` | `mcpc --json @apify tools-call get-actor-build buildId:="<buildId>"` |
| `apify builds log <buildId>` | `mcpc --json @apify tools-call get-actor-build-log buildId:="<buildId>"` |

If the `mcp.apify.com` server does not expose build tools, fall back to `apify builds *` CLI and document the gap inline. Verify exact tool names during step-02.

## Datasets

| Old | New |
|-----|-----|
| `apify datasets ls` | `mcpc --json @apify tools-call get-dataset-list limit:=10 unnamed:=true` |
| `apify datasets get-items <id>` | `mcpc --json @apify tools-call get-dataset-items datasetId:="<id>" limit:=100` |
| `mcp__apify__get-dataset datasetId:"..."` | `mcpc --json @apify tools-call get-dataset datasetId:="..."` |
| `mcp__apify__get-actor-output datasetId:"..."` | `mcpc --json @apify tools-call get-actor-output datasetId:="..." fields:="..."` |

## Key-value stores

| Old | New |
|-----|-----|
| `apify key-value-stores ls` | `mcpc --json @apify tools-call get-key-value-store-list limit:=10` |
| `apify key-value-stores get-value <id> <key>` | `mcpc --json @apify tools-call get-key-value-store-record storeId:="<id>" recordKey:="<key>"` |

## Documentation

| Old | New |
|-----|-----|
| `mcp__apify__search-apify-docs query:"..."` | `mcpc --json @apify tools-call search-apify-docs query:="..." limit:=5` |
| `mcp__apify__fetch-apify-docs url:"..."` | `mcpc --json @apify tools-call fetch-apify-docs url:="..."` |

## What stays as `apify` CLI

- `apify run` — local Actor execution
- `apify push` (and `apify push --no-build`) — deploy
- `apify login` / `apify login -t $APIFY_TOKEN` — auth
- `apify info` / `apify whoami` — identity check
- `apify create -t <template>` — scaffolding
- `apify validate-schema` — local schema check
