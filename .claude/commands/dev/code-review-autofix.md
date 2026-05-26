---
description: Review recently written code, automatically fix every problem found, and save a report — with domain-aware checklists, web research, retest loop, and prompt learning
argument-hint: "[focus message] <prompt.md> [prompt2.md...] [commit...] [file...]"
allowed-tools: Read, Write, Edit, Bash, Skill, WebSearch, WebFetch, Glob, Grep
---

You are an expert code reviewer with auto-fix capability. Fix every finding — listing issues without fixing them is failure. Execute all steps in order.

Only ask the user if you genuinely cannot determine the correct fix. Never ask "should I continue?" or "shall I proceed?".

## Arguments

`$ARGUMENTS` is a space/quote-separated mix of:
- **Focus message** (optional): free-form text describing what to prioritize (e.g. "fix Rust error handling")
- **Prompt files** (required, one or more): tokens ending in `.md`
- **Commit refs** (optional): tokens matching `[0-9a-f]{7,40}`, `HEAD~N`, `HEAD^`, or ranges like `abc..def`
- **File paths** (optional): tokens containing `/` or ending in `.ts`, `.rs`, `.json`

If no `.md` prompt files found in `$ARGUMENTS`, stop immediately with: `Error: at least one prompt .md file is required.`

## Step PARSE

Classify each token into: focus text, `prompt_files[]`, `commits[]`, `files[]`.

## Step COLLECT

Build the unified change set:
- **Commits**: `git show --stat <ref>` then `git show <ref>` per commit ref
- **Explicit files**: read current content of each file path

Result: list of `(file_path, diff_or_null, current_content)`.

## Step CLASSIFY

Determine domain per file:

| Path pattern | Domain |
|---|---|
| `packages/schema/src/**/*.ts` | TypeScript + Zod |
| `packages/extraction/native/src/**/*.rs` | Rust (napi-rs crate) |
| `packages/extraction/src/**/*.ts` | TypeScript (native wrapper) |
| `packages/crawler/src/**/*.ts` | TypeScript + Crawlee |
| `apps/apify-actor/src/**/*.ts` | TypeScript + Apify Actor |
| `apps/standalone/src/**/*.ts` | TypeScript CLI (Commander) |
| `tools/**/*.ts` | TypeScript tooling |

## Step RESEARCH

For each non-trivial pattern or API usage in the change set:
- **Repo grep**: search `apps/` and `packages/` for existing usage — establishes convention vs. new introduction
- **SPEC.md / CLAUDE.md**: read the SPEC.md colocated with the changed package/app (`packages/schema/SPEC.md`, `packages/extraction/SPEC.md`, `packages/crawler/SPEC.md`, `apps/apify-actor/SPEC.md`, `apps/standalone/SPEC.md`); re-read relevant `.claude/rules/` files
- **Web fetch**: for unfamiliar Crawlee or Apify APIs, fetch `https://crawlee.dev/llms.txt` or `https://docs.apify.com/llms.txt`
- **Security**: WebSearch for CVEs or OWASP issues on security-adjacent patterns (input handling, proxy auth, request spoofing)

## Step REVIEW

Run the native `/code-review` skill at `high` effort level (or `xhigh` if the focus message explicitly requests deeper coverage):
- With commit range: `code-review high <commit-range>`
- With single commit: `code-review high <commit-ref>`
- With current diff only (files only, no commits): `code-review high`

If commits were parsed in Step PARSE, pass the first commit ref or range as the target. If only explicit files were provided, use the current diff (no target).

Collect the output findings. These are the baseline from the multi-agent review.

## Step AUGMENT

Apply the contextractor-specific checks below for each domain in the change set, in addition to the native review findings from Step REVIEW. Merge all findings into a single list before Step FIX.

Classify each finding:

| Bucket | Description | Action |
|---|---|---|
| `auto-fix` | Obvious anti-patterns, missing `import type` | Fix immediately |
| `confident-fix` | Clear Critical/Warning with unambiguous correct form | Fix immediately |
| `best-judgment` | Architectural tradeoffs, behavior-changing changes | Fix immediately — never ask the user |
| `info` | Minor suggestions with no clear correct form | Record in report only |

### TypeScript checks

- No `any` types — use `unknown` and narrow before use
- No `// @ts-ignore` — use `// @ts-expect-error: <reason>` with a real reason
- No `as SomeType` casts without an accompanying type guard
- `import type` for all type-only imports — check re-exports specifically
- No floating promises — every async call is awaited or explicitly handed off
- `safeParse` at all Zod input boundaries — never `.parse()` without a surrounding try/catch
- Enum values: contextractor-owned fields use kebab-case (`output-format`, `proxy-type`); Apify foreign constants (`RESIDENTIAL`, `READ`, `WRITE`, `GOOGLE_SERP`) stay SCREAMING_SNAKE_CASE — never kebab-case those
- No `console.log` in production paths — use the project's structured logger

### Rust checks

- No `.unwrap()` or `.expect()` outside `#[cfg(test)]` modules, `tests/`, `examples/`, or top-level `main` — use `?` with `anyhow`
- No `#[allow(clippy::...)]` without a justification comment on the same line
- `#[allow(dead_code)]` only in test helpers
- `println!` / `eprintln!` forbidden in production paths — use `tracing` (`info!`, `warn!`, `error!`)
- No `panic!` in library code paths
- Every network or file I/O call is wrapped in `tokio::time::timeout(...)` or has an explicit timeout at the client level
- No `MutexGuard`, `RefCell::borrow()`, or `RwLock` guard held across `.await`
- No `tokio::runtime::Runtime::new()` inside a library — runtimes belong in `main`

### napi-rs boundary checks

- `packages/extraction/native/src/lib.rs` names follow upstream `rs-trafilatura` exactly — do NOT rename types, string values, or enum variants to match TypeScript conventions
- If a naming translation is needed, it belongs in `packages/extraction/src/index.ts` at the point where the native call returns
- `txt` is the canonical plain-text format identifier across all layers — never rename it to `text` in code values

### Security checks

- No `eval()` or unsafe template injection of scraped content
- No secrets, tokens, or proxy URLs in log messages
- Validate at every input boundary: typed `serde::Deserialize` in Rust, Zod `safeParse` in TypeScript
- No `apify push` command in scripts or tooling — deploys must go through `git push origin HEAD:dev` (test) or `HEAD:main` (production)

## Step FIX

Apply all `auto-fix`, `confident-fix`, and `best-judgment` findings using the Edit tool.
Priority: security → correctness → type safety → architecture → style.
Minimal, targeted diffs — preserve unrelated code and formatting.

## Step VERIFY

Always run — even if no findings:

```bash
pnpm build
pnpm lint
cargo build --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

If any check fails: fix the issue (never add `any` or `@ts-ignore`, never `#[allow(clippy::...)]` without justification), re-run until all four commands exit 0. Do not proceed to RETEST until all pass.

## Step RETEST

Always run:
- Read each prompt file in `prompt_files[]` fully
- Extract every section whose heading contains: `Verify`, `Self-Verification`, `Tests`, `Check`, `Auto-fix loop`, `Verification`
- Also collect every inline shell command (lines containing `pnpm`, `cargo`, `vitest`, `biome`)
- Run ALL collected commands in order, including `cargo test --workspace` if present
- For any failure: apply fix, re-run until it passes

## Step PLATFORM

Run when any file in `apps/apify-actor/` or `packages/` was part of the change set (these feed into the Actor build).

Invoke the `platform:deploy-and-test` skill. It will:
- Validate locally (build, lint, test, cargo checks)
- Push to `dev` to trigger a Git-connected build on `glueo/contextractor-test`
- Wait for the build, fetch the log on failure, and fix errors
- Run a test crawl and verify the dataset contains at least one extracted item

If the platform build or crawl fails, apply the fix, then re-run the skill until both succeed before continuing.

Skip this step when the change set contains only `tools/`, `prompts/`, `.claude/`, or documentation files that do not affect the Actor bundle.

## Step LEARN

Always run last.

**Primary — fix the prompt files.** For each prompt in `prompt_files[]`:
- Missing verification steps that would have caught a finding → add them
- Vague or incomplete specs that caused ambiguity → clarify
- Outdated commands or wrong assumptions → correct

Use Edit tool directly on the prompt files.

**Secondary — update the active work prompt.** After fixing code, identify and update the prompt that describes the work being reviewed:
- Get current branch: `git rev-parse --abbrev-ref HEAD`
- List prompts: `find prompts/ -name "*.md" -maxdepth 3 2>/dev/null | head -10`
- Match: compare branch name keywords and recent commit messages against prompt directory names; pick the best match
- If matched: read the prompt, then update it to mark completed steps as `[DONE]`, update the "Current State" section if one exists, and add any new patterns or constraints discovered during this review
- Also update the relevant `SPEC.md` for any package in `packages/` or app in `apps/` whose source files were modified this session — check if the exported API, types, or entry points changed

**Tertiary — fix this command.** Extract repo-specific patterns (not generic best-practices) and integrate into `## Project-Specific Checks` below. Only edit if a genuinely new project-specific pattern emerged.

## Step REPORT

Save to `temp/code-review-autofix-report.md`:
- Date, focus message, and files reviewed
- Every fix applied (file path, line, bucket, what changed)
- `info` findings not auto-fixed

Print brief summary: N files fixed, top issues, `info` items needing manual attention.

## Project-Specific Checks

Project conventions accumulated from past reviews. Apply in Step ANALYZE alongside the domain checks above.

### Enum casing
- Contextractor-owned enum values use kebab-case: `output-format`, `proxy-type`, `wait-until`, etc.
- Apify platform foreign constants stay SCREAMING_SNAKE_CASE: `RESIDENTIAL`, `DATACENTER`, `READ`, `WRITE`, `GOOGLE_SERP` — never convert these to kebab-case
- `txt` is the canonical format identifier — never rename to `text` anywhere in code values (only in human-readable titles and descriptions)

### napi-rs boundary
- `lib.rs` is a thin shim over `rs-trafilatura` — its names follow the upstream crate exactly
- All naming translations belong in `packages/extraction/src/index.ts` at the TypeScript boundary

### Zod validation
- All external input enters through `safeParse` — the `.data` path is taken only after checking `.success`
- Actor input uses the schema from `packages/schema/` — do not inline validation in `apps/`

### Import hygiene
- `import type` for every import that carries no runtime value
- Re-export files (`index.ts`) are a common source of missing `import type` — check them specifically

### Deploy safety
- No `apify push` command anywhere in scripts, tooling, or documentation — always `git push origin HEAD:dev` for test, `HEAD:main` for production
- `apps/apify-actor/.actor/actor.json` `name` must be `contextractor-test` for test deploys (never `contextractor`)
