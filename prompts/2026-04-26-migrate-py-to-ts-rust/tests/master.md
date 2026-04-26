# Tests — Master

## TLDR

Per-step review and auto-fix prompts for the contextractor-ts Python→TS+Rust migration. Each `step-test-{name}.md` reviews the diff from the matching `implementation/step-{name}.md`, runs targeted tests, and **fixes any issue found**. The final `step-test-user-intent.md` validates the entire migration against the original user intent and Q&A decisions, again with auto-fix.

## Skills and agents

- `code-reviewer` — diff-level correctness, hygiene, security per step.
- `test-runner` — run `pnpm`, `cargo`, `apify` commands and interpret results.
- `ts-pro` — TypeScript fixes when reviewers find issues.
- `rust-pro` — napi-rs / Cargo fixes for the binding step.
- Skills: `apify-ops` (platform), `apify-schemas` (schema verification), `rust-testing-patterns` (Rust smoke), `rust` (lint compliance).

## Shared context

- Each test step starts by running `git log --oneline -n 20` and `git diff HEAD~1` (or against the merge base) to scope the review to the matching implementation step.
- All test prompts must read both `../user-entry-log/entry-initial-prompt.md` and the relevant `entry-qa-*.md` before reviewing.
- All test prompts must read `../migrate-py-to-ts-rust-notes/*.md` for canonical decisions before reviewing.
- All test prompts auto-fix issues found and rerun the relevant verification.
- A test step is **complete** only when its verification suite is green and `git diff` for that step matches the implementation step's intent (no scope creep).

## Step list (run in this order)

- `step-test-prepare-workspace.md` — pnpm + Cargo skeleton scaffold review.
- `step-test-rename-engine-package.md` — engine rename + Python-API capture review.
- `step-test-build-napi-binding.md` — napi-rs crate review + `cargo test` smoke.
- `step-test-port-engine-to-ts.md` — TS engine API parity with the captured Python API.
- `step-test-rename-and-port-apify-actor.md` — actor rename + TS port + schema propagation review.
- `step-test-add-standalone-cli.md` — TS standalone CLI review.
- `step-test-port-tools-tests.md` — vitest port + platform-test-runner refresh review.
- `step-test-update-docs.md` — docs propagation + PyPI scrub verification.
- `step-test-update-claude-config.md` — `CLAUDE.md` and `.claude/commands/` updates review.
- `step-test-run-sync-commands.md` — `/sync/docs` and `/sync/gui` re-verification.
- `step-test-local-and-platform-tests.md` — local + Apify test-actor smoke verification.
- `step-test-generate-r-tools-prompt.md` — verify the cross-repo follow-up prompt was created and is well-formed.
- `step-test-user-intent.md` — final whole-migration check against the original prompt + every Q&A decision; auto-fix any gap or mismatch.
