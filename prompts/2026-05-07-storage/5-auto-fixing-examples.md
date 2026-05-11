# Auto-Fix: Examples Verification

> **TLDR**: Runs after `3-examples.md`. Reviews all four example projects for correctness — `saveDestination` scoping, format identifiers, actor references, and file permissions — then runs validation commands and auto-fixes failures in a loop.

Run this after completing `3-examples.md`. Review every example project for correctness, run all validation commands, and fix every failure. Repeat the fix loop until everything passes.

## Prerequisites

`3-examples.md` must be complete — all four `examples/` directories created: `library-ts/`, `cli-npm/`, `apify-api-ts/`, `cli-apify/`. Schema and storage verification is in `4-auto-fixing-tests.md`.

## Agents

- `ts-pro` — TypeScript fixes in example projects
- `code-reviewer` — content and correctness review

## Step REVIEW: Content Review

### Common rules

- `saveDestination` must NOT appear in `library-ts/` or `cli-npm/`.
- `saveDestination` MUST appear in `apify-api-ts/` and `cli-apify/`.
- All format values use `txt` not `text` throughout.
- No hardcoded tokens or credentials; all come from env vars.
- `glueo/contextractor-test` is used in all Apify examples — `glueo/contextractor` (production) must not appear.
- `--format` flag is not used in any example (it was removed as a redundant alias of `--save`).
- Named dataset routing uses `--dataset <name>`, never `-o <name>` (`-o` is taken by `--output-dir`).
- Dataset item indexes are **0-based**: `contextractor get default 0`, not `1`.

### `examples/library-ts/`

- `package.json`, `tsconfig.json`, `src/main.ts` all exist.
- `src/main.ts` imports the programmatic API from `@contextractor/standalone` — not the binary.
- Calls `extract` with a URL and demonstrates consuming results with `Dataset.open()` and `dataset.forEach()` from the re-exported Crawlee API.
- No `saveDestination`.

### `examples/cli-npm/run.sh`

- File is executable.
- Contains the command patterns from `3-examples.md`:
  - Single URL extract: `contextractor extract <url> --save txt`
  - Multi-URL extract: `contextractor extract <url1> <url2> --save markdown`
  - Named dataset: `contextractor extract <url> --dataset my-archive`
  - Input file: `contextractor extract --input-file urls.txt`
  - List default dataset: `contextractor list --format json --limit 10`
  - List named dataset: `contextractor list my-archive --format jsonl --desc`
  - Get item: `contextractor get default 0` (0-based index)
  - KVS put file: `contextractor kvs put my-key ./file.json`
  - KVS put stdin: `echo '{"ok":true}' | contextractor kvs put my-key - --content-type application/json`
  - KVS get: `contextractor kvs get my-key`
  - KVS list: `contextractor kvs ls --limit 20`
  - KVS delete: `contextractor kvs rm my-key`
  - Print storage path: `contextractor storage-dir`
  - Purge default: `contextractor purge`
  - Purge all: `contextractor purge --all`
  - Custom storage dir: `CONTEXTRACTOR_STORAGE_DIR=./my-storage contextractor extract <url>`
- No `saveDestination`.

### `examples/apify-api-ts/`

- `package.json`, `tsconfig.json`, `src/main.ts` all exist.
- Uses `apify-client` npm package.
- Targets `glueo/contextractor-test` — not `glueo/contextractor`.
- Starts a run, waits for it to finish, retrieves dataset results.
- Passes `saveDestination: ['dataset']` in actor input.

### `examples/cli-apify/run.sh`

- File is executable.
- Calls `apify call glueo/contextractor-test` — not `glueo/contextractor`.
- Passes actor input as JSON including `saveDestination`.

## Step TEST: Run Validation Commands

### TypeScript compilation

```bash
cd examples/library-ts && npx tsc --noEmit
cd examples/apify-api-ts && npx tsc --noEmit
```

### File permissions

```bash
test -x examples/cli-npm/run.sh && echo "cli-npm: ok"
test -x examples/cli-apify/run.sh && echo "cli-apify: ok"
```

### No saveDestination in non-Apify examples

```bash
grep -rl 'saveDestination' examples/library-ts/ examples/cli-npm/
```

No output means pass. Any match is a bug.

### saveDestination present in Apify examples

```bash
grep -l 'saveDestination' examples/apify-api-ts/src/main.ts examples/cli-apify/run.sh
```

Both files must appear in output.

### No production actor reference

```bash
grep -rn 'glueo/contextractor[^-]' examples/
```

No output means pass. Any match that is not `glueo/contextractor-test` is a bug.

### No removed --format flag in examples

```bash
grep -rn -- '--format' examples/cli-npm/ | grep -v 'contextractor list'
```

No output means pass. (`--format` was removed as a redundant alias of `--save`; `contextractor list --format` is excluded by the filter.)

## Step CRITERIA: Acceptance Criteria

### Structure

- [ ] All four directories exist: `library-ts/`, `cli-npm/`, `apify-api-ts/`, `cli-apify/`.
- [ ] `run.sh` in `cli-npm/` and `cli-apify/` are executable.
- [ ] TypeScript projects have `package.json`, `tsconfig.json`, `src/main.ts`.
- [ ] `library-ts/` and `apify-api-ts/` compile without errors.

### Content

- [ ] No `saveDestination` in `library-ts/` or `cli-npm/`.
- [ ] `saveDestination: ['dataset']` present in `apify-api-ts/src/main.ts`.
- [ ] `saveDestination` present in `cli-apify/run.sh`.
- [ ] `glueo/contextractor-test` used in both Apify examples; `glueo/contextractor` (bare, no `-test`) does not appear.
- [ ] `cli-npm/run.sh` contains all 16 command patterns listed in Step REVIEW.
- [ ] No hardcoded tokens in any file; all loaded from env vars.
- [ ] Format values use `txt` not `text` throughout all examples.

## Step FIX: Auto-Fix Loop

For each failing check:

- Read the failing file and the relevant section of `3-examples.md`.
- Apply the minimal fix (use Edit tool; never rewrite the whole file).
- Re-run only the affected check.
- Repeat until the criterion passes.

Do not mark a criterion as passing until its command exits 0 or the manual check is confirmed.

## Report

Add examples findings to `prompts/2026-05-07-storage/report.md` (the shared report created by `4-auto-fixing-tests.md`):

- Any deviations from `3-examples.md` and why.
- Examples that cannot be fully validated without a live Apify environment — note as deferred with rationale.
- Follow-up issues found during review.
