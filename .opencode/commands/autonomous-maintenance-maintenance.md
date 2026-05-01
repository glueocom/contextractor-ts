---
description: Run all autonomous-maintenance commands sequentially, then commit and push results
---

# Maintenance Orchestrator

Run all autonomous-maintenance sub-commands sequentially across the repo, then commit and push.

## Step PREPARE: Clear Output Directory

Remove all files in `autonomous-task-output/` (create the directory if it does not exist). This ensures a clean slate for reports.

```bash
rm -rf autonomous-task-output && mkdir autonomous-task-output
```

## Step DISCOVER: List Sub-commands

List all `.md` files under `.claude/commands/autonomous-maintenance/` recursively, excluding `maintenance.md` (this file). The remaining files are the sub-commands to run.

## Step EXECUTE: Run Each Sub-command

Run each sub-command sequentially using the Skill tool. If a command fails, log the failure to `autonomous-task-output/maintenance-failures.md` and continue with the next.

**Recommended execution order** (generate first, then sync, then test):

- `autonomous-maintenance:schema/gen-input-schema` (regenerate input_schema.json)
- `autonomous-maintenance:docs/gen-md-regions` (regenerate @generated markdown regions)
- `autonomous-maintenance:sync/gui` (verify internal consistency)
- `autonomous-maintenance:sync/docs` (sync READMEs)
- `autonomous-maintenance:sync/opencode` (sync to opencode)
- `autonomous-maintenance:test/local` (build + unit tests + lint autofix)
- `autonomous-maintenance:test/typescript-autofix` (TypeScript review)
- `autonomous-maintenance:test/dead-code-autofix` (dead code cleanup)
- `autonomous-maintenance:test/deps-autofix` (dependency security)
- `autonomous-maintenance:test/spelling-autofix` (spelling)
- `autonomous-maintenance:schema/validate` (Actor schema validation)

Skip `autonomous-maintenance:test/apify-platform` — platform tests require Apify cloud access and should be run explicitly.

## Step COMMIT: Commit and Push

After all sub-commands complete, use `/git:commit` to commit and push all changes.

The commit message should summarize which sub-commands ran and what was fixed.
