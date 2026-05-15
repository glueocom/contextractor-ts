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

1. **Setup**: Start mock HTTP proxy servers on ports 8081–8090
2. **Test**: Run all three test suites in sequence:
   - Library tests (direct API)
   - CLI tests (standalone command)
   - Actor tests (local Actor run)
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

- **Library tests** (`tools/proxy-rotation-tester/src/lib.test.ts`): Direct API testing
- **CLI tests** (`tools/proxy-rotation-tester/src/cli.test.ts`): Standalone CLI testing
- **Actor tests** (`tools/proxy-rotation-tester/src/actor.test.ts`): Apify Actor testing

## Expected Output

Success:
```
PROXY ROTATION TEST SUITE
✅ All tests passed
  - lib.test.ts: 4 passed
  - cli.test.ts: 1 passed
  - actor.test.ts: 2 passed
Total: 7 passed
```

Failure (before auto-fix):
```
PROXY ROTATION TEST SUITE
❌ Tests failed
  - lib.test.ts: 4 passed
  - cli.test.ts: FAILED (1 failed)
  - actor.test.ts: 2 passed

Retrying failed tests...
✅ Retry successful
```

## Notes

- Tests run sequentially (not parallel) to avoid port conflicts
- Mock proxies return HTML with port number for test verification
- Tests use `http://example.com` target (not HTTPS)
- Temporary files cleaned up automatically after completion
