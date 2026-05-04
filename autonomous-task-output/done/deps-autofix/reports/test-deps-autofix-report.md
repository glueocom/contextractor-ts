# Dependency Security Audit Report

**Date:** 2026-05-03
**Agent:** deps-autofix

## TypeScript Dependencies

### Audit Results

```
pnpm audit --audit-level=high
```

**Result:** No known vulnerabilities found.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Moderate | 0 |
| Low | 0 |

### Outdated Packages

```
pnpm outdated
```

**Result:** No outdated packages detected.

### Fixes Applied

No fixes needed — audit was clean.

## Rust Dependencies

### Audit Results

```
cargo audit (131 crate dependencies scanned)
```

**Result:** No security advisories found.

## Outdated Major Versions Requiring Manual Update

None identified.

## Summary

All TypeScript and Rust dependencies are up to date with no known security vulnerabilities.
No action required.
