# Review: Step DOCS-SWEEP

Review the documentation changes from [`../implementation/step-docs-sweep.md`](../implementation/step-docs-sweep.md). Automatically fix all issues found.

## Step DIFF: Identify changes

Run `git log --oneline -20`. Identify the DOCS-SWEEP commit. Run `git diff {prev}..{docs-commit} -- "*.md" "*.json"`.

## Step REVIEW-STALE-SYMBOLS: Grep for deleted symbols

Run each grep; any hits in non-research/non-log files are errors:
```
grep -r "COOKIE_DISMISS_SCRIPT\|idcac-playwright\|closeCookieModals\|scrollBy" \
  --include="*.md" --include="*.json" . \
  --exclude-dir="engine-rearchitecture-notes" --exclude-dir="user-entry-log"
```
Fix all hits.

## Step REVIEW-STALE-PATHS: Grep for old directory paths

```
grep -r "contextractor-apify\|contextractor-standalone\|contextractor-engine\|contextractor-schema" \
  --include="*.md" --include="*.json" . \
  --exclude-dir="engine-rearchitecture-notes" --exclude-dir="user-entry-log"
```
Fix all hits.

## Step REVIEW-CLAUDE-MD: Final CLAUDE.md check

Open `CLAUDE.md`. Verify:
- Project structure tree matches actual filesystem
- All package names correct
- No references to deleted symbols or old paths

Fix if stale.
