# Tests: Step DOCS-SWEEP

Test the documentation changes from [`../implementation/step-docs-sweep.md`](../implementation/step-docs-sweep.md). Automatically fix any failures.

## Step GREP-DELETED-SYMBOLS: Verify no stale symbol references

Run each grep; any hits outside research/log directories are failures:

```
grep -r "COOKIE_DISMISS_SCRIPT\|idcac-playwright\|closeCookieModals\|scrollBy" \
  --include="*.md" --include="*.json" . \
  --exclude-dir=".git" --exclude-dir="engine-rearchitecture-notes" \
  --exclude-dir="user-entry-log"
```

```
grep -r "contextractor-apify\|contextractor-standalone\|contextractor-engine\|contextractor-schema" \
  --include="*.md" --include="*.json" . \
  --exclude-dir=".git" --exclude-dir="engine-rearchitecture-notes" \
  --exclude-dir="user-entry-log"
```

```
grep -r "@contextractor/engine[^-]" \
  --include="*.md" --include="*.json" . \
  --exclude-dir=".git" --exclude-dir="engine-rearchitecture-notes" \
  --exclude-dir="user-entry-log"
```

Fix all hits.

## Step CLAUDE-MD-STRUCTURE: Verify CLAUDE.md tree matches filesystem

Open `CLAUDE.md`. Compare the project structure section to the actual directory tree (`find apps packages -maxdepth 2 -type d`). Fix discrepancies.
