---
description: Push to Apify test actor, wait for build, fix errors, and run a test crawl
allowed-tools: Bash(*), Read(*), Edit(*), Write(*), Glob(*), Grep(*)
---

# Push and Get Working

Automated workflow to push code to the Apify platform, wait for build, fix any build errors until the build succeeds, then run a test crawl to verify the Actor works.

**IMPORTANT:** This is a fully automated workflow. Do NOT ask for confirmation at any step. Execute all steps automatically without pausing for user input.

## Target Actor Selection

Check `$ARGUMENTS` for the target:

- If `$ARGUMENTS` contains `--production` → push to **production** actor `shortc/contextractor`
- Otherwise → push to **test** actor `shortc/contextractor-test` (default)

Set the target actor ID based on the argument and use it consistently throughout the workflow.

## Pre-flight Checks (REQUIRED)

### 1. Verify Apify CLI Login

```bash
apify info
```

If not logged in, stop and inform the user to run `apify login` first.

### 2. Verify Actor Target

```bash
cat apps/contextractor/.actor/actor.json | grep '"name"'
apify info
```

Proceed automatically with the push. Do NOT ask for confirmation — only stop if not logged in.

## Workflow

Execute this loop until the build succeeds.

### 1. Validate Locally First

```bash
cargo check --workspace --all-targets
cargo clippy --workspace --all-targets -- -D warnings
```

If either fails, fix the errors before proceeding.

### 2. Push to Apify

```bash
cd apps/contextractor

# Default (test):
apify push shortc/contextractor-test

# If --production argument was provided:
apify push shortc/contextractor
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

After a successful build, run the Actor with test input:

```bash
apify call <TARGET_ACTOR> --input '{"startUrls":[{"url":"https://en.wikipedia.org/wiki/Web_scraping"}],"maxRequestsPerCrawl":1,"outputFormat":"markdown"}'
```

Wait for the run to complete.

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

- `--production` — push to production actor `shortc/contextractor` instead of test
- `skip-validation` — skip local cargo checks

## Error Type Reference

| Error Pattern | Fix Location |
|---------------|--------------|
| `Invalid input schema` | `apps/contextractor/.actor/input_schema.json` |
| `Invalid output schema` | `apps/contextractor/.actor/output_schema.json` |
| `Invalid dataset schema` | `apps/contextractor/.actor/dataset_schema.json` |
| `COPY failed` | `apps/contextractor/Dockerfile` |
| `error[E0` | Rust source files in `apps/contextractor/src/` or `packages/contextractor_engine/src/` — fix types |
| `error: failed to resolve` | `Cargo.toml` — add or fix dependency |
| `error: linking with` | `apps/contextractor/Dockerfile` — install missing system libs (e.g. `pkg-config`, `libssl-dev`) |
| `clippy::` warning treated as error | Source file flagged by clippy — fix or `#[allow(...)]` with justification |

## Success Criteria

The workflow completes when:

- Local `cargo check --workspace --all-targets` passes
- Local `cargo clippy --workspace --all-targets -- -D warnings` passes
- `apify push` succeeds
- Build status is `SUCCEEDED`
- Test crawl completes successfully
- Dataset contains at least one extracted item

Report the final URLs to the user:

- Build: `https://console.apify.com/actors/<actorId>/builds/<buildId>`
- Run: `https://console.apify.com/actors/<actorId>/runs/<runId>`
