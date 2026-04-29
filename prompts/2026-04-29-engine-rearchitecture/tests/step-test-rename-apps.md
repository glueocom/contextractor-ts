# Tests: Step RENAME-APPS

Test the changes from [`../implementation/step-rename-apps.md`](../implementation/step-rename-apps.md). Automatically fix any failures.

## Step BUILD: Full workspace build

Run `pnpm build` from repo root. All packages must build. Fix any path or import errors caused by directory renames.

## Step TEST: Full test suite

Run `pnpm test` from root. Fix any test-file path errors (e.g., `__dirname`-based paths that referenced old directory names).

## Step LINT: Lint all packages

Run `pnpm lint` from root. Fix all errors.

## Step GREP-STALE: Confirm no stale directory references in source

Run:
```
grep -r "contextractor-apify\|contextractor-standalone\|contextractor-schema" \
  apps/ packages/ tools/ \
  --include="*.ts" --include="*.json"
```
Zero hits expected (outside of `pnpm-lock.yaml` which is auto-managed). Fix any hits.
