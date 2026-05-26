> **TLDR**: Remove `tieredProxyUrls` and `tieredProxyConfig` from the Zod schema and all surfaces (Actor, standalone CLI, docs). These are non-canonical for Apify input schemas — the platform has no tiered-proxy editor, so they render as raw JSON fields in the Console. Tiered behavior belongs in code, not in the schema. The standard `proxyConfiguration` field (with `editor: "proxy"`) stays as-is. Read both research documents in `context/` before starting.

## Background

See `context/tiered-proxy-investigation.md` and `context/ressearch-by-claude-desktop.md` for the full rationale. Key points:

- `tieredProxyUrls` and `tieredProxyConfig` render as raw JSON editors in the Apify Console — no proxy-aware UI, no validation.
- No official Apify first-party actor (`playwright-scraper`, `web-scraper`, `cheerio-scraper`) exposes tiered proxy as input schema fields. GitHub-wide search returns zero results for `tieredProxyUrls` or `tieredProxyConfig` inside any Apify `INPUT_SCHEMA.json`.
- The Apify input schema spec's `object` editor enum is `["json", "proxy", "schemaBased", "hidden"]` — there is no `tieredProxy` editor.
- `tieredProxyUrls` is a Crawlee SDK / code-level feature. `tieredProxyConfig` is an Apify SDK extension. Both belong in Actor code, not in user-facing schema.
- `tieredProxyConfig` is NOT exposed in the standalone CLI at all — only the Apify Actor uses it, via an `as unknown` cast.

## Decision Point Before Starting

Choose one of two paths and implement it consistently across all layers:

**Path A — Remove and hardcode (recommended for now)**
Drop both tiered fields entirely. In the Actor, hardcode tiered behavior in `run.ts` (e.g., datacenter → residential tier based on `proxyConfiguration.apifyProxyGroups`). The standalone CLI loses `tieredProxyUrls` config-file support.

**Path B — Remove and replace with `proxyStrategy` enum**
Drop both tiered fields. Add a `proxyStrategy` enum (`datacenter | residential | tiered`) to the schema. In the Actor and CLI, branch on `proxyStrategy` to construct the right `ProxyConfiguration` in code. This preserves user control without exposing raw URL arrays.

The steps below apply to whichever path is chosen. Steps marked **[Path B only]** are skipped for Path A.

---

## Step SCHEMA: Update Zod source of truth

File: `packages/schema/src/source-of-truth/input.ts`

- Remove the `tieredProxyUrls` field definition entirely.
- Remove the `tieredProxyConfig` field definition entirely.
- **[Path B only]** Add a `proxyStrategy` field in the Proxy section (after `proxyRotation`):
  ```ts
  proxyStrategy: z
    .enum(['datacenter', 'residential', 'tiered'])
    .default('datacenter')
    .describe(
      'Proxy escalation strategy. datacenter: use the selected proxy pool flat; ' +
        'residential: force residential tier; tiered: start on datacenter, auto-escalate ' +
        'to residential on block detection.',
    )
    .meta({
      title: 'Proxy strategy',
      ...apifyMeta({
        editor: 'select',
        enumTitles: [
          'Datacenter (fast, may be blocked)',
          'Residential (slow, rarely blocked)',
          'Tiered fallback (auto-escalate)',
        ],
      }),
    }),
  ```
- Verify `proxyConfiguration`, `proxyRotation`, `sessionPoolName`, `maxSessionRotations` remain unchanged.

---

## Step ACTOR: Update Apify Actor entry point

File: `apps/apify-actor/src/run.ts`

Remove the three if/else-if branches that handle `tieredProxyUrls` and `tieredProxyConfig` (lines 42–68 as of the investigation). Replace with:

**Path A:**
```ts
let proxyConfig: Awaited<ReturnType<typeof Actor.createProxyConfiguration>> | undefined;
if (input.proxyConfiguration) {
  proxyConfig = await Actor.createProxyConfiguration(
    input.proxyConfiguration as ProxyConfigurationOptions,
  );
}
```

**Path B** — branch on `proxyStrategy` to construct tiered config in code:
```ts
let proxyConfig: Awaited<ReturnType<typeof Actor.createProxyConfiguration>> | undefined;
if (input.proxyConfiguration || input.proxyStrategy === 'tiered' || input.proxyStrategy === 'residential') {
  const baseConfig = (input.proxyConfiguration ?? {}) as ProxyConfigurationOptions;
  if (input.proxyStrategy === 'tiered') {
    proxyConfig = await Actor.createProxyConfiguration({
      tieredProxyConfig: [
        { ...baseConfig },
        { ...baseConfig, groups: ['RESIDENTIAL'] },
      ],
    } as unknown as ProxyConfigurationOptions);
  } else if (input.proxyStrategy === 'residential') {
    proxyConfig = await Actor.createProxyConfiguration({
      ...baseConfig,
      groups: ['RESIDENTIAL'],
    });
  } else {
    proxyConfig = await Actor.createProxyConfiguration(baseConfig);
  }
}
```

Remove the `import type { ProxyConfigurationOptions } from 'apify'` import if it is no longer used after Path A (check before removing).

---

## Step CLI: Update standalone CLI

File: `apps/standalone/src/cliProgram.ts`

- Remove the `tieredProxyUrls` branch (lines 523–541 as of the investigation).
- Remove the mutual-exclusivity check for `--proxy` and `tieredProxyUrls` (lines 480–486).
- **[Path B only]** After the `proxyConfiguration` block, add a branch that checks `parsed.data.proxyStrategy` and constructs a tiered `ProxyConfiguration` in code — same logic as the Actor step above, adapted for the Crawlee standalone context (use `new ProxyConfiguration(...)` directly instead of `Actor.createProxyConfiguration`).

File: `apps/standalone/src/config.ts`

- Update `CrawlConfig` type: remove `tieredProxyUrls` and `tieredProxyConfig` if present.
- **[Path B only]** Add `proxyStrategy` to `CrawlConfig`.

---

## Step GENERATE: Regenerate input_schema.json

```bash
pnpm --filter @contextractor/gen-input-schema start
```

Verify the generated `apps/apify-actor/.actor/input_schema.json`:
- No `tieredProxyUrls` or `tieredProxyConfig` properties.
- **[Path B only]** `proxyStrategy` present with `editor: "select"` and correct `enum`/`enumTitles`.
- `proxyConfiguration` still present with `editor: "proxy"`.

---

## Step TESTS: Update tests

Files to check and update:
- `apps/apify-actor/src/config.test.ts` — remove any test cases that reference `tieredProxyUrls` or `tieredProxyConfig` in input fixtures. **[Path B only]** Add cases for each `proxyStrategy` value.
- `apps/standalone/src/cli.test.ts` — remove tests that pass `tieredProxyUrls` via config. **[Path B only]** Add tests for `proxyStrategy` values.
- `packages/schema/test/input.test.ts` — remove test cases that supply `tieredProxyUrls` / `tieredProxyConfig`. **[Path B only]** Add `proxyStrategy` test cases.
- `packages/schema/test/to-apify-schema.test.ts` — update snapshot or assertions for the proxy section.

---

## Step DOCS: Update SPEC.md and README files

### `packages/schema/SPEC.md`
- In the **Proxy** section of the schema structure, remove `tieredProxyUrls` and `tieredProxyConfig` entries.
- **[Path B only]** Add `proxyStrategy` description.

### `apps/apify-actor/SPEC.md`
- Remove any mention of `tieredProxyUrls` or `tieredProxyConfig` in the proxy/data-flow sections.
- **[Path B only]** Document `proxyStrategy` and how it maps to `ProxyConfiguration` construction.

### `apps/standalone/SPEC.md`
- Remove `tieredProxyUrls` from the config-file fields table.
- **[Path B only]** Add `proxyStrategy` field.

### `apps/apify-actor/README.md` and `apps/standalone/README.md`
- Run `pnpm docs:update` after schema and SPEC changes — this regenerates the `@generated` regions in READMEs from the schema and SPEC automatically.
- Manually check the Proxy section in both READMEs for any hand-written documentation that mentions the removed fields. Remove or replace.

---

## Step VERIFY

```bash
pnpm build
pnpm lint
pnpm test
cargo build --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

After tests pass, run the grep checks:
```bash
# No tiered fields remain in schema or Actor source
grep -rnE "tieredProxyUrls|tieredProxyConfig" packages/schema/src/ apps/apify-actor/src/ apps/standalone/src/
# Expected: no matches.

# input_schema.json has no tiered fields
grep -E "tieredProxy" apps/apify-actor/.actor/input_schema.json
# Expected: no matches.

# proxyConfiguration still present with proxy editor
grep -A3 '"proxyConfiguration"' apps/apify-actor/.actor/input_schema.json | grep '"editor": "proxy"'
# Expected: one match.
```

---

## Step PLATFORM: Deploy and verify

Run `/platform:deploy-and-test` to push to `glueo/contextractor-test`, wait for the build, and run a test crawl. The Console input form must show the standard Proxy configuration picker with no tiered-proxy JSON fields.

Test crawl input to verify the proxy section works:
```json
{
  "startUrls": [{ "url": "https://en.wikipedia.org/wiki/Web_scraping" }],
  "maxRequestsPerCrawl": 1,
  "proxyConfiguration": { "useApifyProxy": false },
  "save": ["markdown"]
}
```
