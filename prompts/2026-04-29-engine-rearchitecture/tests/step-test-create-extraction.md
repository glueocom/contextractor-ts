# Tests: Step CREATE-EXTRACTION

Test the changes from [`../implementation/step-create-extraction.md`](../implementation/step-create-extraction.md). Automatically fix any failures.

## Step BUILD: Build packages

Run `pnpm build --filter @contextractor/extraction`. Fix any TypeScript errors.

Also run `cargo build --workspace` to verify the renamed Rust crate compiles. Fix any Cargo errors.

## Step UNIT: Run unit tests

Run `pnpm test --filter @contextractor/extraction`. Fix any failing tests.

Run `cargo test --workspace`. Fix any failing Rust tests.

## Step LINT: Lint

Run `pnpm lint --filter @contextractor/extraction`. Fix all Biome errors.

Run `cargo clippy --workspace --all-targets -- -D warnings`. Fix all clippy warnings.

## Step DOWNSTREAM: Verify apps still build

Run `pnpm build --filter @contextractor/engine-apify... --filter @contextractor/engine-standalone...` (or equivalent workspace filter for both apps). Both apps must build without errors after the import rename. Fix any broken imports.

## Step VERIFY-EXPORTS: Verify new exports are accessible

Write a quick inline smoke check (or verify existing tests cover): import `computeContentInfo` and `projectMetadata` from `@contextractor/extraction` and call them. Fix if exports are missing.
