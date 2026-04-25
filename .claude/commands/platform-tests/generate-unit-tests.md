---
description: Generate cargo integration tests from platform test runner results
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch
model: sonnet
---

# Generate Unit Tests Command

Generate self-contained cargo integration tests from platform test runner results.

## Process

### Phase 0: Check Prerequisites

Verify `tools/platform-test-runner/test-suites-output/` exists and contains test results.

If the directory is missing or empty, **STOP** and tell the user:

> Test output not found. Run `/platform-tests:run-and-fix` first to generate test results.

### Phase 1: Collect Test Data

For each test suite under `tools/platform-test-runner/test-suites-output/`:

1. Read `result.json` to get the test case status
2. Read `dataset-item.json` to get:
   - `rawHtml.url` — URL to fetch raw HTML (required for the unit test)
   - `extractedMarkdown` — expected markdown output
   - `metadata` — expected metadata
3. Read the matching `tools/platform-test-runner/test-suites/{suite}/settings.json` for extraction options

Skip cases that:

- Have status `error`
- Don't have `rawHtml.url` (raw HTML not saved with `exportHtml: true`)

### Phase 2: Setup Test Crate

Confirm the cargo crate at `tools/generated-unit-tests/`:

```
tools/generated-unit-tests/
├── Cargo.toml
├── src/
│   └── lib.rs
├── fixtures/
│   └── {suite}/
│       └── {test-case}.html
└── tests/
    └── {suite}.rs
```

### Phase 3: Generate Fixtures

For each valid test case:

1. Fetch raw HTML from `rawHtml.url` using WebFetch
2. Save to `tools/generated-unit-tests/fixtures/{suite}/{test-case}.html`

### Phase 4: Generate Test Files

Create `tools/generated-unit-tests/tests/{suite}.rs`:

```rust
use std::fs;
use std::path::PathBuf;

use contextractor_engine::{ExtractionConfig, ExtractionMode, extract};

fn fixture(suite: &str, case: &str) -> String {
    let path: PathBuf = ["fixtures", suite, &format!("{case}.html")].iter().collect();
    fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {path:?}: {e}"))
}

#[test]
fn case_name_metadata() {
    let html = fixture("{suite}", "{test-case}");
    let cfg = ExtractionConfig {
        mode: ExtractionMode::FavorPrecision,
        with_metadata: true,
        ..Default::default()
    };
    let result = extract(&html, "{url}", &cfg).unwrap();
    assert_eq!(result.title.as_deref(), Some("{expected_title}"));
}

#[test]
fn case_name_content() {
    let html = fixture("{suite}", "{test-case}");
    let result = extract(&html, "{url}", &ExtractionConfig::default()).unwrap();
    let markdown = result.markdown.expect("markdown output");
    assert!(markdown.len() > 1000, "content too short: {} chars", markdown.len());
}
```

### Phase 5: Map Settings to Extraction Options

Map Actor input settings to `contextractor_engine::ExtractionConfig` fields:

| Actor Setting | Engine Field |
|---------------|--------------|
| `extractionMode: FAVOR_PRECISION` | `mode: ExtractionMode::FavorPrecision` |
| `extractionMode: FAVOR_RECALL` | `mode: ExtractionMode::FavorRecall` |
| `extractionMode: BALANCED` | `mode: ExtractionMode::Balanced` (default) |
| `includeMetadata: true` | `with_metadata: true` |
| `outputFormat: "markdown"` | `output_format: OutputFormat::Markdown` |

### Phase 6: Maintain `Cargo.toml`

Confirm `tools/generated-unit-tests/Cargo.toml` declares the engine crate as a dev-dependency:

```toml
[package]
name = "generated-unit-tests"
version = "0.1.0"
edition = "2024"
publish = false

[lib]
path = "src/lib.rs"

[dev-dependencies]
contextractor_engine = { path = "../../packages/contextractor_engine" }
```

### Phase 7: Run Tests

```bash
cargo test -p generated-unit-tests
```

### Phase 8: Fix Errors

If tests fail:

1. Analyze failure messages
2. Adjust expected values or test logic
3. Re-run tests

## Notes

- Raw HTML lives as fixture files, not inline string constants
- The `rawHtml.url` has a signature that may expire — fetch during generation
- Focus on metadata extraction tests; full content matching is brittle
- Use `assert_eq!(result.title.as_deref(), Some("..."))` for exact matches
- Use `assert!(text.contains("..."))` for partial content checks

## Enabling More Test Cases

Currently only suites with `exportHtml: true` can generate unit tests.

To enable more:

1. Add `"exportHtml": true` to `tools/platform-test-runner/test-suites/{suite}/settings.json`
2. Re-run platform tests: `cd tools/platform-test-runner && npm run test:run:all`
3. Re-run this command to regenerate from the new data
