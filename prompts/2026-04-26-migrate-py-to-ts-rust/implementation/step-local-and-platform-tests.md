# Step local-and-platform-tests

## TLDR

Run the full local test matrix and an Apify platform smoke against `glueo/contextractor-test`. No production deploy. No publishing.

## Skills and agents

- `apify-ops`, `rust-testing-patterns`.
- Agent: `test-runner`, with `code-reviewer` reviewing any auto-fix that lands.

## Inputs

- Read `../user-entry-log/entry-qa-test-actor.md` (`glueo/contextractor-test`).
- Read `.claude/commands/platform/push-and-get-working.md` (now updated).
- Read `.claude/commands/local-tests/prompt.md`.
- Read `.claude/commands/platform-tests/{run-and-fix.md, sync-and-test.md}`.

## Actions

- Local sequence:
  - `pnpm -r build`
  - `pnpm -r lint` (Biome)
  - `pnpm -r test` (vitest across engine + tools/generated-unit-tests + apps where present)
  - `cargo build --workspace`
  - `cargo test --workspace`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - From `apps/contextractor-apify/`: `apify run` smoke crawl on a single URL via the local key-value-store input.
- Platform sequence:
  - `apify push` (default target = `glueo/contextractor-test`).
  - `tools/platform-test-runner` against the test actor: run the small suite first, then `--all` if the small suite is green.
- Fix-on-fail loop: each failure triggers a focused diagnosis + minimal patch, then the suite reruns. No flaky-test allowances — every failure must be explained or fixed.

## Constraints

- Never push to `glueo/contextractor` (production).
- Never bypass `cargo` lints or `biome` rules to make tests pass — fix the code instead.
- Do not skip platform tests, even if local is green; platform is where Dockerfile / arch / prebuild issues surface.

## Done when

- All local commands listed above exit 0.
- The latest `glueo/contextractor-test` build is `succeeded`.
- The platform-test-runner reports all suites green.
- The matching `tests/step-test-local-and-platform-tests.md` passes.
