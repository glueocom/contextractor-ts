> **TLDR**: Remove `tieredProxyUrls` and `tieredProxyConfig` from every layer of the monorepo — Zod schema, Apify Actor, standalone CLI, generated JSON, SPEC.md files, and READMEs. Keep all other proxy functionality (`proxyConfiguration`, `proxyRotation`, `sessionPoolName`, `maxSessionRotations`) untouched. Fix unrelated issues found along the way. Validate locally then deploy to the Apify platform.

## Background

See `context/tiered-proxy-investigation.md` and `context/ressearch-by-claude-desktop.md` for rationale. Key point: tiered proxy fields are non-canonical for Apify input schemas, render as raw JSON editors in the Console, and are not exposed by any official Apify first-party actor.

## Skills and Agents

- `ts-pro` — TypeScript edits to Zod schema, Actor entry point, CLI, config types
- `apify-schemas` — `gen-input-schema` tooling for regenerating `input_schema.json`
- `platform:deploy-and-test` skill — platform build and test crawl

---

## Step SCHEMA: Remove from Zod source of truth

File: `packages/schema/src/source-of-truth/input.ts`

- Delete the `tieredProxyUrls` field definition entirely.
- Delete the `tieredProxyConfig` field definition entirely.
- Leave `proxyConfiguration`, `proxyRotation`, `sessionPoolName`, `maxSessionRotations` untouched.

---

## Step ACTOR: Simplify Actor proxy wiring

File: `apps/apify-actor/src/run.ts`

- Remove the three if/else-if branches that handle `tieredProxyUrls` and `tieredProxyConfig` (including both mutual-exclusivity checks and the `as unknown` cast).
- Replace with a single branch:
  - If `input.proxyConfiguration` is set → `Actor.createProxyConfiguration(input.proxyConfiguration)`.
  - Otherwise → `proxyConfig = undefined`.
- Remove `import type { ProxyConfigurationOptions } from 'apify'` if it becomes unused after this change.

---

## Step CLI: Remove from standalone CLI

File: `apps/standalone/src/cliProgram.ts`

- Remove the `tieredProxyUrls` proxy-construction block (validates URLs, constructs `ProxyConfiguration`).
- Remove the mutual-exclusivity check between `--proxy` and `tieredProxyUrls`.

File: `apps/standalone/src/config.ts`

- Remove `tieredProxyUrls` and `tieredProxyConfig` from `CrawlConfig` and any other types if present.

---

## Step GENERATE: Regenerate input_schema.json

```bash
pnpm --filter @contextractor/gen-input-schema start
```

Verify:
```bash
grep -E "tieredProxy" apps/apify-actor/.actor/input_schema.json
# Expected: no output.
```

---

## Step DOCS: Update SPEC.md files

- `packages/schema/SPEC.md` — remove `tieredProxyUrls` and `tieredProxyConfig` from the Proxy section.
- `apps/apify-actor/SPEC.md` — remove tiered proxy from the proxy-wiring section (keep `proxyConfiguration` path description).
- `packages/crawler/SPEC.md` — remove the tiered-escalation sentence from the proxy paragraph.

Then regenerate README `@generated` regions:
```bash
pnpm docs:update
```

Manually check `apps/standalone/README.md` for hand-written prose referencing tiered proxies (around line 192) and remove those sentences. The `apps/apify-actor/README.md` input table is fully `@generated` and needs no manual edit.

---

## Step AUTOFIX: Fix unrelated issues found along the way

While editing, apply any other issues found (`auto-fix` and `confident-fix` buckets only — not architectural changes). Document fixes in the commit message.

---

## Step VERIFY: Local validation

```bash
pnpm build
pnpm lint
pnpm test
cargo build --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

Also run:
```bash
# No tiered proxy references remain in source or schema
grep -rn "tieredProxy" packages/schema/src/ apps/apify-actor/src/ apps/standalone/src/ apps/apify-actor/.actor/input_schema.json
# Expected: no output.
```

Fix any TypeScript errors surfaced by the build before proceeding.

---

## Step PLATFORM: Deploy and test

Invoke `/platform:deploy-and-test`.

Use this test crawl input to confirm the proxy section works without tiered fields:
```json
{
  "startUrls": [{ "url": "https://en.wikipedia.org/wiki/Web_scraping" }],
  "maxRequestsPerCrawl": 1,
  "proxyConfiguration": { "useApifyProxy": false },
  "save": ["markdown"]
}
```

The Apify Console input form must show no tiered proxy JSON fields.
