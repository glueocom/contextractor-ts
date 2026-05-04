# Spec Maintenance

All specs must reflect the current state of the codebase — not plans or aspirations.

## Spec locations

- `SPEC.md` at the repo root — canonical cross-cutting reference: stack, architecture, input/output contracts, dependencies, build, Docker, CI
- Package and app specs (concise):
  - `packages/crawler/SPEC.md`
  - `packages/extraction/SPEC.md`
  - `packages/schema/SPEC.md`
  - `apps/apify-actor/SPEC.md`
  - `apps/standalone/SPEC.md`

## When to update

Update the relevant `SPEC.md` whenever you:

- Add, rename, or remove a public export, CLI flag, or API method
- Change an input field, default value, or output schema
- Change a dependency or its minimum version
- Change the build, Docker, or CI pipeline
- Add or remove a supported output format, cookie strategy, or sink type

Do not update specs for internal refactors that leave the public API unchanged.

## Constraints

- Specs describe what exists — never planned or future state
- Do not hand-edit `apps/apify-actor/.actor/input_schema.json` — regenerate via `pnpm --filter @contextractor/gen-input-schema start`
- Package sub-specs stay concise (role, key exports, dependencies); detail lives in the root `SPEC.md`
