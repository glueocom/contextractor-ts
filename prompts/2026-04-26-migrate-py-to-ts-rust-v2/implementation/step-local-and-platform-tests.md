# Step local-and-platform-tests

## TLDR

Run the full local test matrix, then deploy to **`glueo/contextractor-test` only** and run the platform-test-runner suite. Production `glueo/contextractor` is **out of scope** — do not push there.

## Skills and Agents

- Skills: `apify-ops`, `rust-testing-patterns`.
- Agents: `test-runner` (primary), `code-reviewer` (failure triage).

## Reference reading

- `../user-entry-log/entry-initial-prompt.md` ("do all the tests, local and Apify (`glueo/contextractor-test`), but in scope in this prompt, do not deploy anything except to the Apify test actor").
- `../migrate-py-to-ts-rust-v2-notes/v1-lessons-codified.md` (Production-actor protection; v1 accidentally pushed 0.3.5 to production).
- `.claude/commands/platform/push-and-get-working.md` (Step ACTOR_NAME_GUARD; `--production` flag; auto-fix loop on build failures).

## Actions

### Local matrix

Run in order; abort on the first failure and fix before proceeding:

- `pnpm install --frozen-lockfile`
- `pnpm -r build`
- `pnpm -r lint`
- `pnpm -r test`
- `cargo build --workspace`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `biome check .`
- `apify run` from `apps/contextractor-apify/` against the default test URL — verifies the local engine and Crawlee end-to-end.

### Apify test deploy (test actor only)

Pre-flight (the existing command does this; verify by hand first):

- `apify info` confirms login.
- `jq -r '.name' apps/contextractor-apify/.actor/actor.json` returns **`contextractor-test`** (anything else aborts the step).
- `.claude/settings.json` deny list still covers `apify push glueo/contextractor` and `apify call glueo/contextractor`.

Deploy:

- Run `.claude/commands/platform/push-and-get-working.md` **without** `--production` — that command's default target is `glueo/contextractor-test`. The command runs the local matrix, pushes, polls for build status, and (per its existing definition) auto-fixes build errors and retries until green.
- Once the build is green, run a tiny test crawl through the platform — `apify call glueo/contextractor-test --input '{"startUrls":[{"url":"https://blog.apify.com/what-is-web-scraping/"}]}'` (or the equivalent the command emits).

### Platform-test-runner

- From `tools/platform-test-runner/`, run the standard suite against `glueo/contextractor-test`.
- Triage failures: a regression in extracted output usually means a config-default drift between TS, napi-rs, and the schema — the `/sync/gui` step should have caught this; if not, fix it locally and re-deploy before retrying the suite.

## Constraints

- **Never push to `glueo/contextractor`** in this step. The deny list and the `Step ACTOR_NAME_GUARD` are the safety nets — do not bypass either.
- Do not run `--production`. The flag is documented for posterity but disabled here.
- Do not skip the local matrix in favor of "just push and see" — the local matrix catches issues that platform builds make slower to diagnose.
- If the local matrix fails, **stop the step**, fix the failure, and re-run from `pnpm install`.

## Done when

- Every local matrix command passes (no warnings ignored, no `-- --` excludes).
- `apify run` produces a non-empty dataset entry locally.
- The Apify build for `glueo/contextractor-test` reaches `READY` and a smoke `apify call` returns extracted output.
- The platform-test-runner suite passes against `glueo/contextractor-test`.
- `git log --oneline glueo/contextractor` (search) does not show any new push from this prompt — verify with `apify actor get glueo/contextractor | jq '.stats.lastBuildAt'` (timestamp must NOT have advanced during this run).
- The matching `../tests/step-test-local-and-platform-tests.md` passes.
