# Dead Code Autofix Report

**Date:** 2026-05-20
**Tool:** knip 6.14.1

## Summary

| Category | Found | Fixed | Deferred |
| --- | --- | --- | --- |
| Unused files | 0 | 0 | 0 |
| Unused exports | 0 | 0 | 0 |
| Unused dependencies | 3 | 3 | 0 |
| Unused devDependencies | 0 | 0 | 0 |

## Findings and Actions

### Unused dependencies removed

**`tools/proxy-rotation-tester/package.json`**

- `@contextractor/extraction` — not imported in any source file
- `@contextractor/schema` — not imported in any source file
- `proxy-chain` — not imported in any source file

All three were confirmed unused by grepping all imports across `tools/proxy-rotation-tester/src/`. The tool only uses `@contextractor/crawler` and `proxy-simulator`.

## Verification

- `pnpm build` — all 10 packages built successfully (full turbo cache hit)
- `pnpm test` — 15/15 test suites passed, 219 tests total

## Deferred Items

None.
