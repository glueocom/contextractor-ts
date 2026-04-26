# Test step local-and-platform-tests

## TLDR

Reviews `../implementation/step-local-and-platform-tests.md`. Verifies the full local matrix passed, the test actor build is `READY`, the platform-test-runner suite passes, and **no production push happened**.

## Inputs

- `../implementation/step-local-and-platform-tests.md`.
- `../migrate-py-to-ts-rust-v2-notes/v1-lessons-codified.md`.
- `.claude/commands/platform/push-and-get-working.md`.

## Verification

- Local matrix passes: `pnpm -r build`, `pnpm -r lint`, `pnpm -r test`, `cargo build --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `biome check .`, and `apify run` from `apps/contextractor-apify/`.
- Test-actor build status: `apify actor get glueo/contextractor-test | jq -r '.stats.lastBuildStatus'` returns `SUCCEEDED`.
- A smoke `apify call glueo/contextractor-test --input ...` from this run produces extracted output.
- The platform-test-runner (`tools/platform-test-runner/`) passes against `glueo/contextractor-test`.
- **Production guard**: `apify actor get glueo/contextractor | jq '.stats.lastBuildAt'` did NOT advance during this run. (Capture the timestamp before deploy and compare.)
- `.claude/settings.json` deny list still blocks `apify push glueo/contextractor` and `apify call glueo/contextractor`.

## Auto-fix examples

- Local lint fails — apply the Biome / clippy auto-fix and re-run.
- Test failure on a fixture — investigate; if the regression is a default drift, fix in `packages/contextractor-engine/src/index.ts` and re-run `/sync/gui`.
- Build error on Apify — pull the build log, reproduce locally, fix, push again (still to test only).
- **Do NOT auto-fix** by changing `actor.json.name` or running `--production`. Surface the failure.

## Done when

All local and platform checks pass. No production push occurred.
