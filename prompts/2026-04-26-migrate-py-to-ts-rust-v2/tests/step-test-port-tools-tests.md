# Test step port-tools-tests

## TLDR

Reviews `../implementation/step-port-tools-tests.md`. Verifies the vitest port, the verbatim fixtures copy, and the refreshed `.claude/commands/platform-tests/generate-unit-tests.md`.

## Inputs

- `../implementation/step-port-tools-tests.md`.
- `../migrate-py-to-ts-rust-v2-notes/source-repo-inventory.md`.
- `../migrate-py-to-ts-rust-v2-notes/rs-trafilatura-0.2.md`.

## Verification

- `tools/generated-unit-tests/{package.json, tsconfig.json, vitest.config.ts}` exist; `pyproject.toml` / `requirements.txt` / `conftest.py` removed.
- Number of `*.test.ts` files in `tools/generated-unit-tests/` is at least the number of `test_*.py` files in `/r/contextractor/tools/generated-unit-tests/`.
- `tools/generated-unit-tests/fixtures/` exists and matches `/r/contextractor/tools/generated-unit-tests/fixtures/` byte-for-byte (`diff -r --brief` returns nothing).
- `pnpm -F @contextractor/generated-unit-tests test` passes against the live napi-rs binding.
- Tests assert metadata via regex / substring, not exact strings.
- `.claude/commands/platform-tests/generate-unit-tests.md` references vitest only (no `pytest`, `cargo`, `uv`, `pyproject`).
- `grep -ri 'pytest\|conftest\|pyproject' tools/generated-unit-tests/` returns nothing.

## Auto-fix examples

- Test asserts exact title — change to regex/substring.
- `.md` command still mentions `pytest` — rewrite to vitest.
- Stale `requirements.txt` — delete.

## Done when

The package runs vitest against the engine and the command emits vitest-shaped tests.
