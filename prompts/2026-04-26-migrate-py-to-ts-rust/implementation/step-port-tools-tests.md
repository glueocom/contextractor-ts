# Step port-tools-tests

## TLDR

Rewrite `tools/generated-unit-tests/` as a TypeScript vitest package calling `@contextractor/engine`. Copy `fixtures/` from `/r/contextractor/tools/generated-unit-tests/fixtures/` verbatim. Refresh `tools/platform-test-runner/test-suites/` inputs to match the new schemas (no `xml`/`xmltei`) and the renamed actor name (`contextractor-apify`).

## Skills and agents

- Agent: `ts-pro`, `code-reviewer`, `test-runner`.

## Inputs

- Read `../user-entry-log/entry-qa-unit-tests.md`.
- Read `/r/contextractor/tools/generated-unit-tests/{conftest.py, tests/, fixtures/}`.

## Actions

- Delete current `tools/generated-unit-tests/{pyproject.toml, conftest.py, tests/, uv.lock}`.
- Add `tools/generated-unit-tests/{package.json, tsconfig.json, vitest.config.ts}`. `package.json` declares `@contextractor/engine` workspace dep and `vitest`.
- Copy `fixtures/` from source repo to `tools/generated-unit-tests/fixtures/` verbatim (HTML files unchanged).
- Port each `tests/test_*.py` to `src/*.test.ts`:
  - `import { ContentExtractor } from '@contextractor/engine';`
  - Read fixture, run extraction, assert on `content` / metadata.
  - Drop assertions that depend on `xml` / `xmltei` formats — move them to a single skipped test marked `it.skip(... "pending rs-trafilatura xml support")`.
- Refresh `tools/platform-test-runner/test-suites/`:
  - Update any actor name references from `contextractor` → `contextractor-apify`.
  - Update any input fixtures whose `format` enum used `xml` or `xmltei` to use `markdown`.
  - Update any references from `shortc/...` to `glueo/...`.
- Update `.claude/commands/platform-tests/generate-unit-tests.md` so it generates **vitest** test cases against `@contextractor/engine`, not `cargo` integration tests.

## Constraints

- Don't change fixture HTML — fixtures are language-agnostic regression anchors.
- Don't introduce new test cases beyond what the Python suite covered, except for the explicit skipped placeholder for xml.

## Done when

- `pnpm -F @contextractor/generated-unit-tests test` passes.
- `pnpm -F @tools/platform-test-runner build` still succeeds.
- `grep -ri 'pytest\|conftest\|\.py$' tools/generated-unit-tests/` returns nothing (except inside `fixtures/` if a fixture happens to be a `.py.html` file).
- The matching `tests/step-test-port-tools-tests.md` passes.
