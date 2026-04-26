# Step PORT_TOOLS: Port `tools/`

## TLDR

Keep `tools/platform-test-runner/` as TypeScript. Rewrite `tools/generated-unit-tests/` from pytest to Cargo integration tests, reusing the source repo's HTML fixtures.

## Skills and agents

- `rust-testing-patterns` — Cargo integration tests, fixtures, snapshot via `insta`.
- `apify-ops` — platform test orchestration.
- `ts-pro` — TS test runner edits.
- `rust-pro` — Rust test crate.

## Inputs

- Source TS runner: `/Users/miroslavsekera/r/contextractor/tools/platform-test-runner/`.
- Source pytest fixtures: `/Users/miroslavsekera/r/contextractor/tools/generated-unit-tests/fixtures/`.
- Target TS runner (already exists, may be stale): `/Users/miroslavsekera/r/contextractor-ts/tools/platform-test-runner/`.
- Target generated-unit-tests (currently pytest): `/Users/miroslavsekera/r/contextractor-ts/tools/generated-unit-tests/`.

## Step TS_RUNNER: Update TS test runner

- `diff` source vs target `tools/platform-test-runner/`. Propagate any source-side improvements (test suites, schemas).
- Replace any zod schema fields referencing dropped Apify properties (`saveExtractedXmlToKeyValueStore`, `saveExtractedXmlTeiToKeyValueStore`).
- Update `package.json` scripts and dependencies. Run `pnpm install` (or `npm install`) and `biome check tools/`.

## Step CARGO_TESTS: Replace pytest with Cargo

- Delete `tools/generated-unit-tests/{conftest.py,pyproject.toml,uv.lock,tests/,__pycache__/}`. Keep `tools/generated-unit-tests/fixtures/`.
- Add `tools/generated-unit-tests/Cargo.toml` (test crate; no library, just `tests/` directory).
- Add `tools/generated-unit-tests` to workspace `Cargo.toml` members.
- Port each pytest case under `tests/<topic>.rs`. Use `insta` for snapshot comparisons against expected outputs in fixtures, `wiremock` if any test needs HTTP mocking, `tokio::test` for async cases.
- Each test reads its HTML fixture, calls `contextractor_engine::ContentExtractor`, and asserts content + metadata.

## Step VERIFY: Run

- `cargo test -p generated-unit-tests --all-features` (or `cargo nextest run -p generated-unit-tests`).
- `pnpm -r test` from repo root (or `npm test`).
- `biome check tools/` and `cargo clippy -p generated-unit-tests -- -D warnings`.
