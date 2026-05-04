# Human review required — sync-gui 2026-05-03

Three issues found during the `autonomous:maintenance:sync:gui` pass. None were auto-fixed because each requires a deliberate design decision before touching code.

---

## Issue 1 — `waitUntil` is wired but silently dropped (Medium)

**The gap:** The Zod schema exposes `waitUntil` (default `LOAD`) and the standalone CLI exposes `--wait-until`. The value is parsed, validated, and stored in `CrawlConfig`—but `ContextractorCrawlerOptions` has no `waitUntil` field, so the value is never forwarded to Playwright.

**Files:**
- Schema: `packages/schema/src/input.ts` — `waitUntil` field (line 272)
- Crawler interface: `packages/crawler/src/createCrawler.ts` — missing field
- Standalone action: `apps/standalone/src/cliProgram.ts` — `cfg.waitUntil` unused (lines 114–141)
- Apify config: `apps/apify-actor/src/config.ts` — `input.waitUntil` unused

**Decision needed:**

Option A — implement it:
- Add `waitUntil?: 'networkidle' | 'load' | 'domcontentloaded'` to `ContextractorCrawlerOptions`
- Pass it to Playwright's goto options in `packages/crawler/src/handler.ts`
- Wire it through both `cliProgram.ts` and `apps/apify-actor/src/config.ts`

Option B — remove it:
- Delete `waitUntil` from `packages/schema/src/input.ts`
- Remove `--wait-until` from `apps/standalone/src/cliProgram.ts`
- Remove `WAIT_UNTIL_MAP` and `waitUntil` from `apps/standalone/src/config.ts`
- Regenerate `input_schema.json` via `pnpm --filter @contextractor/gen-input-schema start`

---

## Issue 2 — `--proxy-urls` and `--proxy-rotation` are silently ignored in the standalone CLI (Low)

**The gap:** Both flags are registered and parsed, but `ContextractorCrawlerOptions` only accepts a full `ProxyConfiguration` object (Crawlee/Apify type). The standalone CLI has no code to construct one from bare proxy URLs.

**Files:**
- CLI flags: `apps/standalone/src/cliProgram.ts` — `--proxy-urls`, `--proxy-rotation`
- CLI config: `apps/standalone/src/config.ts` — `CrawlConfig.proxyUrls`, `CrawlConfig.proxyRotation`
- CLI action: `apps/standalone/src/cliProgram.ts` — `cfg.proxyUrls` / `cfg.proxyRotation` unused

**Decision needed:**

Option A — remove the flags:
- Remove `--proxy-urls` and `--proxy-rotation` from `cliProgram.ts`
- Remove `proxyUrls` and `proxyRotation` from `CrawlConfig` and `CliOnlyOverrides` in `config.ts`
- No schema change needed (the standalone doesn't expose these as JSON config keys either)

Option B — implement proxy support for the standalone CLI:
- Add `proxyConfiguration?: ProxyConfiguration` to `ContextractorCrawlerOptions` (already present)
- In the standalone action, build a Crawlee `ProxyConfiguration` from `cfg.proxyUrls` using `new ProxyConfiguration({ proxyUrls: cfg.proxyUrls })`
- Pass it through to the crawler

---

## Issue 3 — `html` output not available in the Apify Actor (Informational)

The extraction engine and standalone CLI both support `html` as an output format, but the Apify Actor has no `saveExtractedHtmlToKeyValueStore` schema field and never requests html extraction.

**Decision needed:**

Option A — add html KVS save to the Apify Actor:
- Add `saveExtractedHtmlToKeyValueStore: z.boolean().default(false)` to `packages/schema/src/input.ts` (after the other `saveExtracted*` fields)
- Push `html` to `formats` in `apps/apify-actor/src/config.ts` when this flag is true
- Add html to `FORMAT_SPECS` in `apps/apify-actor/src/sinks.ts`: `{ format: 'html', dataKey: 'extractedHtml', contentType: 'text/html; charset=utf-8', ext: 'html' }`
- Add `extractedHtml` field to `apps/apify-actor/.actor/dataset_schema.json`
- Regenerate `input_schema.json`

Option B — document the gap:
- Add a note to the Apify Actor README that HTML output is standalone-only
- No code changes

---

## Priority

Issue 1 (`waitUntil`) is the most impactful because it creates a user-visible discrepancy: the schema and CLI document a feature that silently has no effect. Issue 2 is similar but lower severity since proxy support is expected to be Apify-platform-only. Issue 3 is a feature gap with no false promise in the current schema.
