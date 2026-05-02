---
description: Run all autonomous/maintenance commands sequentially, then commit and push results
---

# Maintenance Orchestrator

Run all autonomous/maintenance sub-commands sequentially across the repo, then commit and push.

## Step PREPARE: Clear Output Directory

Remove the agent's output folder and recreate it clean:

```bash
rm -rf autonomous-task-output/claude && mkdir -p autonomous-task-output/claude/reports autonomous-task-output/claude/prompts
```

## Step EXECUTE: Run Each Sub-command

Run each sub-command sequentially in this order. If a command fails, log the failure to `autonomous-task-output/claude/reports/maintenance-failures.md` and continue with the next.

- `/autonomous:maintenance:deps/update` — update all packages to latest
- `/autonomous:maintenance:schema/gen-input-schema` — regenerate input_schema.json
- `/autonomous:maintenance:docs/gen-md-regions` — regenerate @generated markdown regions
- `/autonomous:maintenance:sync/gui` — verify internal consistency
- `/autonomous:maintenance:sync/docs` — sync READMEs
- `/autonomous:maintenance:sync/opencode` — sync to opencode
- `/autonomous:maintenance:test/local` — build + unit tests + lint autofix
- `/autonomous:maintenance:test/typescript-autofix` — TypeScript review
- `/autonomous:maintenance:test/dead-code-autofix` — dead code cleanup
- `/autonomous:maintenance:test/deps-autofix` — dependency security
- `/autonomous:maintenance:test/spelling-autofix` — spelling
- `/autonomous:maintenance:schema/validate` — Actor schema validation

Skip `/autonomous:maintenance:test/apify-platform` — platform tests require Apify cloud access and must be run explicitly.

Skip `/autonomous:maintenance:smoke` — smoke test is for pipeline verification only, not part of regular maintenance.

## Step COMMIT: Commit and Push

After all sub-commands complete, run `/git:commit` to commit and push all changes.

The commit message should summarize which sub-commands ran and what was fixed.
