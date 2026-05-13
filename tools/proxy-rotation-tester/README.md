# Proxy Rotation Tester

Comprehensive test suite for proxy rotation behavior across all three Contextractor entry points: Apify Actor, CLI, and npm library.

## Overview

This test suite verifies that:
- Proxy configuration is correctly passed through each entry point
- Proxies are correctly rotated according to the selected mode (RECOMMENDED, PER_REQUEST, UNTIL_FAILURE)
- Extracted content identifies which proxy was used
- Each entry point handles proxy errors gracefully

## Test Coverage

### Library Tests (`lib.test.ts`)

Direct tests of the Contextractor library API (`createContextractorCrawler`):
- Proxy configuration acceptance
- Content extraction through proxies
- Proxy rotation modes
- Access to proxy info via Crawlee context

### CLI Tests (`cli.test.ts`)

Tests of the standalone CLI (`apps/standalone/`):
- CLI flag parsing (`--proxy-configuration`, `--proxy-rotation`)
- File-based proxy config loading
- Output file generation with proxy-identified content
- Error handling for missing/invalid proxy configuration

### Actor Tests (`actor.test.ts`)

Tests of the Apify Actor (`apps/apify-actor/`):
- Actor input validation with proxy configuration
- Dataset output with proxy-identified content
- Key-value store handling
- Proxy rotation with Apify storage

## Running Tests

From the repo root:

```bash
# Run all proxy rotation tests
pnpm test --filter proxy-rotation-tester

# Run with verbose output
pnpm test --filter proxy-rotation-tester -- --reporter=verbose

# Run specific test file
pnpm test --filter proxy-rotation-tester -- cli.test.ts
```

## Environment Requirements

All tests require:

```bash
export PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1
```

Without this, Chromium silently bypasses proxies for localhost, preventing the test proxy servers from receiving traffic.

## Test Fixture

Each test suite:
1. Starts mock HTTP proxy servers on ports 8081, 8082, 8083
2. Runs the entry point with proxy configuration pointing to these mock proxies
3. Verifies extracted content contains the proxy port number (proving the request went through that proxy)
4. Stops the mock proxies and cleans up temporary files

## Expected Output

Successful run:
```
✓ lib.test.ts (4 tests)
  ✓ should extract content through a proxy
  ✓ should rotate proxies with PER_REQUEST mode
✓ cli.test.ts (1 test)
  ✓ should extract content through proxy via CLI
✓ actor.test.ts (2 tests)
  ✓ should extract content through proxy via Actor
  ✓ should rotate proxies with PER_REQUEST mode

Test Files  3 passed (3)
Tests     7 passed (7)
```

## Troubleshooting

### Tests timeout

- Ensure Playwright/Chromium are installed: `pnpm install`
- Check that mock proxy servers are starting: look for port binding errors in output

### Tests fail with "no such file" for CLI or Actor

- Run from the repo root
- Ensure `apify` CLI is installed: `npm install -g apify-cli` (or use `npx apify`)

### Chromium bypasses proxies

- Set `PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1`
- This is usually set by the test runner, but check environment

## Integration with /proxy-test Command

These tests are orchestrated by the `/proxy-test` slash command (`.claude/commands/proxy-test.md`), which:
- Manages test lifecycle (setup, run, cleanup)
- Auto-fixes failures (single retry)
- Reports summary results
