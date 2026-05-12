# docs-gen-md-regions Report

**Date:** 2026-05-12

## Summary

- **Files updated:** 0 (all regions already current)
- **Drift check:** passed (git diff --exit-code returned 0)
- **Errors:** none

## Details

`pnpm docs:update` ran `tools/gen-md-regions` which walked all `.md` files in the repo
(skipping `node_modules/`, `dist/`, `target/`, `prompts/`) and found no `@generated` regions
requiring rewrite. All content between `<!-- @generated:start -->` and `<!-- @generated:end -->`
markers is already in sync with `packages/schema/src/input.ts` and
`apps/standalone/src/cliProgram.ts`.

`pnpm docs:check` re-ran generation and confirmed zero diff against the working tree.
