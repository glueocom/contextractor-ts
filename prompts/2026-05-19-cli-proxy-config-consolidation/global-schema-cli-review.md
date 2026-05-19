# Global CLI, Schema, and Source-of-Truth Review

> **TLDR**: Two changes: (1) changes `waitUntil` Zod enum from `['NETWORKIDLE','LOAD','DOMCONTENTLOADED']` to `['networkidle','load','domcontentloaded']` in `input.ts`, removes `WAIT_UNTIL_MAP` from `apps/apify-actor/src/config.ts`, simplifies `parseWaitUntil` in `cliProgram.ts`, updates `config.test.ts`, and regenerates `input_schema.json`; (2) adds a CLI flag → config file key mapping table to `standalone/README.md`.

> **Note:** This is a greenfield project — no backward compatibility requirements.

Related previous prompts (read first for context):
- `prompts/2026-05-19-cli-proxy-config-consolidation/implement.md` — proxy CLI flag removal
- `prompts/2026-05-19-cli-proxy-config-consolidation/review-all-commands.md` — list/kvs/extract usability fixes

External references for this review:
- Apify website-content-crawler: https://apify.com/apify/website-content-crawler/input-schema
- Apify playwright-scraper: https://apify.com/apify/playwright-scraper/input-schema
- Crawlee proxy docs: https://crawlee.dev/js/docs/guides/proxy-management
- Apify input schema spec: https://docs.apify.com/platform/actors/development/actor-definition/input-schema/specification/v1

## Skills and Agents

- `ts-pro` — TypeScript implementation changes
- `apify-schemas` skill — for schema field verification and gen-input-schema

---

## Step ANALYZE: Read Before Changing

Read all of these before making any edits:

- `packages/schema/src/source-of-truth/input.ts` — Zod source of truth
- `packages/schema/src/source-of-truth/output.ts` — output Zod schema
- `packages/schema/src/apify/apify-meta.ts` — Apify UI metadata helper
- `apps/apify-actor/.actor/input_schema.json` — generated Actor input schema
- `apps/apify-actor/.actor/output_schema.json` — Actor output schema
- `apps/apify-actor/src/config.ts` — contains `WAIT_UNTIL_MAP` and schema→crawler translation
- `apps/apify-actor/src/config.test.ts` — tests for config translation
- `apps/standalone/src/cliProgram.ts` — full file: `parseWaitUntil` at ~line 54, all flag definitions
- `apps/standalone/README.md` — user-facing docs
- `apps/standalone/SPEC.md`
- `packages/crawler/src/createCrawler.ts` — crawler `waitUntil` type at ~line 51

---

## Research findings (pre-completed)

These findings come from comparing contextractor against the live Apify actor schemas and Crawlee docs. Verify them when you read the files.

### What is correct and consistent (no changes needed)

These field names and patterns already match the Apify ecosystem standards:

- All schema field names use camelCase — correct
- `proxyConfiguration` with `editor: "proxy"` — matches all Apify actors
- `startUrls` with `editor: "requestListSources"` — correct
- `crawlerType` enum format: `playwright:adaptive`, `playwright:firefox`, `playwright:chromium`, `cheerio` — matches website-content-crawler pattern
- `proxyRotation: 'RECOMMENDED' | 'PER_REQUEST' | 'UNTIL_FAILURE'` — SCREAMING is intentional; playwright-scraper uses the same SCREAMING values
- `maxPagesPerCrawl`, `maxResultsPerCrawl`, `maxCrawlingDepth` — matches playwright-scraper field names
- `respectRobotsTxtFile`, `blockMedia`, `closeCookieModals`, `ignoreSslErrors`, `ignoreCorsAndCsp` — all match playwright-scraper
- `maxScrollHeightPixels` default 5000 — matches website-content-crawler and playwright-scraper
- `closeCookieModals` defaults to `true` — intentional; content extraction benefits from auto-dismissal
- `--save all` CLI alias — handled correctly by `validateSaveFormats` (imported from schema package)
- `parseWaitUntil` function exists in cliProgram.ts — the CLI correctly accepts lowercase and transforms to SCREAMING for Zod

### The one confirmed inconsistency: `waitUntil` enum casing

**Problem:** The `waitUntil` Zod enum uses `['NETWORKIDLE', 'LOAD', 'DOMCONTENTLOADED']` (SCREAMING_SNAKE_CASE). The data flow is:

```
CLI "networkidle" → parseWaitUntil() → "NETWORKIDLE" → Zod → WAIT_UNTIL_MAP in config.ts → "networkidle" → Playwright
```

playwright-scraper uses `['networkidle', 'load', 'domcontentloaded']` (lowercase) — matching Playwright's own API. contextractor uniquely adds two unnecessary translations. If schema stores lowercase directly:

```
CLI "networkidle" → parseWaitUntil() (validate only) → "networkidle" → Zod → Playwright (no map needed)
```

This removes `WAIT_UNTIL_MAP` entirely and simplifies `parseWaitUntil`.

Files affected: `input.ts`, `config.ts`, `config.test.ts`, `cliProgram.ts`, `input_schema.json` (regenerate).

### Documentation gap: CLI flag → schema key mapping

Users who switch from CLI flags to a `-c, --config` JSON file need to know the schema field names. These diverge significantly from the CLI flag names:

| CLI flag | Config file key | Note |
|---|---|---|
| `--cookies` | `initialCookies` | completely different name |
| `--headers` | `customHttpHeaders` | completely different name |
| `--max-pages` | `maxPagesPerCrawl` | abbreviated |
| `--max-results` | `maxResultsPerCrawl` | abbreviated |
| `--crawl-depth` | `maxCrawlingDepth` | abbreviated |
| `--rendering-detection-pct` | `renderingTypeDetectionPercentage` | abbreviated |
| `--ignore-cors` | `ignoreCorsAndCsp` | "AndCsp" dropped |
| `--wait-until` | `waitUntil` | matches after casing fix |
| `--crawler-type` | `crawlerType` | matches |
| `--proxy-rotation` | `proxyRotation` | matches |

The `apps/standalone/README.md` should document this mapping in a "Config file" section.

---

## Step IMPLEMENT: Code Changes

Use the Edit tool for all changes.

### Fix SCHEMA-1: Change `waitUntil` enum to lowercase

**In `packages/schema/src/source-of-truth/input.ts`:**

Change the enum values and default:
```typescript
// old
waitUntil: z.enum(['NETWORKIDLE', 'LOAD', 'DOMCONTENTLOADED']).default('LOAD')
// enumTitles are display-only, no change needed there

// new
waitUntil: z.enum(['networkidle', 'load', 'domcontentloaded']).default('load')
```

**In `apps/apify-actor/src/config.ts`:**

Remove `WAIT_UNTIL_MAP` entirely. Find the line that uses it (~line 55):
```typescript
// old: waitUntil: WAIT_UNTIL_MAP[input.waitUntil],
// new: waitUntil: input.waitUntil,
```
Also remove the `WAIT_UNTIL_MAP` constant definition.

**In `apps/standalone/src/cliProgram.ts`:**

Simplify `parseWaitUntil` (~line 54) — it no longer needs to transform case, just validate:
```typescript
// old: returns 'NETWORKIDLE', 'LOAD', 'DOMCONTENTLOADED'
// new: returns 'networkidle', 'load', 'domcontentloaded'
function parseWaitUntil(value: string): ContextractorInputType['waitUntil'] {
  const v = value.trim().toLowerCase();
  if (v === 'networkidle' || v === 'load' || v === 'domcontentloaded') return v;
  throw new Error(
    `Unsupported --wait-until value: '${value}'. Use networkidle, load, or domcontentloaded.`,
  );
}
```

**In `apps/apify-actor/src/config.test.ts`:**

Update any test that references `waitUntil: 'LOAD'` or similar SCREAMING values to use lowercase.

**After all edits, regenerate `input_schema.json`:**
```bash
pnpm --filter @contextractor/gen-input-schema start
```

Verify the generated `apps/apify-actor/.actor/input_schema.json` now shows lowercase enum values for `waitUntil`.

### Fix DOCS-1: Add CLI flag → config file key mapping to README

In `apps/standalone/README.md`, add a "Config file key reference" section (or table) documenting the mapping above. Place it near the existing "Options" table. Use the table format from the research findings section above. Keep it concise — just the non-obvious mappings where the flag name differs from the schema key.

### Fix DOCS-2: Update all SPEC.md and README.md files

After the code changes, search for any remaining references to SCREAMING `waitUntil` values across the full repo:

```bash
grep -r "NETWORKIDLE\|DOMCONTENTLOADED\|WAIT_UNTIL" --include="*.md" .
grep -r "NETWORKIDLE\|DOMCONTENTLOADED\|WAIT_UNTIL" --include="*.ts" .
```

Update every file found (`apps/apify-actor/README.md`, `apps/standalone/SPEC.md`, `packages/schema/SPEC.md`, etc.) to use the lowercase values.

---

## Step ADDITIONAL ANALYSIS: Agent must verify these

After reading the files, verify the following (the findings above may be incomplete):

- Are there any schema fields in `input.ts` that are NOT present in the generated `input_schema.json`? If so, the generator has a gap.
- Are there any CLI flags in `cliProgram.ts` that have no corresponding Zod field (dead flags)?
- Does `apps/apify-actor/src/config.ts` do any other SCREAMING → lowercase translations? If so, apply the same cleanup.
- Is `output_schema.json` adequate for the Apify marketplace, or does it need a richer `properties` block? (Low priority — Apify output schemas are informational only.)

---

## Step TEST-LOCAL: Build and Test

```bash
pnpm build
pnpm fix
pnpm lint
pnpm test
```

Key TypeScript errors to expect: `WAIT_UNTIL_MAP` references after removal, `config.test.ts` with old SCREAMING values.

After build, spot-check:
```bash
CLI="apps/standalone/dist/cli.js"
node "$CLI" extract --wait-until networkidle --help     # confirm no error
node "$CLI" extract --wait-until NETWORKIDLE https://example.com  # confirm clear error
```

---

## Step TEST-ACTOR: Local Actor Run

```bash
cd apps/apify-actor && apify run
```

Verify the Actor starts and processes a URL. The default `waitUntil: "load"` should work without any translation.

---

## Step COMMIT: Commit All Changes

```
fix(schema)!: change waitUntil enum to lowercase, remove translation map

Align with Playwright's own API and playwright-scraper: store 'networkidle',
'load', 'domcontentloaded' directly in the Zod schema instead of SCREAMING
equivalents. Removes WAIT_UNTIL_MAP from config.ts and simplifies parseWaitUntil.

docs(standalone): add CLI flag → config file key mapping to README

BREAKING CHANGE: waitUntil schema values changed from NETWORKIDLE/LOAD/
DOMCONTENTLOADED to networkidle/load/domcontentloaded.
```
