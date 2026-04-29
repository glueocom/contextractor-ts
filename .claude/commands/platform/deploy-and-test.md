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

### Step LOGIN: Verify Apify CLI Login

```bash
apify info
```

If not logged in, stop and inform the user to run `apify login` first. Apify CLI must be ≥ 1.4 — older versions reject the modern actor format with "Actor is of an unknown format".

### Step BRANCH_GUARD: Verify Current Branch

```bash
git branch --show-current
```

Builds are triggered by pushing to the Git-connected branch in Apify Console:

- `dev` → `glueo/contextractor-test`
- `main` → `glueo/contextractor` (production)

For the default (test) push, ensure you are on `dev` or a branch that can be pushed to `dev`. For `--production`, you must be on `main` or a branch intended to merge there.

Stop and abort if the branch does not match the target. Do NOT auto-push to the wrong branch.

## Workflow

Execute this loop until the build succeeds.

### Step VALIDATE: Validate Locally First

```bash
npm run build
npm run lint
npm run test
cargo build --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

If any check fails, fix the errors before proceeding. Skip with `skip-validation` only when the user explicitly asked to push despite known local failure.

### Step PUSH: Push to Apify

Both actors use a **Git-connected build** in Apify Console (`git@github.com:glueocom/contextractor-ts.git`). This path honors `dockerContextDir: "../../.."` in `.actor/actor.json`, giving the Dockerfile access to the workspace root. Push to the appropriate branch to trigger the build:

- `glueo/contextractor-test` watches the **`dev`** branch
- `glueo/contextractor` (production) watches the **`main`** branch

```bash
# Default (test) — push current branch to dev:
git push origin HEAD:dev

# If --production argument was provided:
git push origin HEAD:main
```

After pushing, Apify Console picks up the commit and starts a build automatically.

### Step WAIT_BUILD: Wait for Build

```bash
sleep 5
apify builds ls --limit 3
```

Keep polling every 10–15 seconds until the latest build shows `Succeeded` or `Failed`.

### Step CHECK_BUILD: Check Build Result

If **SUCCEEDED**: proceed to step RUN_TEST.

If **FAILED**:

- Fetch build log:
  ```bash
  apify builds log <BUILD_ID>
  ```
- Identify the error type (see reference table below)
- Apply fix locally
- **Repeat from Step VALIDATE**

### Step RUN_TEST: Run Test Crawl

After a successful build, run the Actor with test input via mcpc (assumes one-time `mcpc connect mcp.apify.com @apify` already done):

```bash
mcpc --json @apify tools-call call-actor \
  actor:="<TARGET_ACTOR>" \
  step:="call" \
  input:='{"startUrls":[{"url":"https://en.wikipedia.org/wiki/Web_scraping"}],"maxRequestsPerCrawl":1,"outputFormat":"markdown"}'
```

`outputFormat` must be one of `txt`, `markdown`, `json`, `html` (no `xml` / `xmltei`).

The call is synchronous by default — it waits for the run to complete and returns the result with `runId` and `defaultDatasetId`.

If **RUN SUCCEEDED**:

- Inspect the dataset:
  ```bash
  apify runs ls --limit 3
  ```
- Report success with the run URL and a sample dataset item.

If **RUN FAILED**:

- Fetch run log:
  ```bash
  apify runs log <RUN_ID>
  ```
- Diagnose and fix the source code
- **Repeat from Step VALIDATE**

## Arguments

`$ARGUMENTS` — optional:

- `--production` — push to production actor `glueo/contextractor` instead of test (requires the `apify push glueo/contextractor` deny rule to be overridden)
- `skip-validation` — skip local `npm` and `cargo` checks

## Error Type Reference

| Error Pattern | Fix Location |
|---------------|--------------|
| `Invalid input schema` | `apps/contextractor-apify/.actor/input_schema.json` |
| `Invalid output schema` | `apps/contextractor-apify/.actor/output_schema.json` |
| `Invalid dataset schema` | `apps/contextractor-apify/.actor/dataset_schema.json` |
| `COPY failed` | `apps/contextractor-apify/Dockerfile` (check `dockerContextDir` and multi-stage layout) |
| `Cannot find module '@contextractor/engine'` | Actor `package.json` should declare `"@contextractor/engine": "*"` and the Dockerfile must run `npm run build -w @contextractor/apify` (multi-stage npm workspace build) |
| `error[E0` | napi-rs crate at `packages/contextractor-engine/native/src/` — fix types |
| `error: linking with` | `apps/contextractor-apify/Dockerfile` — install missing system libs |
| `clippy::` warning treated as error | napi-rs crate source — fix the code rather than allow the lint |
| `napi-rs prebuild not found` | CI must publish `linux-x64-gnu` and `linux-arm64-gnu` `.node` files via `optionalDependencies` |
| `vitest exited 1` with no tests | Add `vitest run --passWithNoTests` to that package's `test` script |
| `Actor is of an unknown format` | Apify CLI is < 1.4 — upgrade locally |

## Success Criteria

The workflow completes when:

- Local `npm run build`, `npm run lint`, `npm run test` pass
- Local `cargo build --workspace` and `cargo clippy --workspace --all-targets -- -D warnings` pass
- The actor build on `glueo/contextractor-test` (or `glueo/contextractor` for `--production`) is `SUCCEEDED`
- Test crawl completes successfully
- Dataset contains at least one extracted item

Report the final URLs to the user:

- Build: `https://console.apify.com/actors/<actorId>/builds/<buildId>`
- Run: `https://console.apify.com/actors/<actorId>/runs/<runId>`
