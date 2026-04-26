# Step port-tools-tests

## TLDR

Rewrite `tools/generated-unit-tests/` as a vitest TypeScript package against `@contextractor/engine`. Copy `fixtures/` from the source repo verbatim — they are language-agnostic. Update `.claude/commands/platform-tests/generate-unit-tests.md` to emit vitest cases, not pytest or cargo.

## Skills and Agents

- Agents: `ts-pro` (port), `code-reviewer` (diff).

## Reference reading

- `../user-entry-log/entry-initial-prompt.md` (vitest port mandate).
- `../migrate-py-to-ts-rust-v2-notes/source-repo-inventory.md` (pytest source list and fixtures).
- `../migrate-py-to-ts-rust-v2-notes/rs-trafilatura-0.2.md` (metadata heuristic differs from Python — assertions use regex / substring, not exact strings).
- Source: `/r/contextractor/tools/generated-unit-tests/{conftest.py, *.py, fixtures/}`.

## Actions

### Replace the pytest package with vitest

- Delete `tools/generated-unit-tests/{conftest.py, *.py, pyproject.toml, requirements.txt}` (whatever pytest scaffolding is there).
- Add `tools/generated-unit-tests/package.json`:
  - `"name": "@contextractor/generated-unit-tests"`, `"private": true`.
  - Dev deps: `vitest`, `@contextractor/engine` via `workspace:*`, `typescript`, `@types/node`.
  - Scripts: `test` = `vitest run`; `lint` = `biome check .`.
- Add `tools/generated-unit-tests/tsconfig.json` extending the root config.
- Add `tools/generated-unit-tests/vitest.config.ts` enabling `globals: true` if the existing tests use bare `expect`/`describe`.

### Port pytest cases to vitest

- For each pytest test case in `/r/contextractor/tools/generated-unit-tests/test_*.py`, create a corresponding `tools/generated-unit-tests/<name>.test.ts`.
- Each test:
  - Loads an HTML fixture from `tools/generated-unit-tests/fixtures/`.
  - Calls `new ContentExtractor(...).extract(html, { format: ... })` (or `extractMetadata`, `extractAllFormats`).
  - Asserts the result via vitest's `expect`.
- Metadata title / author assertions must use regex / substring match — not exact-string equality (see `rs-trafilatura-0.2.md` pitfall).

### Copy fixtures

- `cp -R /Users/miroslavsekera/r/contextractor/tools/generated-unit-tests/fixtures tools/generated-unit-tests/fixtures` — verbatim copy. Do not modify any HTML.

### Refresh `.claude/commands/platform-tests/generate-unit-tests.md`

- Update the command so it emits vitest test files (TypeScript, vitest's `it`/`expect`/`describe`), not pytest or cargo integration tests.
- Update any code paths in the command that referenced Python tooling (`pytest`, `uv`, `pyproject.toml`) to their TS equivalents (`vitest`, `pnpm`, `package.json`).
- Update file-path examples in the command's body to reference `tools/generated-unit-tests/*.test.ts`.

## Constraints

- Do not change any HTML fixture content.
- Do not introduce `xml` or `xmltei` in any test case.
- The vitest package must NOT use `--passWithNoTests` — it has tests.
- Tests must pass against the live napi-rs binding from the prebuild step, not a mock.

## Done when

- `tools/generated-unit-tests/` contains `package.json`, `tsconfig.json`, `vitest.config.ts`, at least the same number of `*.test.ts` cases as the source repo's `test_*.py` files, and `fixtures/`.
- `pnpm -F @contextractor/generated-unit-tests test` passes.
- `.claude/commands/platform-tests/generate-unit-tests.md` references vitest only.
- `grep -ri 'pytest\|conftest\|pyproject' tools/generated-unit-tests/` returns nothing.
- The matching `../tests/step-test-port-tools-tests.md` passes.
