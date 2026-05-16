# Optimize CLI Arguments to Industry Standards

Audit and fix CLI flags in `apps/standalone/src/cliProgram.ts` to conform to Commander.js v14 and GNU/clig.dev conventions. Clean break — no deprecated aliases, no version bump needed yet.

## Non-issues (leave as-is)

- `-V, --version` — correct; `-V` avoids conflict with `-v` (verbose). docker, kubectl, gh all use only `--version` long form.
- `--headless` / `--no-headless` — correct GNU negation. Never use `--headless=true/false`; Commander ignores the value and only checks presence.
- `--block-media` / `--no-block-media` — correct symmetric pair.
- `--no-links`, `--no-comments` — correct; Commander makes the positive the default implicitly.

## Fix: Asymmetric boolean pairs

Rename in `addExtractionOptions()`. Symmetric pairs: base name is the concept, `--no-` is the negation.

| Old | New |
|---|---|
| `--include-tables` | `--tables` (pairs with existing `--no-tables`) |
| `--include-formatting` | `--formatting` (pairs with existing `--no-formatting`) |
| `--with-metadata` | `--metadata` (pairs with existing `--no-metadata`) |
| `--include-images` | `--images` + add `--no-images` immediately after |

Commander auto-generates camelCase property names: `--tables` → `opts.tables`, etc.

## Fix: Dual-property shadowing bug in `buildSchemaOverrides()`

The asymmetric pairs above created two properties per concept, with the second silently overwriting the first. After renaming, remove stale lines and keep only the camelCase-from-flag property:

```ts
// Remove these stale lines:
if (opts.includeTables !== undefined) tcfg.includeTables = opts.includeTables;
if (opts.includeFormatting !== undefined) tcfg.includeFormatting = opts.includeFormatting;
if (opts.withMetadata !== undefined) tcfg.withMetadata = opts.withMetadata;
if (opts.includeImages !== undefined) tcfg.includeImages = opts.includeImages; // if present

// Keep only these (renamed properties):
if (opts.tables !== undefined) tcfg.includeTables = opts.tables;
if (opts.formatting !== undefined) tcfg.includeFormatting = opts.formatting;
if (opts.metadata !== undefined) tcfg.withMetadata = opts.metadata;
if (opts.images !== undefined) tcfg.includeImages = opts.images;
```

Update `ExtractOpts` interface: remove `includeTables`, `includeFormatting`, `withMetadata`; add `images?: boolean`.

## Fix: Comma-separated multi-value flags → repeatable

Comma-split breaks on values containing commas (proxy URLs). Repeatable is the convention used by Docker, kubectl, git.

| Old | New |
|---|---|
| `--proxy-urls <urls>` (comma-split string) | `--proxy <url>` (repeatable, uses `collect`) |
| `--globs <patterns>` (comma-split string) | `--glob <pattern>` (repeatable, uses `collect`) |
| `--excludes <patterns>` (comma-split string) | `--exclude <pattern>` (repeatable, uses `collect`) |

Use the existing `collect` helper (already used by `--save-destination`):

```ts
.option('--proxy <url>', 'Proxy URL (repeatable)', collect, [] as string[])
.option('--glob <pattern>', 'Glob pattern to include (repeatable)', collect, [] as string[])
.option('--exclude <pattern>', 'Glob pattern to exclude (repeatable)', collect, [] as string[])
```

In `buildSchemaOverrides()`, remove `.split(',')` calls — values are already `string[]`:

```ts
if (opts.glob?.length) out.globs = opts.glob.map((s) => ({ glob: s }));
if (opts.exclude?.length) out.excludes = opts.exclude.map((s) => ({ glob: s }));
```

In `resolveCliOnly()`:

```ts
const proxyUrls = opts.proxy ?? [];
```

Update `ExtractOpts`: `proxyUrls?: string` → `proxy?: string[]`; `globs?: string` → `glob?: string[]`; `excludes?: string` → `exclude?: string[]`.

## After changes

- `pnpm --filter @contextractor/standalone build` — must compile clean
- `pnpm test` — all tests must pass; update any test using old flag names
- Update `apps/standalone/SPEC.md` with renamed flags
- Verify with `node apps/standalone/dist/cli.js --help` — old names must not appear
- Run `grep -r 'include-tables\|with-metadata\|include-formatting\|proxy-urls\|--globs\|--excludes' apps/` — must return no matches
