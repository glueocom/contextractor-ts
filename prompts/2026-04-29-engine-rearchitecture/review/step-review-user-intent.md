# Review: User Intent Alignment

Reviews the complete implementation against original user intent and all Q&A decisions. Automatically fixes all gaps and mismatches found.

## Source documents

- [`../user-entry-log/entry-initial-prompt.md`](../user-entry-log/entry-initial-prompt.md) — original prompt (source of truth)
- [`../user-entry-log/entry-qa-native-rename.md`](../user-entry-log/entry-qa-native-rename.md) — native rename decision
- [`../user-entry-log/entry-qa-branch-strategy.md`](../user-entry-log/entry-qa-branch-strategy.md) — single-branch decision

## Step CHECK-ACTIONS: Verify each action from the prompt

For each numbered action in `entry-initial-prompt.md`:

**Action 1 — Split engine**:
- `@contextractor/extraction` exists with no Crawlee/Playwright deps
- `@contextractor/crawler` exists with `Sink<T>`, `fileSink`, `memorySink`
- `kvsSink` and `datasetSink` are NOT in a package — they are in `apps/apify-actor/src/`
- Native binding renamed to `@contextractor/extraction-native` (Q&A decision)

**Action 2 — Replace cookie handling**:
- `COOKIE_DISMISS_SCRIPT` is gone from both apps
- `@ghostery/adblocker-playwright` is wired in `packages/crawler/src/browser/cookies.ts`
- `@duckduckgo/autoconsent` is present as a lazy fallback
- `idcac-playwright` is not a dependency anywhere
- `@cliqz/adblocker-playwright` is not a dependency anywhere

**Action 3 — Use Crawlee built-ins**:
- No manual `scrollBy(0, 500)` loop anywhere in TypeScript source
- `useSessionPool: true` + `persistCookiesPerSession: true` are set in the crawler factory
- `@apify/scraper-tools` is not a dependency anywhere

**Action 4 — Rename**:
- `apps/apify-actor/` exists (was `contextractor-apify`)
- `apps/standalone/` exists (was `contextractor-standalone`)
- `packages/schema/` exists (was `contextractor-schema`); `@contextractor/schema` package name unchanged
- Apify Console git path update is documented (PR description note is sufficient)

**Action 5 — Shrink entry points**:
- `apps/apify-actor/src/main.ts`: ≤30 LOC, no Playwright import
- `apps/standalone/src/cli.ts`: ≤40 LOC, no Playwright import

**Action 6 — Update all docs**:
- READMEs, `.actor/` spec, `INPUT_SCHEMA.json` descriptions updated
- `CLAUDE.md` project structure matches new tree
- No stale symbol references in any markdown or JSON file

Fix any gaps found.

## Step CHECK-QA: Verify Q&A decisions implemented

- Native binding is `@contextractor/extraction-native-*` everywhere (not `engine-native`)
- Implementation is on a single branch (not split into sub-PRs)

## Step FINAL-BUILD: Confirm clean build

Run `pnpm build`. Run `pnpm test`. Run `pnpm lint`. Run `cargo test --workspace`. Run `cargo clippy --workspace --all-targets -- -D warnings`. All must pass. Fix any remaining failures.
