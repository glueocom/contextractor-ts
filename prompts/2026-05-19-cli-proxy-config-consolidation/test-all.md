# Full Validation Suite

> **TLDR**: Runs the complete validation pipeline after all implementation prompts: local build + lint + unit tests, proxy rotation tests with auto-fix, and an Apify platform deploy + test crawl with auto-fix.

> **Note:** This is a greenfield project — no backward compatibility requirements.

Run this prompt after all three implementation prompts complete (`implement.md`, `review-all-commands.md`, `global-schema-cli-review.md`).

## Skills and Agents

- `ts-pro` — fix any TypeScript or lint errors
- `proxy-test` skill — proxy rotation tests with auto-fix
- `platform:deploy-and-test` command — Apify platform deploy and test crawl

---

## Step BUILD: Local Build and Tests

```bash
pnpm build
pnpm fix
pnpm lint
pnpm test
```

Fix all errors before proceeding. Common issues after these changes:

- TypeScript references to removed flags (`proxyTier`, `proxyTiers`, `exclusiveStartKey`, `WAIT_UNTIL_MAP`)
- Biome lint violations introduced by edits
- Unit tests asserting old SCREAMING `waitUntil` values

---

## Step PROXY: Proxy Rotation Tests

Run `/proxy-test` — starts mock HTTP proxy servers, tests all entry points (library, CLI, Actor), auto-fixes failures on one retry, and reports results.

The `/proxy-test` command sets `PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1` automatically.

Expected passing tests after changes:

- `lib.test.ts`: flat proxy rotation
- `cli.test.ts`: flat rotation + tiered proxy via `--config tieredProxyUrls` (replaces old `--proxy-tier` tests)
- `actor.test.ts`: flat rotation + `tieredProxyUrls` input + mutual exclusivity validation

Autofix any failures before proceeding.

---

## Step PLATFORM: Apify Platform Deploy and Test

Run `/platform:deploy-and-test` — validates locally, pushes to `dev` branch (triggers build on `glueo/contextractor-test`), waits for build success, runs a test crawl on Wikipedia, and auto-fixes build and run errors.

Prerequisites:

- `apify info` must succeed — if not, the user must run `apify login` first
- Current branch must be `dev`

The command auto-fixes build errors. If a run fails, it diagnoses the log and fixes the source code before retrying.

Report the final build URL and run URL to the user.
