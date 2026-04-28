---
description: Generate vitest unit tests from platform test runner results
---

# Generate Unit Tests Command

Generate self-contained vitest unit tests (TypeScript) from platform test runner results. Tests call `@contextractor/engine` directly — no cargo integration tests.

## Process

### Step PREREQ: Check Prerequisites

Verify `tools/platform-test-runner/test-suites-output/` exists and contains test results.

If the directory is missing or empty, **STOP** and tell the user:

> Test output not found. Run `/platform-tests:run-and-fix` first to generate test results.

### Step COLLECT: Collect Test Data

For each test suite under `tools/platform-test-runner/test-suites-output/`:

- Read `result.json` to get the test case status.
- Read `dataset-item.json` to get:
  - `rawHtml.url` — URL to fetch raw HTML (required for the unit test).
  - `extractedMarkdown` — expected markdown output.
  - `metadata` — expected metadata.
- Read the matching `tools/platform-test-runner/test-suites/{suite}/settings.json` for extraction options.

Skip cases that:

- Have status `error`.
- Don't have `rawHtml.url` (raw HTML not saved with `exportHtml: true`).

### Step SETUP: Setup vitest Package

Confirm the vitest package at `tools/generated-unit-tests/`:

```
tools/generated-unit-tests/
├── package.json                # name: @contextractor/generated-unit-tests, deps: @contextractor/engine + vitest
├── tsconfig.json               # extends ../../tsconfig.json
├── vitest.config.ts
├── fixtures/
│   └── {suite}/
│       └── {test-case}.html
└── {suite}.test.ts             # one .test.ts per suite at the package root
```

### Step FIXTURES: Generate Fixtures

For each valid test case:

- Fetch raw HTML from `rawHtml.url` using WebFetch.
- Save to `tools/generated-unit-tests/fixtures/{suite}/{test-case}.html` verbatim.

### Step TESTS: Generate Test Files

Create `tools/generated-unit-tests/{suite}.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ContentExtractor } from '@contextractor/engine';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures', '{suite}');

function fixture(caseName: string): string {
    return readFileSync(path.join(FIXTURES_DIR, `${caseName}.html`), 'utf-8');
}

describe('{suite}', () => {
    it('case_name extracts metadata', () => {
        const html = fixture('{test-case}');
        const extractor = new ContentExtractor({ favorPrecision: true });
        const meta = extractor.extractMetadata(html, '{url}');
        expect(meta.title ?? meta.description ?? '').toMatch(/{expected_title_regex}/);
    });

    it('case_name extracts content', () => {
        const html = fixture('{test-case}');
        const extractor = new ContentExtractor();
        const result = extractor.extract(html, { url: '{url}', format: 'markdown' });
        expect(result?.content.length ?? 0).toBeGreaterThan(1000);
    });
});
```

Metadata assertions must use **regex / non-empty** checks rather than exact string equality — `rs-trafilatura`'s title heuristic differs from Python `trafilatura` and sometimes returns the meta description instead. Brittle equality assertions waste cycles.

### Step MAPPING: Map Settings to Engine Options

Map Actor input settings to `ContentExtractor` config and `extract` options:

| Actor Setting | TS engine field |
|---------------|-----------------|
| `extractionMode: FAVOR_PRECISION` | `{ favorPrecision: true }` |
| `extractionMode: FAVOR_RECALL` | `{ favorRecall: true }` |
| `extractionMode: BALANCED` | `{}` (default) |
| `includeMetadata: true` | metadata is always extracted in rs-trafilatura 0.2.x — no flag needed |
| `outputFormat: "markdown"` | `extract(html, { format: 'markdown' })` |

Supported `outputFormat` values: `txt | markdown | json | html`. Reject any test case requesting `xml` or `xmltei` (mark as `it.skip("pending rs-trafilatura xml support", ...)`).

### Step PACKAGE: Maintain `package.json`

Confirm `tools/generated-unit-tests/package.json`:

```json
{
  "name": "@contextractor/generated-unit-tests",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@contextractor/engine": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^2"
  }
}
```

The vitest package has tests, so `--passWithNoTests` is **not** used here.

### Step RUN: Run Tests

```bash
npm run test -w @contextractor/generated-unit-tests
```

### Step FIX: Fix Errors

If tests fail:

- Analyze failure messages.
- Adjust expected regex / metadata fallback (`title ?? description`) or test logic.
- Re-run tests.

## Notes

- Raw HTML lives as fixture files (HTML is language-agnostic — these can be reused across the original Python suite and the new TS suite).
- The `rawHtml.url` has a signature that may expire — fetch during generation.
- Focus on metadata extraction tests; full content matching is brittle.
- Prefer regex assertions for titles (`expect(title).toMatch(/Web scraping/i)`).
- Use `expect(text).toContain('...')` for partial content checks.

## Enabling More Test Cases

Currently only suites with `exportHtml: true` can generate unit tests.

To enable more:

- Add `"exportHtml": true` to `tools/platform-test-runner/test-suites/{suite}/settings.json`.
- Re-run platform tests: `cd tools/platform-test-runner && npm run test:run:all`.
- Re-run this command to regenerate from the new data.
