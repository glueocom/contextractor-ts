# Test and Autofix

> **TLDR**: End-to-end verification of everything introduced by steps 1–4. Runs local CLI scrapes, unit tests, and a platform deploy-and-test. Fix every failure before marking done.

**Prerequisites**: Steps 1–4 must be applied before running this prompt. Read `apps/standalone/src/cliProgram.ts` and `apps/standalone/src/index.ts` if you need to verify specific behavior.

Fix failures as they are found — do not accumulate a list and fix at the end. After each fix, re-run the affected check before continuing.

## Step BUILD: Local Build and Tests

```bash
pnpm build && pnpm lint && pnpm test
cargo build --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

All must pass green before continuing.

## Step HELP: Verify Help Output

```bash
node apps/standalone/dist/cli.js --help
node apps/standalone/dist/cli.js extract --help
```

### Root help

- Must list subcommands (`extract`, `list`, `get`, `kvs`, `purge`, `storage-dir`)
- Must NOT dump extraction flags at the top level (root command shorthand removed by step 3)

### Extract subcommand help

Verify these properties are visible in `extract --help`:

- `--save <format>` shows `(default: markdown)`
- `--save-destination <dest>` shows `(default: key-value-store)`
- `--mode <mode>` shows choices `precision`, `balanced`, `recall` and `(default: balanced)`
- `--proxy <url>` (singular, repeatable) — not `--proxy-urls`
- `--glob <pattern>` (singular, repeatable) — not `--globs`
- `--exclude <pattern>` (singular, repeatable) — not `--excludes`
- `--max-pages`, `--max-results`, `--crawl-depth` show `(default: unlimited)`
- `--page-load-timeout`, `--max-concurrency` show their numeric defaults
- `--headless`, `--close-cookie-modals` show `(default: true)`
- `--include-tables`, `--include-formatting`, `--with-metadata`, `--precision`, `--recall` must NOT appear

## Step DEFAULTS: Default Format and Destination

Run without `--save` or `--save-destination`:

```bash
node apps/standalone/dist/cli.js extract https://en.wikipedia.org/wiki/Web_scraping
echo "Exit code: $?"
```

Verify:
- Exit code is 0
- Output is written to the Crawlee local storage (default `./storage/key_value_stores/default/`) in markdown format
- No `failed-urls.json` or `skipped-urls.json` files are created in the output directory (step 1 removed them)

## Step FORMATS: Explicit Save Formats

```bash
node apps/standalone/dist/cli.js extract \
  --save markdown --save txt \
  https://en.wikipedia.org/wiki/Web_scraping
```

Verify both `.md` and `.txt` output files are present in storage.

## Step MODE: Extraction Mode Flag

```bash
node apps/standalone/dist/cli.js extract --mode precision \
  https://en.wikipedia.org/wiki/Web_scraping
echo "Exit code: $?"
```

Exit code must be 0. Repeat with `--mode recall` and `--mode balanced` — all must succeed.

Verify that `--precision` and `--recall` (old flags) are rejected with a Commander error:

```bash
node apps/standalone/dist/cli.js extract --precision https://en.wikipedia.org/wiki/Web_scraping
```

Must exit non-zero and print an unknown option error.

## Step REPEATABLE: Repeatable Multi-Value Flags

```bash
node apps/standalone/dist/cli.js extract \
  --glob "**/*.html" --glob "**/*.htm" \
  --save markdown --save-destination dataset \
  https://en.wikipedia.org/wiki/Web_scraping
echo "Exit code: $?"
```

Exit code 0. Verify that comma-split variants are rejected:

```bash
node apps/standalone/dist/cli.js extract \
  --proxy-urls "http://a.com,http://b.com" \
  https://en.wikipedia.org/wiki/Web_scraping
```

Must exit non-zero (unknown option `--proxy-urls`).

## Step FAILED: Exit Code 2 and Dataset Record

```bash
node apps/standalone/dist/cli.js extract https://httpstat.us/404
echo "Exit code: $?"
```

Verify:
- Exit code is 2 (not 0 or 1)
- `Done.` appears in stderr before the process exits
- A dataset record for `https://httpstat.us/404` with `status: 'failed'` appears in local Crawlee storage (step 1 routes failed records to the dataset, step 4 adds exit code 2)

Inspect the dataset:

```bash
node apps/standalone/dist/cli.js list
```

The failed record must appear with `status: 'failed'`, `errorMessages`, and `retryCount`.

## Step COMPAT: Removed Backward Compatibility

### YAML config throws a clear error

```bash
echo 'startUrls: []' > /tmp/test.yaml
node apps/standalone/dist/cli.js extract --config /tmp/test.yaml https://en.wikipedia.org/wiki/Web_scraping
```

Must fail with an error message mentioning `YAML config is not supported` (not a silent parse failure).

### Root shorthand shows help

```bash
node apps/standalone/dist/cli.js https://en.wikipedia.org/wiki/Web_scraping
```

Must show the help screen (subcommand list), not start a crawl.

## Step TYPES: DatasetContent Re-export

Verify the TypeScript compiler accepts `DatasetContent` as a named import from `@contextractor/standalone`:

```bash
grep -n 'DatasetContent' apps/standalone/src/index.ts
```

Must return a match. Then confirm the build is clean (already verified in step BUILD) — no additional check needed.

## Step PLATFORM: Apify Actor Deploy and Test

Run the deploy-and-test command:

```
/platform:deploy-and-test
```

This pushes to `glueo/contextractor-test` (the `dev` branch), waits for the build, and runs a test crawl. Follow the full workflow defined in `.claude/commands/platform/deploy-and-test.md` — fix any build or run failures before marking this step done.

After the test crawl completes, inspect a dataset item and verify:
- `status: 'success'` is present on every extracted record
- No `trafilaturaConfig` key appears in any item (step 2 eliminated it)
- Content is non-empty markdown

Run a second crawl with explicit new schema fields to confirm the promoted extraction options work on the platform:

```bash
mcpc --json @apify tools-call call-actor \
  actor:="glueo/contextractor-test" \
  input:='{"startUrls":[{"url":"https://en.wikipedia.org/wiki/Web_scraping"}],"maxPagesPerCrawl":1,"save":["markdown"],"mode":"precision","includeComments":false}'
```

Verify the run succeeds and the dataset item reflects the extraction settings (leaner output with fewer comments due to precision mode).

## After all steps pass

- `pnpm build && pnpm lint && pnpm test` green
- `cargo build --workspace && cargo clippy --workspace --all-targets -- -D warnings` green
- All local CLI checks above pass without manual intervention
- Platform build `SUCCEEDED` and test crawl produces at least one `status: 'success'` record
- No regressions in existing functionality
