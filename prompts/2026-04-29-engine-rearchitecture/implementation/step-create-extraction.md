# Step CREATE-EXTRACTION: Create `@contextractor/extraction`

## TLDR

Renames `packages/contextractor-engine` → `packages/extraction`. Renames the native binding from `@contextractor/engine-native` to `@contextractor/extraction-native` (all four platform variants). Moves `computeContentInfo` and `projectMetadata` from `apps/contextractor-apify/src/extraction.ts` into the package. Updates both apps to import from `@contextractor/extraction`. Build and tests must pass at the end.

**Notes**: [`../engine-rearchitecture-notes/research-monorepo-structure.md`](../engine-rearchitecture-notes/research-monorepo-structure.md)
**Q&A**: [`../user-entry-log/entry-qa-native-rename.md`](../user-entry-log/entry-qa-native-rename.md)

**Skills/agents**: `ts-pro`, `rust-pro`, `rust-packaging`

---

## Step RENAME-DIR: Rename package directory and update package names

- Rename directory: `packages/contextractor-engine/` → `packages/extraction/`
- `packages/extraction/package.json`:
  - `name`: `@contextractor/engine` → `@contextractor/extraction`
  - `description`: update to reflect new name
  - `dependencies["@contextractor/engine-native"]`: change key to `@contextractor/extraction-native`
- `packages/extraction/native/package.json`:
  - `name`: `@contextractor/engine-native` → `@contextractor/extraction-native`
  - `description`: update
  - `napi.name`: `contextractor-engine-native` → `contextractor-extraction-native`
  - `optionalDependencies`: rename all four keys (`@contextractor/engine-native-darwin-arm64` etc.) to `@contextractor/extraction-native-*`

## Step RENAME-PLATFORM-PKGS: Rename platform-specific packages

For each of the four platform packages under `packages/extraction/native/npm/{darwin-arm64,darwin-x64,linux-x64-gnu,linux-arm64-gnu}/`:
- `package.json`:
  - `name`: `@contextractor/engine-native-{platform}` → `@contextractor/extraction-native-{platform}`
  - `main`: `contextractor-engine-native.{platform}.node` → `contextractor-extraction-native.{platform}.node`
  - `files[0]`: same rename
- Rename the `.node` binary file in each directory:
  - `contextractor-engine-native.{platform}.node` → `contextractor-extraction-native.{platform}.node`

## Step RENAME-CARGO: Update Cargo workspace

- `Cargo.toml` root: `members = ["packages/contextractor-engine/native"]` → `members = ["packages/extraction/native"]`
- `packages/extraction/native/Cargo.toml`:
  - `name`: `contextractor-engine-native` → `contextractor-extraction-native`
  - `description`: update

## Step UPDATE-INDEX: Update TypeScript source

- `packages/extraction/src/index.ts`: update import of native bindings from `@contextractor/engine-native` → `@contextractor/extraction-native`

## Step MOVE-PURE-FUNS: Move `computeContentInfo` and `projectMetadata`

Move these two functions from `apps/contextractor-apify/src/extraction.ts` into `packages/extraction/src/`:

**`packages/extraction/src/contentInfo.ts`** (new file):
- Move `computeContentInfo(content: string | Buffer): { hash: string; length: number }` — strip the KVS-specific optional fields (`key?`, `url?`) from the return type; those are added by the app-level `saveContentToKvs`
- Remove the `ContentInfo` import from `extraction.ts`; app defines its own `ContentInfo` extending with `key?` and `url?`

**`packages/extraction/src/metadata.ts`** (new file):
- Move `projectMetadata` but update the signature to decouple it from HTML extraction:
  - Old: `projectMetadata(html: string, url: string, extractor: ContentExtractor): DatasetMetadata`
  - New: `projectMetadata(meta: Metadata): DatasetMetadata` — takes the already-extracted `Metadata` object
  - Move the `DatasetMetadata` interface here
- Update call sites: wherever `projectMetadata(html, url, extractor)` is called, replace with `projectMetadata(extractor.extractMetadata(html, url))`

Export both from `packages/extraction/src/index.ts` barrel.

## Step UPDATE-APP-IMPORTS: Update both apps

**`apps/contextractor-apify/src/extraction.ts`**:
- Remove `computeContentInfo` definition; import it from `@contextractor/extraction`
- Remove `projectMetadata` definition; import from `@contextractor/extraction`
- Keep `ContentInfo` interface (with `key?` and `url?`), `KvsLike`, `extractFormat`, `saveContentToKvs`
- Update `projectMetadata` call sites to the new signature

**`apps/contextractor-apify/src/config.ts`**:
- Update import: `@contextractor/engine` → `@contextractor/extraction`

**`apps/contextractor-apify/package.json`**:
- Rename dep key `@contextractor/engine` → `@contextractor/extraction`

**`apps/contextractor-standalone/src/config.ts`** and **`apps/contextractor-standalone/src/crawler.ts`**:
- Update import: `@contextractor/engine` → `@contextractor/extraction`

**`apps/contextractor-standalone/package.json`**:
- Rename dep key `@contextractor/engine` → `@contextractor/extraction`

## Step VERIFY: Build and test

Run `pnpm build` from repo root. Run `pnpm test`. Run `cargo test --workspace`. All must pass. Fix any issues before committing.

Commit message: `feat: rename engine to @contextractor/extraction; rename native binding`
