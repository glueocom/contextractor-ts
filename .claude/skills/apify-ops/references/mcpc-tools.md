# mcpc Tool Reference for `mcp.apify.com`

Use the persistent `@apify` session — see the one-time setup in `../SKILL.md`. Every example assumes `mcpc connect mcp.apify.com @apify` has been run.

The live server (`apify-mcp-server` v0.9.19) exposes 8 tools. Anything not listed below is not available via mcpc — fall back to `apify` CLI (`references/cli-commands.md`) or the `apify-client` SDK.

## Argument syntax

- `arg:=value` — typed value (numbers, booleans, strings)
- `arg:='{"key":"value"}'` — JSON object
- Pipe stdin: `echo '{"query":"test"}' | mcpc @apify tools-call <name>`
- `mcpc @apify ...` — human-readable output
- `mcpc --json @apify ...` — JSON output, pipe through `jq`

## Actor Discovery

### search-actors

Search the Apify Store.

```bash
mcpc --json @apify tools-call search-actors keywords:="instagram posts" limit:=10
```

### fetch-actor-details

Get an Actor's README, input schema, pricing, and metadata.

```bash
mcpc --json @apify tools-call fetch-actor-details actor:="apify/rag-web-browser"
```

## Running Actors

### call-actor (two-step)

**Step 1 — info** (required first; shows input schema and pricing):

```bash
mcpc @apify tools-call call-actor actor:="apify/rag-web-browser" step:="info"
```

**Step 2 — call** (synchronous by default; waits for completion and returns results):

```bash
mcpc --json @apify tools-call call-actor \
  actor:="apify/rag-web-browser" \
  step:="call" \
  input:='{"query":"example search","maxResults":5}'
```

**Async mode** (start the run and return immediately with `runId`):

```bash
mcpc --json @apify tools-call call-actor \
  actor:="apify/instagram-scraper" \
  step:="call" \
  async:=true \
  input:='{"username":"example"}'
```

For MCP-server Actors that expose sub-tools, use `actor:="actorName:toolName"`.

## Run Inspection

### get-actor-run

Get a single run's metadata (status, timestamps, `defaultDatasetId`, `defaultKeyValueStoreId`, stats).

```bash
mcpc --json @apify tools-call get-actor-run runId:="y2h7sK3Wc"
```

To list recent runs or stream a run's log live, use `apify runs ls` / `apify runs log` — neither has a mcpc equivalent.

### get-actor-output

Retrieve dataset items produced by a run, given a `datasetId` (read it from a `get-actor-run` response or from the `call-actor` result).

```bash
mcpc --json @apify tools-call get-actor-output \
  datasetId:="abc123" \
  limit:=100 \
  fields:="crawl.statusCode,text"
```

`get-actor-output` is the dataset-read path on mcpc. Free-standing `get-dataset-items` / `get-dataset-list` are not exposed — use `apify datasets get-items` for ad-hoc dataset access.

## Documentation

### search-apify-docs

Full-text search of Apify and Crawlee docs.

```bash
mcpc --json @apify tools-call search-apify-docs query:="actor input schema" limit:=5
```

### fetch-apify-docs

Fetch a specific docs page by URL.

```bash
mcpc --json @apify tools-call fetch-apify-docs url:="https://docs.apify.com/platform/actors/running"
```

## Dedicated Actor Tools

### apify--rag-web-browser

A general web-scraping tool exposed directly. Prefer `search-actors` + `call-actor` for site-specific work; use `apify--rag-web-browser` for ad-hoc page fetching.

```bash
mcpc @apify tools-call apify--rag-web-browser query:="apify documentation"
```

## Limitations of `mcp.apify.com` v0.9.19

Not exposed (use `apify` CLI or `apify-client` SDK):

- listing runs (`get-actor-run-list`)
- streaming a run's log (`get-actor-log`)
- builds (no build-related tools at all)
- ad-hoc dataset operations (`get-dataset`, `get-dataset-items`, `get-dataset-list`, `get-dataset-schema`)
- key-value-store operations (none exposed)
- `add-actor` (register an Actor as a tool)

If `apify-mcp-server` adds these later, this file should be updated. Verify with `mcpc --json @apify tools-list`.
