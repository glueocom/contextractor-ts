# Test step user-intent

## TLDR

Final cross-check. Reviews the **complete migration** against the original v2 entry prompt at `../user-entry-log/entry-initial-prompt.md` plus every `entry-qa-*.md`. Verifies every requirement in the entry prompt's bullets and "Lessons from the v1 implementation pass" section is reflected in the code. Auto-fixes gaps and mismatches.

## Inputs

- `../user-entry-log/entry-initial-prompt.md` (the v2 entry prompt — every bullet + the lessons section).
- `../user-entry-log/entry-qa-prebuild-distribution.md`.
- `../user-entry-log/entry-qa-ci-scope.md`.
- `../user-entry-log/entry-qa-config-field-scope.md`.
- All implementation steps under `../implementation/`.
- The current state of `/Users/miroslavsekera/r/contextractor-ts/`.

## Coverage matrix

For each requirement below, confirm it is reflected in the code and identify which implementation step delivered it. If not reflected, **auto-fix** in the right step's scope.

### Stack and propagation

- TS app logic + Rust `rs-trafilatura` via napi-rs — `packages/contextractor-engine/{src/, native/}`.
- Source schemas / configs propagated from `/r/contextractor/apps/contextractor-apify/.actor/` to `/r/contextractor-ts/apps/contextractor-apify/.actor/`, with PyPI/npm references stripped and XML/XMLTEI removed.
- `packages/contextractor_engine/` (Python) deleted; `packages/contextractor-engine/` (TS + napi-rs) populated.
- `apps/contextractor` renamed to `apps/contextractor-apify` via `git mv`; functionality propagated.
- `apps/contextractor-standalone/` ported to TS.
- `tools/` propagated; `tools/generated-unit-tests/` is a vitest package.
- `docs/` propagated; `pypi-trusted-publishing.md` not propagated.

### PyPI / npm cleanup

- No PyPI references in `*.md`, `*.json`, `*.toml` outside `prompts/`.
- No `pip install` or `trafilatura>=` outside `prompts/`.
- No accidental npm-of-Python publishing remnants in `apps/contextractor-standalone/`.

### Apify deploy + production protection

- Test deploy only: `glueo/contextractor-test`.
- `actor.json.name` is `contextractor-test`.
- `actor.json.dockerContextDir` is `../../..`.
- `actor.json.description` mentions `rs-trafilatura` and `Crawlee`.
- `apps/contextractor-apify/vendor/` does not exist.
- `apps/contextractor-apify/Dockerfile` is multi-stage with `pnpm --filter @contextractor/apify --prod deploy /deploy`.
- `.claude/settings.json` deny list still blocks `apify push glueo/contextractor` and `apify call glueo/contextractor`.
- No new build was published to `glueo/contextractor` during this prompt.
- CLAUDE.md "Production Protection" block matches the new reality.

### Engine and config

- TS engine API mirrors Python: `ContentExtractor`, `TrafilaturaConfig`, `extract`, `extractMetadata`, `extractAllFormats`.
- Drop `pruneXpath` and `dateExtractionParams` only — `teiValidation` and `withMetadata` retained.
- Supported formats: `txt | markdown | json | html`. `xml` and `xmltei` absent everywhere.
- `OutputFormat` union, `FORMAT_EXTENSIONS` map, schema enums all agree.

### napi-rs binding

- `rs-trafilatura = "0.2"` in `Cargo.toml`. Crate uses bare `Result<T>` (no aliased import).
- Strict Cargo lints denied (`expect_used`, `unwrap_used`, `missing_errors_doc`); no blanket `allow`.
- napi-rs binding does not pass `prune_xpath`, `tei_validation`, `with_metadata`, or `date_extraction_params` into rs-trafilatura.

### Prebuilds and CI

- `packages/contextractor-engine/native/npm/{darwin-arm64,darwin-x64,linux-x64-gnu,linux-arm64-gnu}/` populated with workspace packages and committed `.node` binaries.
- `optionalDependencies` reference all four with `workspace:*`.
- `.github/workflows/build-napi.yml` exists and is napi-build-only (no other workflows added).

### Tests

- Vitest `tools/generated-unit-tests/`, `fixtures/` copied verbatim.
- `.claude/commands/platform-tests/generate-unit-tests.md` emits vitest, not pytest or cargo.
- `apps/contextractor-apify/package.json` `test` includes `--passWithNoTests`.

### Cosmetic / wording

- "Built on rs-trafilatura and Crawlee" wording in every README, every spec, every Actor description, and CLAUDE.md.
- Biome ignores: `.claude/**`, `prompts/**`, `**/fixtures/**`, `**/test-suites/**`, `**/test-suites-output/**`, `**/*.node`, the napi-rs-generated loader files, the `npm/<platform>/` packages.

### Local prereqs documented

- Rust toolchain via `rustup`, Apify CLI ≥ 1.4, Node 22+, pnpm 10+ — present in CLAUDE.md and the engine README.

### Sync commands

- `/sync/docs` and `/sync/gui` were run and report no remaining drift.
- `tsconfig.json` `exactOptionalPropertyTypes` is `false` (or unset, which defaults false).

### Cross-repo follow-up

- Follow-up prompt emitted at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite/` with the structure required by `../implementation/step-generate-r-tools-prompt.md`.
- Follow-up prompt was **not** executed.

## Auto-fix policy

For each gap or mismatch found, edit the relevant source file or re-run the relevant implementation step in scope. Apply fixes idempotently — re-running this test on a clean tree must produce no further changes.

The following findings stop the auto-fix and require human review:

- `actor.json.name` does not equal `contextractor-test`.
- `glueo/contextractor` (production) build timestamp advanced during this prompt.
- A schema property exists with no TS counterpart (per `/sync/gui` policy).

## Done when

Every requirement in the coverage matrix is reflected in the code. Re-running the full test suite `tests/master.md` from the start passes with no further changes.
