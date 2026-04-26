# Test — port-tools-tests

## TLDR

Review the diff from `implementation/step-port-tools-tests.md`. Verify `tools/generated-unit-tests/` is now a vitest TS package using the engine, fixtures are intact, and `tools/platform-test-runner/` inputs match the new schema/actor name. Auto-fix any deviation.

## Inputs

- `../implementation/step-port-tools-tests.md`
- `../user-entry-log/entry-qa-unit-tests.md`
- `../user-entry-log/entry-qa-test-actor.md`

## Review

- `tools/generated-unit-tests/{package.json, tsconfig.json, vitest.config.ts}` exist.
- `tools/generated-unit-tests/fixtures/` matches `/r/contextractor/tools/generated-unit-tests/fixtures/` byte-for-byte (HTML files unchanged).
- Each Python `test_*.py` has a TS counterpart, except xml/xmltei assertions which appear as a single `it.skip(... "pending rs-trafilatura xml support")`.
- `tools/platform-test-runner/test-suites/` references `contextractor-apify`, not `contextractor`; references `glueo/`, not `shortc/`; format inputs use only `txt`/`markdown`/`json`/`html`.
- `.claude/commands/platform-tests/generate-unit-tests.md` generates vitest cases, not cargo tests.

## Verify

- `pnpm -F @contextractor/generated-unit-tests test` passes.
- `pnpm -F @tools/platform-test-runner build` exits 0.
- `find tools/generated-unit-tests -name '*.py' | grep -v fixtures` returns nothing.
- `diff -r tools/generated-unit-tests/fixtures /r/contextractor/tools/generated-unit-tests/fixtures` reports no changes.
- `grep -ri 'shortc/\\|contextractor-test-runner\\|apps/contextractor[^-]' tools/platform-test-runner/test-suites/` returns nothing (the actor name change took).

## Auto-fix

If a fixture diff appears, restore the source file. If a test fails because the engine returned different content for the same fixture, **do not loosen the assertion** without first confirming with the user that the rs-trafilatura behavior change is intended — flag it instead.
