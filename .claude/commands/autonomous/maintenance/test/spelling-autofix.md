---
description: Check and fix typos and grammar errors in source files and documentation
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
model: haiku
skills: autonomous-task
---

Check all source files and documentation for typos and grammar errors, and fix them. Save a report to `autonomous-task-output/{agent}/`.

## Step BOOTSTRAP: Verify Configuration

Check that `cspell.json` exists at the repo root:

```bash
test -f cspell.json && echo "OK" || echo "MISSING"
```

If `cspell.json` is missing, write an error to `autonomous-task-output/{agent}/reports/test-spelling-autofix-report.md` explaining that `cspell.json` must exist before running this command, and exit. Do not run cspell without configuration — it will produce 100% false positives.

## Step COUNT: Count Flagged Words

```bash
npx cspell lint "**/*.ts" "**/*.md" "**/*.json" "**/*.toml" --no-progress --words-only --unique --dot 2>&1 | wc -l
```

If the count is 0, skip to Step REPORT.

## Step REVIEW: Review Flagged Words

Run to get the full list:

```bash
npx cspell lint "**/*.ts" "**/*.md" "**/*.json" "**/*.toml" --no-progress --dot 2>&1
```

For each flagged word, determine the correct action:
- **Genuine prose typo** — fix the word in-place
- **Valid domain term not yet in config** — add to `words` in `cspell.json`
- **External identifier or proper noun** — add to `ignoreWords` in `cspell.json`

Do NOT change:
- Technical identifiers (variable names, function names, package names)
- Intentional abbreviations in code
- Words in test fixtures or HTML files

## Step FIX: Apply Fixes

Apply in-place edits for genuine typos. Record each fix: file path, line number, original word, corrected word.

Update `cspell.json` with any new `words` or `ignoreWords` entries identified in Step REVIEW.

## Step REPORT: Save Report

Save `autonomous-task-output/{agent}/reports/test-spelling-autofix-report.md` with:
- Files scanned
- Unique flagged words before and after fix
- Words added to `cspell.json words`
- Words added to `cspell.json ignoreWords`
- Genuine typos fixed (file, line, original → corrected)
- Words deferred for human review (if any)
