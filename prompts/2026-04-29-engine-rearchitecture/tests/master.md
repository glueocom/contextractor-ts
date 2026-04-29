# Engine Rearchitecture — Tests Master

## TLDR

Runs tests for each implementation step and a final full-suite regression. All test steps automatically fix failures they find.

## Agents and Skills

- `test-runner` — build, lint, vitest, smoke run

## Steps (execute in order)

- [`step-test-create-extraction.md`](./step-test-create-extraction.md) — Test `@contextractor/extraction` build and unit tests
- [`step-test-create-crawler.md`](./step-test-create-crawler.md) — Test `@contextractor/crawler` build; verify entry-point constraints
- [`step-test-rename-apps.md`](./step-test-rename-apps.md) — Test full build passes after directory renames
- [`step-test-autoconsent.md`](./step-test-autoconsent.md) — Test autoconsent module builds; verify lazy-load
- [`step-test-docs-sweep.md`](./step-test-docs-sweep.md) — Grep-based verification of documentation completeness
- [`step-test-user-intent.md`](./step-test-user-intent.md) — Full test suite regression after all steps
