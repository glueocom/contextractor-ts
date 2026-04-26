# Migrate `contextractor-ts` — Tests Master (v2)

## TLDR

Reviews and tests every implementation step plus the final user-intent check. Every test step **automatically fixes** issues it finds — code-quality problems, test failures, missing edge cases, and deviations from the implementation step's instructions. Run them in order; the user-intent test runs last and validates the complete migration against the original v2 entry prompt and the recorded Q&A.

## Skills and Agents

- Agents: `code-reviewer` (correctness, hygiene, security per step diff), `test-runner` (build, lint, test, smoke per step), `web-research-specialist` (when a regression's root cause requires external research).
- Skills: `apify-ops`, `rust-testing-patterns`, `apify-actor-development`.

## Shared context

Every test step:

- Runs `git diff` (or `git diff <prev-step-tag>..HEAD`) for the matching implementation step's scope.
- Reviews the diff against the step's `Actions`, `Constraints`, and `Done when` criteria.
- Runs the step's local checks plus any cross-step regression checks.
- **Auto-fixes** discovered issues. Does not stop with a "report only" finding — applies the fix.
- Re-runs verification after the fix. Iterates until clean.
- Reports the final state plus a list of fixes applied.

If a fix would be destructive (delete tracked source files, alter `actor.json.name`, push to production) the test step pauses with a clear message and does **not** auto-fix.

## Step list

- `step-test-prepare-workspace.md` — workspace skeleton, leftover cleanup, prereqs.
- `step-test-build-napi-binding.md` — Cargo crate, lints, local prebuild, Python original deletion.
- `step-test-prebuild-platforms-and-ci.md` — cross-platform `.node` files committed, `optionalDependencies` resolution, `build-napi.yml`.
- `step-test-port-engine-to-ts.md` — TS engine API, dropped fields, vitest tests, no `any`.
- `step-test-rename-and-port-apify-actor.md` — rename, TS port, schemas, Dockerfile, `actor.json` guards.
- `step-test-add-standalone-cli.md` — TS CLI port, `FORMAT_EXTENSIONS` cleanup, no PyInstaller artifacts.
- `step-test-port-tools-tests.md` — vitest fixtures, command refresh.
- `step-test-update-docs-and-readmes.md` — Crawlee + rs-trafilatura wording, PyPI strip.
- `step-test-run-sync-commands.md` — `/sync/docs` and `/sync/gui` ran clean.
- `step-test-local-and-platform-tests.md` — full matrix, `glueo/contextractor-test` deploy, no production push.
- `step-test-generate-r-tools-prompt.md` — emitted prompt structure, scope, no execution.
- `step-test-user-intent.md` — final cross-check against `user-entry-log/` and the v2 entry prompt's "Lessons learned".
