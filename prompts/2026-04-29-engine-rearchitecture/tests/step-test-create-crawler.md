# Tests: Step CREATE-CRAWLER

Test the changes from [`../implementation/step-create-crawler.md`](../implementation/step-create-crawler.md). Automatically fix any failures.

## Step BUILD: Build crawler package and apps

Run `pnpm build --filter @contextractor/crawler`. Fix TypeScript errors.

Run `pnpm build` from root (full workspace build). Fix any broken cross-package imports.

## Step LOC: Verify entry-point line counts

Count non-blank non-comment lines:
- `apps/contextractor-apify/src/main.ts` (or renamed path): must be ≤30
- `apps/contextractor-standalone/src/cli.ts` (or renamed path): must be ≤40

If either exceeds the limit, refactor by moving logic into the respective package or config file.

## Step NO-PLAYWRIGHT-IMPORT: Verify entry-point cleanliness

Run:
```
grep -n "from 'playwright'\|from 'crawlee'" \
  apps/contextractor-apify/src/main.ts \
  apps/contextractor-standalone/src/cli.ts
```
Zero hits expected. Fix any direct Playwright/Crawlee imports in the entry-point files.

## Step UNIT: Run unit tests

Run `pnpm test` from root. Fix any failing vitest tests. Add tests for `fileSink` and `memorySink` if not covered by the generated-unit-tests package.

## Step LINT: Lint

Run `pnpm lint` from root. Fix all Biome errors.

## Step SMOKE: Smoke run

Run `apify run` (local Apify Actor smoke run). Verify the actor starts without errors. Fix any startup issues.
