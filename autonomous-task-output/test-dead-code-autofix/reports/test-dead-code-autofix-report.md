# Dead Code Autofix Report

Date: 2026-05-12

## Summary

| Category | Found | Fixed | Deferred |
|---|---|---|---|
| Unused files | 3 | 0 deleted | 3 (all false positives) |
| Unused exports | 0 | — | — |
| Unused dependencies | 0 | — | — |
| Unused devDependencies | 0 | — | — |

## Findings

Knip reported 3 unused files. All three are intentional standalone scripts or examples — not dead code.

### False Positives Suppressed

- `dev-utils/installation/lib/pkg.ts` — invoked by `install.sh` and `ensureuninstalled.sh` via `tsx`; knip cannot trace shell script invocations
- `examples/library-ts/src/main.ts` — intentional demonstration script in its own package
- `examples/apify-api-ts/src/main.ts` — intentional demonstration script in its own package

## Changes Made

- `knip.json` — added `dev-utils/installation/lib/pkg.ts` and `examples/**` to the `ignore` list

## Verification

- `npx knip --reporter compact` → no output (clean)
- `pnpm build` → 10/10 tasks successful (fully cached)
- `pnpm test` → 13/13 tests passed (fully cached)
