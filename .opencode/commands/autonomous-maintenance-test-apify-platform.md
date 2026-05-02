---
description: Deploy to Apify test actor, run platform test suites, and update unit tests from results
---

Deploy to the Apify test actor, run all platform test suites, fix failures, and update unit tests in `packages/extraction/test/` from the results. Saves a report to `autonomous-task-output/{agent}/`.

## Step SYNC_SCHEMA: Review and Sync Test Cases with Actor Schema

Read the current actor configuration and sync all test suite settings:

- Read `apps/apify-actor/.actor/input_schema.json` — input parameters
- Read `apps/apify-actor/.actor/dataset_schema.json` — output schema
- Read `apps/apify-actor/.actor/actor.json` — verify `name` is `contextractor-test`

For each test suite in `tools/platform-test-runner/test-suites/`:
- Check `settings.json` — remove deprecated options, add new ones with appropriate values
- Check `urls.json` — remove URLs blocked by sites, add new ones for new features
- Check `description.md` — update if scope changed

## Step DEPLOY: Deploy and Verify Build

Run `/platform:deploy-and-test` to push to the test actor, wait for a successful build, and run an initial smoke crawl. If the build fails, follow the error-fix loop in that command before proceeding.

## Step RUN_TESTS: Run Platform Test Suites

```bash
cd tools/platform-test-runner && npm run test:run:all
```

Note: `APIFY_TOKEN` is provided via `.claude/settings.local.json`.

## Step ANALYZE: Analyze Test Results

Read `tools/platform-test-runner/test-suites-output/report.md`. For each failed test case:
- Read `test-suites-output/{suite}/{case}/result.json`
- Read `test-suites-output/{suite}/{case}/dataset-item.json`
- Determine root cause: actor code issue, test case issue, or external site issue

## Step FIX: Fix Code Failures

If failures are due to actor code:
- Read relevant files in `apps/apify-actor/src/` or `packages/extraction/`
- Fix the issue
- Re-run test suites to verify

If failures are due to test case configuration:
- Update `tools/platform-test-runner/test-suites/{suite}/settings.json` or `urls.json`
- Re-run test suites

Skip fixing if failure is due to external site issues (blocked, changed structure, etc.).

## Step UPDATE_TESTS: Update Unit Tests in packages/

For each test suite under `tools/platform-test-runner/test-suites-output/`:
- Read `result.json` to get test case status
- Read `dataset-item.json` to get `rawHtml.url`, `extractedMarkdown`, `metadata`
- Read matching `test-suites/{suite}/settings.json` for extraction options

Skip cases where:
- Status is `error`
- `rawHtml.url` is missing (suite does not have `exportHtml: true`)

For each valid test case:
- Fetch raw HTML from `rawHtml.url` using WebFetch
- Save to `packages/extraction/test/fixtures/{suite}/{case}.html`
- Create or update `packages/extraction/test/{suite}.test.ts` with the test

Test file structure:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ContentExtractor } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures', '{suite}');

function fixture(caseName: string): string {
  return readFileSync(path.join(FIXTURES_DIR, `${caseName}.html`), 'utf-8');
}

describe('{suite}', () => {
  it('{case} extracts metadata', () => {
    const html = fixture('{case}');
    const extractor = new ContentExtractor({ favorPrecision: true });
    const meta = extractor.extractMetadata(html, '{url}');
    expect(meta.title ?? meta.description ?? '').toMatch(/{expected_title_regex}/);
  });

  it('{case} extracts content', () => {
    const html = fixture('{case}');
    const extractor = new ContentExtractor();
    const result = extractor.extract(html, { url: '{url}', format: 'markdown' });
    expect(result?.content.length ?? 0).toBeGreaterThan(1000);
  });
});
```

Use regex/non-empty assertions — never exact string equality. Prefer `toMatch(/pattern/i)` and `toContain('...')`.

### Actor Setting → Engine Option Mapping

| Actor setting | TS engine option |
|---|---|
| `extractionMode: FAVOR_PRECISION` | `{ favorPrecision: true }` |
| `extractionMode: FAVOR_RECALL` | `{ favorRecall: true }` |
| `extractionMode: BALANCED` | `{}` (default) |
| `outputFormat: "markdown"` | `extract(html, { format: 'markdown' })` |

Reject test cases requesting `xml` or `xmltei` with `it.skip("pending rs-trafilatura xml support", ...)`.

After updating tests, run them:
```bash
pnpm --filter @contextractor/extraction test
```

Fix any failures before proceeding.

## Step REPORT: Save Report

Write `tools/platform-test-runner/test-suites-output/analysis-report.md` and `autonomous-task-output/{agent}/reports/test-apify-platform-report.md` with:
- Summary of the test run (suites tested, pass/fail counts)
- Test schema sync changes made
- Platform test results (passed / failed / skipped per suite)
- Unit test files updated in `packages/extraction/test/`
- Code changes made
- External site failures (skipped)
- Save issues requiring decisions to `autonomous-task-output/{agent}/prompts/test-apify-platform-prompt.md`

## Cost Limits

- Keep `maxPagesPerCrawl` under 50 per suite
- No residential proxies
- Prefer `DOMCONTENTLOADED` over `NETWORKIDLE`
- Under 10 start URLs per suite
