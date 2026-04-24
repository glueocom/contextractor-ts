---
description: Push to Apify test actor, wait for build, fix errors, and run a test crawl
allowed-tools: Bash(*), Read(*), Edit(*), Write(*), Glob(*), Grep(*)
---

# Push and Get Working

Automated workflow to push code to Apify platform, wait for build, fix any build errors until the build succeeds, and then run a test crawl to verify the actor works.

**IMPORTANT:** This is a fully automated workflow. Do NOT ask for confirmation at any step. Execute all steps automatically without pausing for user input.

## Target Actor Selection

Check `$ARGUMENTS` for the target:

- If `$ARGUMENTS` contains `--production` → Push to **production** actor `glueo/apple-maps`
- Otherwise → Push to **test** actor `glueo/apple-maps-test` (default)

Set the target actor ID based on the argument and use it consistently throughout the workflow.

## Pre-flight Checks (REQUIRED)

### 1. Verify Apify CLI Login

```bash
apify info
```

If not logged in, stop and inform the user to run `apify login` first.

### 2. Verify Actor Target

```bash
cat .actor/actor.json | grep '"name"'
apify info
```

Proceed automatically with the push. Do NOT ask for confirmation - only stop if not logged in.

## Workflow

Execute this loop until the build succeeds:

### 1. Validate Locally First

```bash
npm run build
```

If local build fails, fix TypeScript errors before proceeding.

### 2. Push to Apify

```bash
# Default (test):
apify push glueo/apple-maps-test

# If --production argument was provided:
apify push glueo/apple-maps
```

### 3. Wait for Build

```bash
sleep 5
apify builds ls --limit 3
```

Keep polling every 10-15 seconds until the latest build shows "Succeeded" or "Failed".

### 4. Check Build Result

If **SUCCEEDED**: Proceed to step 5 (Run Test Crawl).

If **FAILED**:
1. Fetch build log:
   ```bash
   apify builds log <BUILD_ID>
   ```

2. Analyze the error type:
   - Schema validation errors -> Fix `.actor/*_schema.json` files
   - Dockerfile errors -> Fix `Dockerfile`
   - Dependency errors -> Fix `package.json`, run `npm install`
   - TypeScript errors -> Fix source files in `src/`
   - Import errors -> Check dependencies in `package.json`

3. Apply fix locally
4. **Repeat from step 1** (validate locally and push again)

### 5. Run Test Crawl

After a successful build, run the actor with test input:

```bash
apify call <TARGET_ACTOR> --input '{"searchQueries": ["coffee shops in San Francisco"], "maxResultsPerQuery": 5}'
```

Wait for the run to complete.

If **RUN SUCCEEDED**:
1. Check dataset output:
   ```bash
   apify runs ls --limit 3
   ```
2. Report success with run URL and sample output.

If **RUN FAILED**:
1. Fetch run log:
   ```bash
   apify runs ls --limit 3
   apify runs log <RUN_ID>
   ```
2. Analyze the error and fix the source code
3. **Repeat from step 1** (push and rebuild)

## Arguments

$ARGUMENTS - Optional arguments:
- `--production` - Push to production actor `glueo/apple-maps` instead of test
- `skip-validation` - Skip local build step

## Error Type Reference

| Error Pattern | Fix Location |
|--------------|--------------|
| `Invalid input schema` | `.actor/input_schema.json` |
| `Invalid output schema` | `.actor/output_schema.json` |
| `Invalid dataset schema` | `.actor/dataset_schema.json` |
| `COPY failed` | `Dockerfile` |
| `npm ERR` | `package.json` |
| `TSError` / `TS2` | TypeScript source files in `src/` |
| `Cannot find module` | Missing dependency in `package.json` |

## Success Criteria

The workflow completes when:
- Local `npm run build` passes
- `apify push` succeeds
- Build status is `SUCCEEDED`
- Test crawl run completes successfully
- Dataset contains at least one place result

Report the final URLs to the user:
- Build: `https://console.apify.com/actors/<actorId>/builds/<buildId>`
- Run: `https://console.apify.com/actors/<actorId>/runs/<runId>`
