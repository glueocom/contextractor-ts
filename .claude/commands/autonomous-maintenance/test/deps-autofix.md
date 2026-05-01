---
description: Audit dependencies for security vulnerabilities and auto-fix
allowed-tools: Read, Write, Edit, Bash
model: sonnet
skills: autonomous-task
---

Audit all dependencies for security vulnerabilities and apply safe fixes. Save a report to `autonomous-task-output/`.

## Step AUDIT: Security Audit

```bash
pnpm audit --audit-level=high 2>&1
```

Summarize: total vulnerabilities by severity (critical, high, moderate, low).

## Step OUTDATED: Check Outdated Versions

```bash
pnpm outdated 2>&1 | head -50
```

## Step FIX: Apply Safe Fixes

```bash
pnpm audit fix
```

Apply auto-fixable vulnerabilities (patch/minor updates only).

Do NOT automatically update:
- Major versions (breaking changes)
- Direct dependencies that affect the public API of `@contextractor/*` packages

## Step CARGO: Audit Rust Dependencies

```bash
cargo audit 2>&1
```

If `cargo-audit` is not installed: `cargo install cargo-audit`.

Review any Rust advisories and fix where safe.

## Step REPORT: Save Report

Save `autonomous-task-output/test-deps-autofix-report.md` with:
- TS vulnerabilities found and fixed
- Rust advisories found
- Outdated major versions requiring manual update (save to `autonomous-task-output/test-deps-autofix-prompt.md`)
