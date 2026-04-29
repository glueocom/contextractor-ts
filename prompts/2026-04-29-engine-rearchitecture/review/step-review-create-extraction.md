# Review: Step CREATE-EXTRACTION

Review the code changes from [`../implementation/step-create-extraction.md`](../implementation/step-create-extraction.md). Automatically fix all issues found.

## Step DIFF: Identify changes

Run `git log --oneline -20`. Identify the commit(s) for the CREATE-EXTRACTION step. Run `git diff {base}..{extraction-commit}` to see all changes.

## Step REVIEW-RENAME: Verify package renames

- `packages/extraction/package.json`: name is `@contextractor/extraction`; dep key is `@contextractor/extraction-native`
- `packages/extraction/native/package.json`: name `@contextractor/extraction-native`; `napi.name` is `contextractor-extraction-native`; all four `optionalDependencies` keys use `@contextractor/extraction-native-*`
- Each `native/npm/*/package.json`: name matches `@contextractor/extraction-native-{platform}`; `main` and `files[0]` reference `contextractor-extraction-native.{platform}.node`
- `.node` binary files renamed to `contextractor-extraction-native.{platform}.node`
- `Cargo.toml` member: `packages/extraction/native`
- `packages/extraction/native/Cargo.toml` crate `name`: `contextractor-extraction-native`

Fix any inconsistencies.

## Step REVIEW-PURITY: Verify extraction package has no browser deps

Check `packages/extraction/package.json` dependencies: must not include `crawlee`, `playwright`, or any browser automation library. `@contextractor/extraction-native` is the only non-dev dependency allowed.

Fix if violated.

## Step REVIEW-PURE-FUNS: Review moved functions

- `packages/extraction/src/contentInfo.ts`: `computeContentInfo` returns `{ hash: string; length: number }` — no KVS-specific fields
- `packages/extraction/src/metadata.ts`: `projectMetadata` takes `Metadata` (not raw HTML + extractor); returns a flat object; no Crawlee/Playwright import
- Both exported from `packages/extraction/src/index.ts`

Fix signature or export issues.

## Step REVIEW-APP-IMPORTS: Verify app import updates

All `@contextractor/engine` references in both apps updated to `@contextractor/extraction`. No stale `@contextractor/engine` imports remain. Run:
```
grep -r "@contextractor/engine[^-]" apps/ packages/extraction/ --include="*.ts" --include="*.json"
```
Should return zero hits. Fix any remaining references.

## Step REVIEW-CARGO: Rust hygiene

Run `cargo clippy --workspace --all-targets -- -D warnings`. Fix all warnings. Run `cargo fmt --all` and commit any formatting changes.
