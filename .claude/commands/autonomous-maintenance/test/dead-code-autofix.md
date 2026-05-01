---
description: Detect and remove dead code, unused exports, and unused dependencies
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
skills: autonomous-task
---

Detect and remove dead code, unused exports, and unused dependencies across the repo. Save a report to `autonomous-task-output/`.

## Step SCAN: Run knip

```bash
npx knip --reporter compact 2>&1
```

If knip is not installed: `pnpm add -D knip` at the repo root.

Categorize findings:
- Unused files (safe to delete)
- Unused exports (verify before removing — may break external consumers)
- Unused dependencies (safe to remove from `package.json`)
- Unused dev dependencies

## Step FIX: Remove Dead Code

Fix issues that can be resolved autonomously:
- Remove unused `devDependencies` from `package.json`
- Remove unused dependencies that have no external consumers
- Delete clearly unused files (confirmed by knip and no external references)
- Remove unused exports where the function is also unused internally

Do NOT remove:
- Public API exports (types, classes, functions exported from `@contextractor/*` packages)
- Dependencies that are used at runtime but may not be detected by knip (e.g., peer deps)
- Exports with `// @public` or similar annotations

## Step VERIFY: Rebuild After Changes

```bash
pnpm build
pnpm test
```

Ensure nothing broke after removing dead code.

## Step REPORT: Save Report

Save `autonomous-task-output/test-dead-code-autofix-report.md` with:
- Total findings by category
- Items removed
- Items deferred (save to `autonomous-task-output/test-dead-code-autofix-prompt.md`)
