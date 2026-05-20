# Proxy Rotation Tester

Comprehensive test suite for proxy rotation behavior across all three Contextractor entry points: Apify Actor, CLI, and npm library.

Built on [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura)
(extraction) and [Crawlee](https://crawlee.dev/) (TypeScript crawler driving
Playwright).

## Overview

This test suite verifies that:
- Proxy configuration is correctly passed through each entry point
- Proxies are correctly rotated according to the selected mode (`RECOMMENDED`, `PER_REQUEST`)
- Tiered proxy escalation works via `tieredProxyUrls` for automatic domain-level escalation
- Extracted content identifies which proxy was used
- Mutual exclusivity guards (`tieredProxyUrls` + `useApifyProxy`) are enforced at the Actor entry point

## Test Coverage

### Library Tests (`lib.test.ts`)

Direct tests of the Contextractor library API (`createContextractorCrawler`):
- Content extraction through proxies (ports 8081–8083)
- `PER_REQUEST` proxy rotation (ports 8081–8083)
- Tiered proxy routing via `ProxyConfiguration({ tieredProxyUrls })` (ports 8091–8094)

### CLI Tests (`cli.test.ts`)

Tests of the standalone CLI (`apps/standalone/`):
- Flat proxy routing via `--proxy` flags and `--proxy-rotation recommended` (ports 8084–8086)
- Tiered proxy routing via `--config tieredProxyUrls` (config file, ports 8095–8097)

### Actor Tests (`actor.test.ts`)

Tests of the Apify Actor (`apps/apify-actor/`):
- Content extraction through flat proxy via `proxyConfiguration.proxyUrls` (ports 8087–8089)
- `PER_REQUEST` rotation via flat proxy (ports 8087–8089)
- Tiered proxy routing via `tieredProxyUrls` Actor input (ports 8098–8099)
- Mutual exclusivity rejection: `tieredProxyUrls` + `proxyConfiguration.useApifyProxy: true` (ports 8098)

## Running Tests

From the repo root:

```bash
# Run all proxy rotation tests (preferred — uses /proxy-test command)
/proxy-test

# Run directly with vitest
pnpm --filter proxy-rotation-tester exec vitest run

# Run a specific test file
pnpm --filter proxy-rotation-tester exec vitest run src/lib.test.ts
```

## Environment Requirements

All tests require:

```bash
export PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1
```

Without this, Chromium silently bypasses proxies for localhost, preventing the test proxy servers from receiving traffic.

## Test Fixture

Tests use the `proxy-simulator` workspace package (`tools/proxy-simulator`), which starts lightweight HTTP proxy servers that return a custom HTML response embedding the proxy port number. This lets tests confirm which proxy tier actually handled each request by searching for the port number in extracted content.

Each test suite:
1. Starts mock proxy servers on its assigned port range (non-overlapping across test files)
2. Runs the entry point with proxy configuration pointing to these mock proxies
3. Verifies extracted content contains the proxy port number
4. Stops the mock proxies and cleans up temporary files

Port assignments (to prevent inter-file conflicts in parallel runs):
- `lib.test.ts` flat tests: 8081–8083
- `cli.test.ts` flat tests: 8084–8086
- `actor.test.ts` flat tests: 8087–8089
- `lib.test.ts` tiered tests: 8091–8094
- `cli.test.ts` tiered tests: 8095–8097
- `actor.test.ts` tiered tests: 8098–8099

## Expected Output

Successful run:

```
Test Files  3 passed (3)
Tests     10 passed (10)
```

## Troubleshooting

### Tests timeout

- Ensure Playwright/Chromium are installed: `pnpm install`
- Check that mock proxy servers can bind to their assigned ports

### Tests fail with "no such file" for CLI or Actor

- Build the standalone app: `pnpm build`
- Ensure `apify` CLI is installed globally: `npm install -g apify-cli`

### Chromium bypasses proxies

- Set `PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1`
- The `/proxy-test` command sets this automatically

## Integration with /proxy-test Command

These tests are orchestrated by the `/proxy-test` slash command (`.claude/commands/proxy-test.md`), which:
- Sets required environment variables
- Manages test lifecycle (setup, run, cleanup)
- Auto-fixes failures (single retry)
- Reports summary results
