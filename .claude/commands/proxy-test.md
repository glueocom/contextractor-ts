---
name: proxy-test
description: Run complete proxy rotation testing suite across all entry points with auto-fix
argument-hint: '[--no-fix]'
allowed-tools:
  - 'Bash(*)'
model: sonnet
---

# Proxy Rotation Testing Command

Orchestrates full proxy rotation testing across Apify Actor, CLI, and npm library entry points. Starts mock proxy servers, runs all test suites, auto-fixes failures (single retry), and reports results.

## Usage

```bash
/proxy-test          # Run tests with auto-fix on failure
/proxy-test --no-fix # Run tests once, no retry
```

## What This Does

1. **Setup**: Start mock HTTP proxy servers on ports 8081–8099
2. **Test**: Run all three test suites in sequence:
   - Library tests (direct API) — flat proxy rotation + tiered proxy
   - CLI tests (standalone command) — flat proxy rotation + tiered proxy via `--config tieredProxyUrls`
   - Actor tests (local Actor run) — flat proxy rotation + `tieredProxyUrls` input + mutual exclusivity validation
3. **Auto-fix**: If any test fails, re-run tests once (unless `--no-fix` is passed)
4. **Cleanup**: Stop proxy servers, remove temporary directories
5. **Report**: Display summary with pass/fail counts and test details

## Environment

Requires:

```bash
export PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1
```

This is set automatically by the command.

## Implementation

The command:
- Sets required environment variables
- Runs proxy rotation tests via `pnpm test --filter proxy-rotation-tester`
- Captures test output and exit code
- Re-runs once on failure (unless disabled)
- Reports final status

## Test Files

- **Library tests** (`tools/proxy-rotation-tester/src/lib.test.ts`): Direct API — flat rotation (ports 8081–8083), tiered proxies (ports 8091–8094)
- **CLI tests** (`tools/proxy-rotation-tester/src/cli.test.ts`): Standalone CLI — flat rotation (ports 8084–8086), tiered proxy via `--config tieredProxyUrls` (ports 8095–8097)
- **Actor tests** (`tools/proxy-rotation-tester/src/actor.test.ts`): Apify Actor — flat rotation (ports 8087–8089), `tieredProxyUrls` input and mutual exclusivity validation (ports 8098–8099)

## Expected Output

Success:
```
PROXY ROTATION TEST SUITE
✅ All tests passed
  - lib.test.ts: 3 passed
  - cli.test.ts: 3 passed
  - actor.test.ts: 4 passed
Total: 10 passed
```

Failure (before auto-fix):
```
PROXY ROTATION TEST SUITE
❌ Tests failed
  - lib.test.ts: 3 passed
  - cli.test.ts: FAILED (1 failed)
  - actor.test.ts: 4 passed

Retrying failed tests...
✅ Retry successful
```

## Notes

- Tests run sequentially (not parallel) to avoid port conflicts
- Mock proxies return HTML with port number for test verification
- Tests use `http://example.com` target (not HTTPS)
- Temporary files cleaned up automatically after completion
