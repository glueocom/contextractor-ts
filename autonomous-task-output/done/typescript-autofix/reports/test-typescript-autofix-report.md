# TypeScript Autofix Report

Date: 2026-05-03

## Summary

No issues found or fixed. The codebase is clean.

## Step BIOME

Command: `npx biome check --write .`
Result: Checked 777 files in 189ms. No fixes applied.

## Step REVIEW

### Files reviewed (last 10 commits, non-test TS files)

- `apps/apify-actor/src/config.ts`
- `apps/apify-actor/src/run.ts`
- `apps/standalone/src/cliProgram.ts`
- `apps/standalone/src/config.ts`
- `packages/crawler/src/createCrawler.ts`
- `packages/crawler/src/index.ts`
- `packages/extraction/src/index.ts`
- `tools/gen-md-regions/src/emitters/apify-input-schema.ts`
- `tools/gen-md-regions/src/zod-walk.ts`
- `tools/platform-test-runner/src/apify-client.ts`
- `tools/platform-test-runner/src/runner.ts`

### Broader scan

Grep for `as any`, `: any`, `@ts-ignore`, `@ts-expect-error` across all `apps/`, `packages/`, `tools/` source files: **0 matches**.

Grep for non-null assertions (`!.`): **0 matches** — all `!` usages are boolean guards (`if (!x)`), not non-null postfix assertions.

Type assertions (`as`) found: all are justified boundary casts:
- `as const` — legitimate immutable tuple/object narrowing
- `as ProxyConfigurationOptions` — Apify SDK boundary, input already validated by Zod
- `as OutputFormat[]` — post-`Object.keys` narrowing where the source is typed `Record<OutputFormat, ...>`
- `as unknown as AutoconsentCtor` — dynamic import of untyped third-party ESM module
- `as { __autoconsentMsg?: ... }` — browser event data narrowing inside `page.evaluate`
- `as unknown as Record<string, unknown>` — Zod internals spelunking (documented with inline comments)
- `as unknown as ApifyInputSchemaJSON` — final cast after key-order reconstruction from `Record<string, unknown>`
- `'yaml' as string` — suppresses static import analysis of optional dep (documented)

### Exported function return types

All exported functions have explicit return type annotations. The grep for multiline signatures confirmed all had `: ReturnType` on the closing param line.

## Step FIX

No fixes applied. No autonomous-fixable issues were found.

## Step TYPECHECK

Command: `pnpm build`
Result: 10/10 packages built successfully, 0 type errors.

## Issues deferred

None.
