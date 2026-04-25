# mcpc Capability and Apify Support

## Status

`@apify/mcpc` is officially published by Apify on npm. Repo: <https://github.com/apify/mcpc>. Latest release at research time: **v0.2.6** (April 2026). Local install on this machine: v0.1.11 (out of date — bump during setup).

## What it replaces

mcpc is a thin universal MCP CLI client. It can fully invoke any tool exposed by `mcp.apify.com`, which includes the entire Apify run / dataset / key-value-store / Actor-discovery / docs surface. That covers everything previously documented as:

- direct `mcp__apify__*` tool calls (loaded via `.mcp.json`)
- `apify call <actor>` / `apify runs ls` / `apify runs info` / `apify runs log`
- `apify builds ls|info|log`
- `apify datasets ls|get-items` / `apify key-value-stores ls|get-value`
- raw `https://api.apify.com/v2/...` curl calls
- `apify-client` (npm) and `apify_client` (Python) SDK usage in Node helper scripts

## What it does NOT replace

mcpc only talks to MCP servers. It cannot:

- run an Actor's container locally → still `apify run`
- push code to the platform → still `apify push`
- authenticate the Apify CLI → still `apify login` / `apify info`
- build Docker images → still `docker` / Dockerfile

Local-dev CLI commands stay. Anything that hits the platform API moves to mcpc.

## Authentication

OAuth via `mcpc login mcp.apify.com` stores credentials in OS keychain (file fallback on headless Linux). After login, every command uses the persistent `@apify` session — no `--header "Authorization: Bearer ..."` needed.

Header-auth form remains available for CI / headless contexts but is not the documented default.

## Argument syntax

Tool calls use `:=` for typed args, `=` for plain string:

- `mcpc @apify tools-call get-actor-run runId:="abc123"`
- `mcpc @apify tools-call get-dataset-items datasetId:="xyz" limit:=100 fields:="title,url"`
- JSON object args: `config:='{"key":"value"}'`
- Stdin: `echo '{"query":"test"}' | mcpc @apify tools-call search-actors`

## Output

`mcpc @apify ...` prints human text. `mcpc --json @apify ...` prints structured JSON suitable for `jq` pipelines.

## Sources

- <https://github.com/apify/mcpc>
- <https://www.npmjs.com/package/@apify/mcpc>
