# docs:gen-md-regions Report

**Date:** 2026-05-20

## Summary

- **Files updated:** 0
- **Regions regenerated:** none (all regions were already current)
- **Drift check:** passed
- **Errors:** none

## Details

`pnpm docs:update` ran `tools/gen-md-regions` which walked all `.md` files in the repo (skipping `node_modules/`, `dist/`, `target/`, `prompts/`) and found no `@generated` regions that needed rewriting. All marker regions are already in sync with `packages/schema/src/input.ts` and `apps/standalone/src/cliProgram.ts`.

`pnpm docs:check` re-ran generation and confirmed `git diff` produced no changes — no hand-edits inside marker regions were detected.
