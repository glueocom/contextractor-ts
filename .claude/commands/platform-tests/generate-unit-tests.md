---
description: Generate vitest unit tests from platform test runner results
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch
model: sonnet
---

# Generate Unit Tests Command

Generate self-contained vitest unit tests from platform test runner results. Tests target the TypeScript `@contextractor/engine` package.

## Process

### Phase CHECK: Check Prerequisites

Verify `tools/platform-test-runner/test-suites-output/` exists and contains test results.

If the directory is missing or empty, **STOP** and tell the user:

> Test output not found. Run `/platform-tests:run-and-fix` first to generate test results.

### Phase COLLECT: Collect Test Data

For each test suite under `tools/platform-test-runner/test-suites-output/`:

- Read `result.json` to get the test case status
- Read `dataset-item.json` to get:
  - `rawHtml.url` — URL to fetch raw HTML (required for the unit test)
  - `extractedMarkdown` — expected markdown output
  - `metadata` — expected metadata
- Read the matching `tools/platform-test-runner/test-suites/{suite}/settings.json` for extraction options

Skip cases that:

- Have status `error`
- Don't have `rawHtml.url` (raw HTML not saved with `saveRawHtmlToKeyValueStore: true`)

### Phase SETUP: Setup Test Package

Confirm the vitest package at `tools/generated-unit-tests/`:

```
tools/generated-unit-tests/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── fixtures/
│   └── {suite}/
│       └── {test-case}.html
└── src/
    └── {suite}.test.ts
```

### Phase FIXTURES: Generate Fixtures

For each valid test case:

- Fetch raw HTML from `rawHtml.url` using WebFetch
- Save to `tools/generated-unit-tests/fixtures/{suite}/{test-case}.html`

### Phase TESTS: Generate Test Files

Create `tools/generated-unit-tests/src/{suite}.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ContentExtractor } from '@contextractor/engine';
import { loadHtmlFixture } from './fixtures.js';

describe('{suite}', () => {
    it('{test-case}: extracts metadata', () => {
        const html = loadHtmlFixture('{suite}', '{test-case}');
        const extractor = new ContentExtractor({ favorPrecision: true });
        const meta = extractor.extractMetadata(html, '{url}');
        expect(meta.title ?? '').not.toBe('');
    });

    it('{test-case}: extracts non-trivial markdown', () => {
        const html = loadHtmlFixture('{suite}', '{test-case}');
        const extractor = new ContentExtractor();
        const r = extractor.extract(html, { url: '{url}', format: 'markdown' });
        expect(r).not.toBeNull();
        expect(r!.content.length).toBeGreaterThan(1000);
    });
});
```

### Phase MAP: Map Settings to TrafilaturaConfig

Map Actor input settings to `TrafilaturaConfig` fields:

| Actor Setting | Engine Field |
|---------------|--------------|
| `trafilaturaConfig.favorPrecision: true` | `{ favorPrecision: true }` |
| `trafilaturaConfig.favorRecall: true` | `{ favorRecall: true }` |
| `trafilaturaConfig.includeTables: false` | `{ includeTables: false }` |
| `trafilaturaConfig.targetLanguage: "en"` | `{ targetLanguage: 'en' }` |

Output formats are limited to `txt`, `markdown`, `json`, `html`. `xml` and `xmltei` are deferred pending upstream `rs-trafilatura` support.

### Phase RUN: Run Tests

```bash
pnpm -F @tools/generated-unit-tests test
```

### Phase FIX: Fix Errors

If tests fail:

- Analyze failure messages
- Adjust expected values or test logic
- Re-run tests

## Notes

- Raw HTML lives as fixture files, not inline string constants.
- The `rawHtml.url` has a signature that may expire — fetch during generation.
- Focus on metadata-presence and length-threshold checks; rs-trafilatura's metadata heuristics differ from Python trafilatura, so do not assert exact title strings without verifying first.

## Enabling More Test Cases

Currently only suites with `saveRawHtmlToKeyValueStore: true` can generate unit tests.

To enable more:

- Add `"saveRawHtmlToKeyValueStore": true` to `tools/platform-test-runner/test-suites/{suite}/settings.json`
- Re-run platform tests: `pnpm -F @tools/platform-test-runner test:run:all`
- Re-run this command to regenerate from the new data
