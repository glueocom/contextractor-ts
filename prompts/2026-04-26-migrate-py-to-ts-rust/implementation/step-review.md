# Step REVIEW: Review, test, autofix

## TLDR

Run a full review pass over every prior step's diff, execute all build / lint / test commands, verify every requirement in the user-entry-log is reflected in the code, and auto-fix gaps.

## Skills and agents

- `code-reviewer` agent — primary reviewer across Rust + TS diffs.
- `rust-pro` — Rust-specific deep dives.
- `ts-pro` — TypeScript-specific deep dives.
- `test-runner` — execute the full local check sequence.

## Step DIFF: Capture full diff

```bash
cd /Users/miroslavsekera/r/contextractor-ts
git fetch origin
git diff $(git merge-base HEAD origin/main)..HEAD --stat
git diff $(git merge-base HEAD origin/main)..HEAD > /tmp/contextractor-migration.diff
```

## Step PER_STEP_REVIEW: Review against each step's instructions

For each `step-*.md` (excluding `step-review.md`):

- Read the step file.
- Identify the files it expected to change.
- Verify the diff covers those files.
- Flag any expected change that did **not** land.
- Flag any unexpected change that landed but was not specified.

Steps to walk:

- `step-engine-port.md`
- `step-rename-app.md`
- `step-port-apify-app.md`
- `step-add-standalone-app.md`
- `step-propagate-schemas.md`
- `step-port-tools.md`
- `step-propagate-docs.md`
- `step-switch-apify-owner.md`
- `step-run-sync-commands.md`
- `step-run-tests.md`
- `step-write-sibling-prompt.md`

## Step USER_INTENT_CHECK: Verify every requirement

For each line in `../user-entry-log/entry-initial-prompt.md`, identify which step covers it and confirm the corresponding file change exists. Specifically check:

- Schemas and config from `/r/contextractor/apps/contextractor-apify/.actor` propagated to `apps/contextractor-apify/.actor/`.
- `packages/contextractor_engine` now uses `rs-trafilatura` (verify `Cargo.toml` dep).
- `apps/contextractor` renamed to `apps/contextractor-apify` (verify dir + grep).
- `apps/contextractor-standalone` exists with a Rust CLI and `npm/` wrapper.
- Markdown / docs propagated, no Python install instructions remain (`grep -rln "pip install\|pyproject.toml\|uv sync"` returns no matches outside `prompts/`).
- PyPI mentions removed from every doc except deliberate "PyPI no longer supported" notices: `grep -rln pypi --include="*.md"` outside `prompts/` returns nothing or only deprecation notices.
- Local + Apify tests ran (verify `tests-summary.md` exists with green outcomes).
- Sibling prompt exists at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-ts-changes/`.

For each QA decision file under `../user-entry-log/`, verify the implication landed:

- `entry-qa-format-gap.md` → schema and engine free of XML/TEI; supported formats list reads `HTML, TXT, JSON, Markdown` everywhere.
- `entry-qa-apify-owner.md` → no `shortc/contextractor` reference outside `prompts/`.
- `entry-qa-rename-scope.md` → no `apps/contextractor[^-]` reference outside `prompts/`.
- `entry-qa-sibling-prompt.md` → sibling prompt directory exists with the expected file count.

## Step BUILD_TEST: Run the full check matrix

```bash
cd /Users/miroslavsekera/r/contextractor-ts
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo build --workspace --release
cargo nextest run --workspace --all-features    # or `cargo test --workspace --all-features`
biome check tools/
pnpm -r test                                      # or `npm test`
```

If any command fails, auto-fix the underlying issue. Do not skip hooks. Do not bypass clippy with `#[allow]` — fix the code.

## Step AUTOFIX: Fix discovered gaps

For each gap surfaced in earlier sub-steps:

- If the gap is a missing file change that the step file specified, apply the change now and rerun the build matrix.
- If the gap is an unexpected change with no specification, decide: leave it (with a one-line justification appended to `tests-summary.md`) or revert it.
- If a test is flaky, do not mark it green — investigate and fix root cause.

## Step FINAL_REPORT: Final report

Append a section to `tests-summary.md` listing:

- Each step file and its review outcome (covered / partially covered / not covered).
- Each QA decision and its verification outcome.
- Final command results (cargo fmt / clippy / build / nextest / biome / pnpm).
- Any deferred items the implementer needs to address before merging.
