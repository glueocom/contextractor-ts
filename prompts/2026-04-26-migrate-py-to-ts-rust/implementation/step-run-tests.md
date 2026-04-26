# Step RUN_TESTS: Local + Apify tests

## TLDR

Run all local Rust + TS tests, then push to `glueo/contextractor-test` and run the platform test suite. Do **not** push to production (`glueo/contextractor`).

## Skills and agents

- `test-runner` agent — wraps the full local check sequence.
- `apify-ops` — push and run conventions.

## Step LOCAL_RUST: Local Rust checks

```bash
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo build --workspace --release
cargo nextest run --workspace --all-features
```

If `cargo nextest` is not installed, fall back to `cargo test --workspace --all-features`.

## Step LOCAL_TS: Local TypeScript checks

```bash
biome check tools/
pnpm -r test            # or `npm test`
```

## Step ACTOR_LOCAL: Local Actor smoke run

```bash
cd apps/contextractor-apify
apify run                # uses local input from storage/key_value_stores/default/INPUT.json
```

Verify dataset records appear under `apps/contextractor-apify/storage/datasets/default/`.

## Step PLATFORM_PUSH: Push to test actor

```bash
cd apps/contextractor-apify
apify push --actor glueo/contextractor-test
```

Do not pass `--production`. Do not push to `glueo/contextractor`.

## Step PLATFORM_TEST: Platform test suite

Run the project's existing platform test commands:

```bash
/platform-tests:sync-and-test
/platform-tests:run-and-fix
```

Both run against `glueo/contextractor-test` per `.claude/commands/platform-tests/*.md`. Fix any failures and re-run until green.

## Step REPORT: Summary

Append a short summary to `tests-summary.md` at this step's directory level recording: cargo result, clippy result, pnpm result, local actor run dataset count, platform test result. The review step reads this summary.
