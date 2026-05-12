# Markdown Regions Regeneration Report

**Date:** 2026-05-12  
**Status:** ✅ PASSED

## Summary

All `<!-- @generated:start … -->` / `<!-- @generated:end -->` regions in the repository are synchronized with source code. No manual edits or drift detected.

## Files Processed

**Total files updated:** 0

**Regions found and verified:**

- `README.md`
  - Region: `input-type` ✅

- `packages/schema/README.md`
  - Region: `input-type` ✅
  - Region: `enum-values` ✅

- `apps/standalone/README.md`
  - Region: `cli-flags` ✅
  - Region: `enum-values` ✅

- `apps/apify-actor/README.md`
  - Region: `apify-input-schema` ✅

## Source Files

Regions are derived from:
- `packages/schema/src/input.ts` — Zod schema, ContextractorInputType interface, enum values
- `apps/standalone/src/cliProgram.ts` — CLI flags and options

## Drift Check

**Command:** `pnpm docs:check` (runs generation + `git diff --exit-code`)  
**Result:** ✅ PASSED (exit code 0)

No differences detected between generated content and current markdown files. All regions are in sync.

## Conclusion

The markdown regions are in sync and require no updates. The codebase is ready for commit.
