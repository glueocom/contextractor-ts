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

### Step ACTOR_NAME_GUARD: Verify Actor Target Name

```bash
jq -r '.name' apps/contextractor-apify/.actor/actor.json
apify info
```

The `.actor/actor.json` `name` field MUST be:

- `contextractor-test` for the default test push (resolves to `glueo/contextractor-test`)
- `contextractor` only for `--production`

`apify push` deploys to whatever actor name is in this file under the logged-in org. If the value disagrees with the chosen target, **stop** and abort the push — do not auto-correct without user input. The v1 migration accidentally pushed to production because this guard was missing.

Proceed automatically with the push only after the name matches the target. Do NOT ask for confirmation — only stop if not logged in or if the name guard fails.

## Workflow

Execute this loop until the build succeeds.

### Step VALIDATE: Validate Locally First

```bash
pnpm -r build
pnpm -r lint
pnpm -r test
cargo build --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

If any check fails, fix the errors before proceeding. Skip with `skip-validation` only when the user explicitly asked to push despite known local failure.

### Step PUSH: Push to Apify

The 2026 standard pattern is a **Git-connected build** in Apify Console — that path honors `dockerContextDir: "../../.."` in `.actor/actor.json` and gives the Dockerfile access to the workspace root (so `pnpm --filter @contextractor/apify deploy --prod /deploy` works against the entire repo). If a Git integration is configured for the target actor, prefer pushing to GitHub and triggering the build there.

For CLI fallback (no Git integration on the actor), `apify push` blocks on contexts above the actor dir — use only when the Dockerfile context fits inside `apps/contextractor-apify/`.

```bash
cd apps/contextractor-apify

# Default (test):
apify push glueo/contextractor-test

# If --production argument was provided (deny rule must be temporarily overridden):
apify push glueo/contextractor
```

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
- `skip-validation` — skip local `pnpm` and `cargo` checks

## Error Type Reference

| Error Pattern | Fix Location |
|---------------|--------------|
| `Invalid input schema` | `apps/contextractor-apify/.actor/input_schema.json` |
| `Invalid output schema` | `apps/contextractor-apify/.actor/output_schema.json` |
| `Invalid dataset schema` | `apps/contextractor-apify/.actor/dataset_schema.json` |
| `COPY failed` | `apps/contextractor-apify/Dockerfile` (check `dockerContextDir` and multi-stage layout) |
| `Cannot find module '@contextractor/engine'` | Actor `package.json` should declare `"@contextractor/engine": "workspace:*"` and the Dockerfile must run `pnpm --filter @contextractor/apify deploy --prod /deploy` |
| `error[E0` | napi-rs crate at `packages/contextractor-engine/native/src/` — fix types |
| `error: linking with` | `apps/contextractor-apify/Dockerfile` — install missing system libs |
| `clippy::` warning treated as error | napi-rs crate source — fix the code rather than allow the lint |
| `napi-rs prebuild not found` | CI must publish `linux-x64-gnu` and `linux-arm64-gnu` `.node` files via `optionalDependencies` |
| `vitest exited 1` with no tests | Add `vitest run --passWithNoTests` to that package's `test` script |
| `Actor is of an unknown format` | Apify CLI is < 1.4 — upgrade locally |

## Success Criteria

The workflow completes when:

- Local `pnpm -r build`, `pnpm -r lint`, `pnpm -r test` pass
- Local `cargo build --workspace` and `cargo clippy --workspace --all-targets -- -D warnings` pass
- The actor build on `glueo/contextractor-test` (or `glueo/contextractor` for `--production`) is `SUCCEEDED`
- Test crawl completes successfully
- Dataset contains at least one extracted item

Report the final URLs to the user:

- Build: `https://console.apify.com/actors/<actorId>/builds/<buildId>`
- Run: `https://console.apify.com/actors/<actorId>/runs/<runId>`
