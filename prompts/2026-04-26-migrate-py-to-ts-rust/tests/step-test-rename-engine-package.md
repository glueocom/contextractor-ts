# Test — rename-engine-package

## TLDR

Review the diff from `implementation/step-rename-engine-package.md`. Verify the engine package is renamed, Python sources are gone, the Python API is captured for the TS port, and a TS skeleton stands. Auto-fix any deviation.

## Inputs

- `../implementation/step-rename-engine-package.md`
- `../migrate-py-to-ts-rust-notes/source-repo-inventory.md` (engine API)

## Review

- `packages/contextractor_engine/` must not exist; `packages/contextractor-engine/` must exist.
- `packages/contextractor-engine/PYTHON_API_REFERENCE.md` exists and documents `ContentExtractor` (constructor + 3 methods) and every `TrafilaturaConfig` field with type + default.
- `packages/contextractor-engine/{package.json, tsconfig.json, src/index.ts}` exist.
- No `.py` files inside `packages/contextractor-engine/` (excluding any `fixtures/`).

## Verify

- `find packages/contextractor-engine -name '*.py'` returns nothing.
- `pnpm install` exits 0.
- `pnpm -F @contextractor/engine build` may fail (placeholder) — that's fine here; only `pnpm install` must succeed.
- `git ls-files packages/contextractor_engine` returns nothing.

## Auto-fix

If `PYTHON_API_REFERENCE.md` is missing fields, re-derive them from the source repo's `packages/contextractor_engine/src/contextractor_engine/{models.py, extractor.py}` and patch the reference.
