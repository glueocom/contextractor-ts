---
description: Regenerate @generated markdown regions in all READMEs from the Zod schema and CLI
allowed-tools: Bash(pnpm:*), Read
---

Regenerate all `<!-- @generated:start … -->` / `<!-- @generated:end -->` regions in every markdown file in the repo. These regions contain CLI flags, Apify INPUT_SCHEMA fields, enum values, and the `ContextractorInputType` interface — all derived from `packages/schema/src/input.ts` and `apps/standalone/src/cliProgram.ts`.

## Step GENERATE: Rewrite Markdown Regions

```bash
pnpm docs:update
```

This runs `tools/gen-md-regions` which walks all `.md` files in the repo (skipping `node_modules/`, `dist/`, `target/`, `prompts/`), finds `@generated:start name=...` markers, and rewrites the content between them in place.

## Step CHECK: Verify No Drift

```bash
pnpm docs:check
```

This re-runs generation and checks `git diff`. A non-zero exit means the repo has hand-edits inside marker regions. If the check fails, investigate which region drifted (the diff will show it) and pull the desired content into the canonical source (`packages/schema/src/input.ts` or `apps/standalone/src/cliProgram.ts`) rather than editing the marker region by hand.

## Step REPORT: Save Report

Save `autonomous-task-output/docs-gen-md-regions-report.md` with:
- Number of files updated
- Which regions were regenerated
- Whether the drift check passed
- Any errors encountered
