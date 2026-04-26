---
description: Push to Apify test actor, wait for build, fix errors, and run a test crawl
allowed-tools: Bash(*), Read(*), Edit(*), Write(*), Glob(*), Grep(*)
---

# Push and Get Working

Automated workflow to push code to the Apify platform, wait for build, fix any build errors until the build succeeds, then run a test crawl to verify the Actor works.

**IMPORTANT:** This is a fully automated workflow. Do NOT ask for confirmation at any step. Execute all steps automatically without pausing for user input.

## Target Actor Selection

Check `$ARGUMENTS` for the target:

- If `$ARGUMENTS` contains `--production` → push to **production** actor `glueo/contextractor`
- Otherwise → push to **test** actor `glueo/contextractor-test` (default)

Set the target actor ID based on the argument and use it consistently throughout the workflow.

## Pre-flight Checks (REQUIRED)

### 1. Verify Apify CLI Login

```bash
apify info
```

If not logged in, stop and inform the user to run `apify login` first.

### 2. Verify Actor Target

```bash
cat apps/contextractor-apify/.actor/actor.json | grep '"name"'
apify info
```

Proceed automatically with the push. Do NOT ask for confirmation — only stop if not logged in.

## Workflow

Execute this loop until the build succeeds.

### 1. Validate Locally First

```bash
pnpm -r build
pnpm lint
cargo build --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

If any step fails, fix the errors before proceeding.

### 2. Push to Apify

```bash
cd apps/contextractor-apify

# Default (test):
apify push glueo/contextractor-test

# If --production argument was provided:
apify push glueo/contextractor
```

### 3. Wait for Build

```bash
sleep 5
apify builds ls --limit 3
```

Keep polling every 10–15 seconds until the latest build shows `Succeeded` or `Failed`.

### 4. Check Build Result

If **SUCCEEDED**: proceed to step 5.

If **FAILED**:

1. Fetch build log:
   ```bash
   apify builds log <BUILD_ID>
   ```
2. Identify the error type (see reference table below)
3. Apply fix locally
4. **Repeat from step 1**

### 5. Run Test Crawl

After a successful build, run the Actor with test input via mcpc (assumes one-time `mcpc connect mcp.apify.com @apify` already done):

```bash
mcpc --json @apify tools-call call-actor \
  actor:="<TARGET_ACTOR>" \
  step:="call" \
  input:='{"startUrls":[{"url":"https://en.wikipedia.org/wiki/Web_scraping"}],"maxPagesPerCrawl":1,"saveExtractedMarkdownToKeyValueStore":true}'
```

The call is synchronous by default — it waits for the run to complete and returns the result with `runId` and `defaultDatasetId`.

If **RUN SUCCEEDED**:

1. Inspect the dataset:
   ```bash
   apify runs ls --limit 3
   ```
2. Report success with the run URL and a sample dataset item.

If **RUN FAILED**:

1. Fetch run log:
   ```bash
   apify runs log <RUN_ID>
   ```
2. Diagnose and fix the source code
3. **Repeat from step 1**

## Arguments

`$ARGUMENTS` — optional:

- `--production` — push to production actor `glueo/contextractor` instead of test
- `skip-validation` — skip local `pnpm`/`cargo` checks

## Error Type Reference

| Error Pattern | Fix Location |
|---------------|--------------|
| `Invalid input schema` | `apps/contextractor-apify/.actor/input_schema.json` |
| `Invalid output schema` | `apps/contextractor-apify/.actor/output_schema.json` |
| `Invalid dataset schema` | `apps/contextractor-apify/.actor/dataset_schema.json` |
| `COPY failed` | `apps/contextractor-apify/Dockerfile` |
| TypeScript build error (`TS\d+`) | `apps/contextractor-apify/src/` or `packages/contextractor-engine/src/` |
| `error[E0` (Rust) | `packages/contextractor-engine/native/src/lib.rs` — fix types |
| `linking with cc` / missing system libs | `apps/contextractor-apify/Dockerfile` — install missing libs |
| `clippy::` warning treated as error | napi-rs crate source — fix or `#[allow(...)]` with justification |

## Success Criteria

The workflow completes when:

- Local `pnpm -r build` passes
- Local `cargo build --workspace` and `cargo clippy --workspace --all-targets -- -D warnings` pass
- `apify push` succeeds
- Build status is `SUCCEEDED`
- Test crawl completes successfully
- Dataset contains at least one extracted item

Report the final URLs to the user:

- Build: `https://console.apify.com/actors/<actorId>/builds/<buildId>`
- Run: `https://console.apify.com/actors/<actorId>/runs/<runId>`
