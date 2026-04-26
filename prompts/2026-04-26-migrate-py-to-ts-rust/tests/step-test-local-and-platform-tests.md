# Test — local-and-platform-tests

## TLDR

Re-verify the full local + Apify-test-actor matrix from `implementation/step-local-and-platform-tests.md`. Auto-fix any failure, never lower the bar.

## Inputs

- `../implementation/step-local-and-platform-tests.md`
- `../user-entry-log/entry-qa-test-actor.md`

## Review

- Last `apify push` target was `glueo/contextractor-test`, never `glueo/contextractor` (production) — confirm via `apify actors list` or recent run history.
- Latest test-actor build status is `succeeded`.
- Platform-test-runner suite green.
- Local: `pnpm -r build`, `pnpm -r test`, `pnpm -r lint`, `cargo build --workspace`, `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings` all green.
- The Dockerfile installs the matching napi-rs prebuild for the base image arch (linux-x64-gnu or linux-arm64-gnu).

## Verify

- All commands listed in `implementation/step-local-and-platform-tests.md` `Local sequence` exit 0.
- The most recent `glueo/contextractor-test` run completes on the smoke input from `tools/platform-test-runner/test-suites/`.

## Auto-fix

For any failure: identify the smallest patch (one of: napi-rs binding, TS engine, schema, Dockerfile, platform-test-runner input fixture). Apply it. Rerun the failing command. Never `--allow-dirty` or `--no-verify` past a hook.
