# Step AUTOCONSENT: Add `@duckduckgo/autoconsent` fallback

## TLDR

Adds `@duckduckgo/autoconsent` (MPL-2.0, lazy-loaded) to `@contextractor/crawler` as a fallback for sites requiring a real Reject-All click flow. Wires it via `postNavigationHooks` when `cookieStrategy: 'autoconsent'`. License: MPL-2.0, safe to ship.

**Notes**: [`../engine-rearchitecture-notes/research-cookie-dismissal.md`](../engine-rearchitecture-notes/research-cookie-dismissal.md) §4 for API and wire-up pattern

**Skills/agents**: `ts-pro`

---

## Step ADD-DEP: Add dependency

In `packages/crawler/package.json`, add `@duckduckgo/autoconsent` as an optional dependency (`optionalDependencies`) at the latest `^14.x` version.

## Step IMPLEMENT: Add `rejectViaAutoconsent`

In `packages/crawler/src/browser/cookies.ts`, add:

- `rejectViaAutoconsent(page: Page): Promise<{ cmp?: string; success: boolean }>` — lazy-imports `@duckduckgo/autoconsent` via `await import(...)` (keeps it tree-shakeable and avoids cold-start cost when not used); implements the `page.addInitScript` + message-bus pattern from the research notes; resolves on `autoconsentDone`/`autoconsentError` or after 8-second timeout

Export `rejectViaAutoconsent` from `packages/crawler/src/index.ts`.

## Step WIRE: Wire into crawler factory

In `packages/crawler/src/createCrawler.ts`:
- When `cookieStrategy === 'autoconsent'`, add a `postNavigationHooks` entry that calls `rejectViaAutoconsent(page)` and logs the result

## Step VERIFY: Build and test

Run `pnpm build`. Run `pnpm test`. Fix any issues.

Commit message: `feat(crawler): add @duckduckgo/autoconsent lazy fallback (cookieStrategy: "autoconsent")`
