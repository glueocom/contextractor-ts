---
description: Check and fix typos and grammar errors in source files and documentation
---

Check all source files and documentation for typos and grammar errors, and fix them. Save a report to `autonomous-task-output/`.

## Step CSPELL: Check Source Files

```bash
npx cspell "**/*.ts" "**/*.md" "**/*.json" --no-progress --exclude "node_modules/**" --exclude "dist/**" --exclude "target/**" 2>&1 | head -100
```

If cspell is not installed: `pnpm add -D cspell`.

## Step REVIEW: Review Flagged Words

For each flagged word:
- Determine if it is a genuine typo or a false positive (library name, domain term, acronym)
- Domain terms for this repo: `trafilatura`, `rs-trafilatura`, `napi`, `napi-rs`, `Crawlee`, `Playwright`, `Apify`, `contextractor`, `vitest`, `biome`, `turbo`, `pnpm`, `cspell`, `rustup`

## Step FIX: Fix Genuine Typos

Fix issues that can be resolved autonomously:
- Clear spelling errors in comments, documentation, and string literals
- Grammar errors in user-facing text (README, CLI help strings)
- Punctuation issues

Do NOT change:
- Technical identifiers (variable names, function names, package names)
- Intentional abbreviations in code
- Words in test fixtures or HTML files

## Step REPORT: Save Report

Save `autonomous-task-output/test-spelling-autofix-report.md` with:
- Files checked
- Genuine typos fixed
- False positives (ambiguous words logged to `autonomous-task-output/test-spelling-autofix-prompt.md`)
