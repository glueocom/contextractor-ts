# Tests: Full Regression (User Intent)

Runs the complete test suite after all implementation steps to verify no regressions. Automatically fixes any failures.

## Step FULL-BUILD: Full workspace build

Run `pnpm build` from repo root. Fix any errors.

Run `cargo build --workspace`. Fix any errors.

## Step FULL-TEST: Full test suite

Run `pnpm test` from root. All vitest suites must pass. Fix any failures.

Run `cargo test --workspace`. Fix any failures.

## Step FULL-LINT: Full lint pass

Run `pnpm lint` from root. Zero Biome errors allowed. Fix all.

Run `cargo clippy --workspace --all-targets -- -D warnings`. Zero clippy errors. Fix all.

## Step SMOKE: Smoke run

Run `apify run` (local actor run with a minimal test URL). Actor must start, crawl one URL, produce output, and exit cleanly. Fix any runtime errors.

## Step FORMAT: Verify formatting

Run `cargo fmt --all --check`. Fix any formatting issues via `cargo fmt --all`.
