---
description: Sync all SPEC.md files with source — autofix stale specs, ask for direction on ambiguous gaps, then commit and push
allowed-tools: Bash(git:*), Read, Edit, Glob, Grep, AskUserQuestion
model: sonnet
---

# Sync SPEC.md (Interactive)

Scan all six SPEC.md files against their source counterparts. Apply unambiguous fixes immediately, pause and ask the user for direction on each genuinely ambiguous discrepancy, then commit the result.

This is the interactive counterpart to the autonomous `sync-spec` command. The distinction: this command pauses on ambiguous cases rather than logging them for later review.

## Source → SPEC mapping

- `packages/extraction/src/**` + `packages/extraction/native/src/**` → `packages/extraction/SPEC.md`
- `packages/crawler/src/**` → `packages/crawler/SPEC.md`
- `packages/schema/src/**` → `packages/schema/SPEC.md`
- `apps/apify-actor/src/**` → `apps/apify-actor/SPEC.md`
- `apps/standalone/src/**` → `apps/standalone/SPEC.md`
- Architecture or data-flow changes in any of the above → root `SPEC.md`

## Step SCAN: Read specs and source side-by-side

Run `git diff --name-only HEAD~1..HEAD` and `git status --short` to identify recently changed files — prioritise specs for those packages.

For each of the six SPEC.md files, read the spec and its corresponding source entry points:

- `packages/*/src/index.ts` — TypeScript public exports
- `packages/extraction/native/src/lib.rs` — Rust napi-rs binding surface
- `apps/apify-actor/src/run.ts` — Actor entry point
- `apps/standalone/src/cliProgram.ts` — CLI entry point (note: file is `cliProgram.ts`, not `program.ts`)

Read every relevant file. Do not skip a package because its source did not appear in the recent diff — drift can accumulate silently.

## Step DETECT: Classify each discrepancy

For each spec, identify every discrepancy and classify it as one of two kinds.

**Autofixable** — the right answer is unambiguously derivable from source:

- A new export or field appears in source but is absent from the spec
- A signature, type, or option name changed in source; the spec still shows the old one
- A field or export was removed from source; the spec still documents it as present
- A description is factually wrong in a way the code clearly resolves (e.g., wrong default value)

**Needs user decision** — the right answer requires human judgement:

- Spec documents a feature or export that no longer exists in source — could mean it was intentionally removed (remove from spec) or accidentally deleted (restore in code)
- A naming divergence where both spec and code could plausibly be correct
- Spec and code contradict each other on behaviour in a non-obvious way with no clear winner

## Step AUTOFIX: Apply all autofixable edits

Use the Edit tool for every change. Never use Write on an existing SPEC.md. Update only the drifted sections. Preserve heading structure, prose style, and all accurate content.

After each edit, do a coherence check — the spec must read correctly end-to-end after the patch.

Apply all autofixable edits before moving to the Ask step.

## Step ASK: Interactive resolution for ambiguous discrepancies

For each "needs user decision" discrepancy, use `AskUserQuestion` with one question per discrepancy (or group two or three closely related ones in a single question when they have the same resolution options).

Each question must:

- Name the file and describe the specific discrepancy in one sentence
- Offer exactly the options that apply to that case, e.g.:
  - "Fix SPEC.md to remove the stale entry"
  - "Restore the missing implementation in source"
  - "Skip for now"

Apply the user's chosen fix immediately after each answer before asking the next question.

## Step README-CHECK: Verify @generated regions

After applying spec edits, run:

```bash
pnpm docs:update
```

If the output diff changes any README, it means the `@generated` regions were stale. Commit those changes alongside the SPEC.md edits — they are part of the same sync.

> **Context**: `pnpm docs:update` rewrites `@generated` markdown regions in READMEs from source. SPEC.md and README `@generated` blocks are both derived from the same source truth. The `spec-gate.sh` Stop hook enforces SPEC.md updates during development; this command handles catch-up syncs when drift has accumulated.

## Step COMMIT: Commit and push

After all fixes are applied, stage and commit with a message listing which SPEC.md files were updated and a one-line summary of the change in each. Then push.

```bash
git add -A
git commit -m "docs(spec): sync SPEC.md files with source

- packages/extraction/SPEC.md: <what changed>
- apps/standalone/SPEC.md: <what changed>"
git push
```

If nothing changed (all specs were already in sync), skip the commit step and tell the user which specs were checked and found accurate.
