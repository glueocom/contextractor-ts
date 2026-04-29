# Review: Step RENAME-APPS

Review the code changes from [`../implementation/step-rename-apps.md`](../implementation/step-rename-apps.md). Automatically fix all issues found.

## Step DIFF: Identify changes

Run `git log --oneline -20`. Identify the RENAME-APPS commit. Run `git diff {prev}..{rename-commit}`.

## Step REVIEW-DIRS: Verify directory renames completed

- `apps/apify-actor/` exists; `apps/contextractor-apify/` does not
- `apps/standalone/` exists; `apps/contextractor-standalone/` does not
- `packages/schema/` exists; `packages/contextractor-schema/` does not

## Step REVIEW-PKG-NAMES: Verify package name consistency

- `packages/schema/package.json`: `name` is still `@contextractor/schema` (npm name unchanged)
- All workspace `package.json` references to `contextractor-apify`, `contextractor-standalone`, `contextractor-schema` are updated

Run:
```
grep -r "contextractor-apify\|contextractor-standalone\|contextractor-schema" . \
  --include="*.json" --include="*.ts" --include="*.md" \
  --exclude-dir=".git" --exclude-dir="user-entry-log"
```
Fix any hits outside of the `user-entry-log/` and `engine-rearchitecture-notes/` directories.

## Step REVIEW-CLAUDE-MD: Verify CLAUDE.md project structure

Open `CLAUDE.md`. Confirm the project structure section shows `apps/apify-actor`, `apps/standalone`, `packages/extraction`, `packages/crawler`, `packages/schema`. Fix if stale.

## Step REVIEW-ACTOR-JSON: Verify `.actor/actor.json`

In `apps/apify-actor/.actor/actor.json`, confirm no paths reference `contextractor-apify`. Fix.
