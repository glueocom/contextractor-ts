# Tests: Step AUTOCONSENT

Test the changes from [`../implementation/step-autoconsent.md`](../implementation/step-autoconsent.md). Automatically fix any failures.

## Step BUILD: Build crawler package

Run `pnpm build --filter @contextractor/crawler`. Fix any TypeScript errors in the autoconsent integration.

## Step LAZY-IMPORT: Verify `rejectViaAutoconsent` does not eagerly load autoconsent

Check that `@duckduckgo/autoconsent` is NOT statically imported at the top of any file. It must only be referenced via dynamic `import()`.

Run: `grep -n "^import.*autoconsent" packages/crawler/src/ -r` — zero hits expected. Fix if violated.

## Step UNIT: Run unit tests

Run `pnpm test`. Fix any failures.

## Step LINT: Lint

Run `pnpm lint`. Fix all Biome errors.
