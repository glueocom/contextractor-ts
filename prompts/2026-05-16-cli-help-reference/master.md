# CLI and Storage Improvements — Full Implementation

> **TLDR**: Orchestrates five ordered steps: unify CLI storage with the Actor dataset pattern, optimize CLI flags to GNU/Commander conventions, remove backward-compat shims, plug two storage gaps, then verify end-to-end locally and on the Apify platform.

Run all steps in order. Each step must complete and pass before the next begins. Read each referenced file in full before executing it.

## What this builds

- CLI pushes failed and skipped records to the local Crawlee dataset (same pattern as the Apify Actor)
- `--save` and `--save-destination` are optional with schema-driven defaults (`markdown`, `key-value-store`)
- `--precision` / `--recall` collapsed into `--mode <mode>`; `trafilaturaConfig` promoted to flat top-level fields
- Comma-split flags (`--proxy-urls`, `--globs`, `--excludes`, `--save`) replaced with repeatable variants
- Backward-compat shims removed: YAML config support, root command URL shorthand, `normalizeConfigKeys`
- `DatasetContent` re-exported from `@contextractor/standalone`; exit code 2 on partial crawl failure

Shipping targets: **Apify Actor** and **npm package** (CLI + library).

## Step DATASET: CLI Unified Dataset

Read and execute [`1-cli-unified-dataset.md`](./1-cli-unified-dataset.md).

Routes failed and skipped URL records from the CLI into the local Crawlee dataset (matching Actor behavior). Removes the `failed-urls.json` and `skipped-urls.json` file-write blocks. Adds `status: 'success'` to `createCrawleeStorageSink`.

Commit when complete.

## Step CLI-ARGS: Optimize CLI Arguments

Read and execute [`2-optimize-cli-args.md`](./2-optimize-cli-args.md).

Replaces `--precision`/`--recall` with `--mode <mode>`, promotes `trafilaturaConfig` to flat schema fields, fixes asymmetric boolean pairs, converts comma-split flags to repeatable, wires schema defaults into Commander help output, and drops low-value parameters.

Commit when complete.

## Step COMPAT: Remove Backward Compatibility Shims

Read and execute [`3-remove-compat-shims.md`](./3-remove-compat-shims.md).

Items 1 and 2 (YAML support, root command shorthand) are independent. Item 3 (`normalizeConfigKeys`) depends on step CLI-ARGS being applied first — verify `grep -rn 'normalizeConfigKeys' apps/` returns no matches before running item 3.

Commit when complete.

## Step GAPS: Implement Storage Gaps

Read and execute [`4-implement-storage-gaps.md`](./4-implement-storage-gaps.md).

Two surgical fixes: adds `DatasetContent` to the `@contextractor/standalone` re-export and adds `process.exit(2)` after `Done.` at the end of `runExtractAction()`.

Commit when complete.

## Step VERIFY: Test and Autofix

Read and execute [`5-test-and-autofix.md`](./5-test-and-autofix.md).

Runs local CLI scrapes covering all changed behavior, verifies help output, tests exit code 2, YAML rejection, and the `DatasetContent` re-export. Deploys to `glueo/contextractor-test` via `/platform:deploy-and-test` and runs a test crawl with new schema fields.

Fix every failure before marking done. Do not proceed to the next check until the current one passes.
