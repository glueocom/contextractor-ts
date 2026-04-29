# Review: Step AUTOCONSENT

Review the code changes from [`../implementation/step-autoconsent.md`](../implementation/step-autoconsent.md). Automatically fix all issues found.

## Step DIFF: Identify changes

Run `git log --oneline -20`. Identify the AUTOCONSENT commit. Run `git diff {prev}..{autoconsent-commit}`.

## Step REVIEW-LAZY: Verify lazy import pattern

In `packages/crawler/src/browser/cookies.ts`:
- `rejectViaAutoconsent` uses `await import('@duckduckgo/autoconsent')` (dynamic import) — not a top-level static import
- This keeps the package optional at runtime

Run: `grep -n "^import.*autoconsent" packages/crawler/src/browser/cookies.ts` — should return zero hits (no static top-level import). Fix if violated.

## Step REVIEW-LICENSE: Verify no GPL deps added

Run: `grep -r "idcac-playwright" packages/ apps/ --include="*.json" --include="*.ts"` — zero hits expected.

Confirm `@duckduckgo/autoconsent` is in `optionalDependencies` (not `dependencies`) in `packages/crawler/package.json`.

## Step REVIEW-OPTION-WIRING: Verify `cookieStrategy: 'autoconsent'` wiring

In `packages/crawler/src/createCrawler.ts`:
- `cookieStrategy: 'autoconsent'` triggers `rejectViaAutoconsent` in `postNavigationHooks`
- `cookieStrategy: 'ghostery'` (default) still wires `installCookieDefences` in `preNavigationHooks`
- `cookieStrategy: 'none'` skips all cookie handling

## Step REVIEW-EXPORT: Verify export

`rejectViaAutoconsent` is exported from `packages/crawler/src/index.ts`. Fix if missing.
