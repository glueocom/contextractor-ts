# Remove `urlBlacklist` and `authorBlacklist`

Both fields are out of scope and must be fully deleted:

- `urlBlacklist` — complete no-op. The Rust wrapper discards it with `let _`. `rs-trafilatura` has no backing field.
- `authorBlacklist` — functional but out of scope. Only relevant for academic NLP corpus pipelines; this Actor is general-purpose web extraction. Has no tests and is not in the Actor input schema.

Do not commit — make all changes then stop.

## Step RUST: Edit the napi-rs wrapper

File: `packages/extraction/native/src/lib.rs`

### Remove the two struct fields from `TrafilaturaConfig`

```rust
    pub url_blacklist: Option<Vec<String>>,
    pub author_blacklist: Option<Vec<String>>,
```

### Remove the `author_blacklist` forwarding block in `build_rs_options`

```rust
        if let Some(v) = cfg.author_blacklist.as_ref() {
            rs.author_blacklist = Some(v.clone());
        }
```

### Replace the discard tuple with two separate statements

The tuple currently silences dead-code warnings for `with_metadata`, `tei_validation`, and `url_blacklist`. After removing `url_blacklist`, rewrite it as two individual discards — one per remaining ignored field:

```rust
        let _ = cfg.with_metadata;
        let _ = cfg.tei_validation;
```

Also update the doc comment above the discard from:

```rust
        // `with_metadata`, `tei_validation`, `url_blacklist` are accepted but
        // not forwarded — rs-trafilatura 0.2.x has no backing fields.
```

to:

```rust
        // `with_metadata` and `tei_validation` are accepted but not forwarded —
        // rs-trafilatura 0.2.x has no backing fields for them.
```

## Step TS: Edit the TypeScript wrapper

File: `packages/extraction/src/index.ts`

### Remove from the `TrafilaturaConfig` interface

```ts
  urlBlacklist: string[] | null;
  authorBlacklist: string[] | null;
```

Also remove the JSDoc comment immediately above the interface that mentions these as forward-compat placeholders if it still refers to them. The comment currently reads:

```ts
/**
 * Trafilatura extraction config. `teiValidation` and `withMetadata` are
 * forward-compat placeholders accepted by the binding but ignored by
 * rs-trafilatura.
 */
```

That comment is still accurate after removal — leave it unchanged.

### Remove from `DEFAULT_CONFIG`

```ts
  urlBlacklist: null,
  authorBlacklist: null,
```

### Remove from `toNativeConfig()`

```ts
  if (config.authorBlacklist !== null) out.authorBlacklist = config.authorBlacklist;
  if (config.urlBlacklist !== null) out.urlBlacklist = config.urlBlacklist;
```

## Step REBUILD: Regenerate the native type declarations

Run this to rebuild the `.node` binary and regenerate `packages/extraction/native/index.d.ts`:

```bash
pnpm --filter @contextractor/extraction-native build:rebuild
```

After rebuild, verify that `urlBlacklist` and `authorBlacklist` are gone from `packages/extraction/native/index.d.ts`.

## Step SPECS: Update SPEC.md files

File: `SPEC.md`

Remove the two rows from the `trafilaturaConfig` field table:

```
| urlBlacklist      | string[] | `null`  | URL patterns to exclude               |
| authorBlacklist   | string[] | `null`  | Author names to exclude               |
```

File: `packages/extraction/SPEC.md`

Remove the "Additional filter fields" sentence from the `TrafilaturaConfig` section:

```
Additional filter fields: `urlBlacklist: string[] | null`, `authorBlacklist: string[] | null`.
```

## Step README: Update the extraction README

File: `packages/extraction/README.md`

Remove the two rows from the `TrafilaturaConfig` table:

```
| urlBlacklist      | string[] \| null | `null`  | URL deny list                            |
| authorBlacklist   | string[] \| null | `null`  | Author deny list                         |
```

## Step VERIFY: Run all checks

```bash
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm build
pnpm test
```

All four commands must pass with zero errors before this task is complete.
