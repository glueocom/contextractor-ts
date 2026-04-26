# Step rename-engine-package

## TLDR

Rename `packages/contextractor_engine/` → `packages/contextractor-engine/`. Capture the Python public API surface in a frozen reference doc, then delete Python sources. Add a TS package skeleton (`package.json`, `tsconfig.json`, empty `src/index.ts`).

## Skills and agents

- `apify-actorization` — package layout for Actor consumption.
- Agent: `ts-pro`.

## Inputs

- Read `../migrate-py-to-ts-rust-notes/source-repo-inventory.md` (engine section).
- Read `../migrate-py-to-ts-rust-notes/rs-trafilatura.md` (Python→TS API mapping table).

## Actions

- `git mv packages/contextractor_engine packages/contextractor-engine`.
- Capture the Python API surface to `packages/contextractor-engine/PYTHON_API_REFERENCE.md` (one-shot reference, deleted in `step-port-engine-to-ts` once the TS port is complete). Include the full signature and docstring of `ContentExtractor.{__init__, extract, extract_metadata, extract_all_formats}` and every `TrafilaturaConfig` field with default and type.
- Delete Python files: `pyproject.toml`, `src/contextractor_engine/`, `tests/`. Keep `README.md` for now (rewritten in `step-update-docs`).
- Add `packages/contextractor-engine/package.json` with `"name": "@contextractor/engine"`, `"main"`, `"types"`, `"build"` script (placeholder for now), `"private": true`, dev deps `typescript`, `@types/node`, `vitest`.
- Add `packages/contextractor-engine/tsconfig.json` extending the root config.
- Add empty `packages/contextractor-engine/src/index.ts` exporting `// placeholder until step-port-engine-to-ts`.

## Constraints

- Do not delete `PYTHON_API_REFERENCE.md` yet — it is the canonical input for the TS port.
- Do not bring the `contextractor-engine-0.3.12-py3-none-any.whl` files into the target.

## Done when

- `packages/contextractor_engine` no longer exists.
- `packages/contextractor-engine/{package.json, tsconfig.json, src/index.ts, PYTHON_API_REFERENCE.md, README.md}` exist; no `.py` files anywhere in the package.
- `pnpm install` succeeds.
- The matching `tests/step-test-rename-engine-package.md` passes.
