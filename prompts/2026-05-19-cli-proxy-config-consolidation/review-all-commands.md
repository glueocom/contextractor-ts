# CLI Command Review — All Commands

> **TLDR**: Audit and fix usability, documentation, and consistency issues across all contextractor CLI commands (`list`, `get`, `kvs`, `purge`, `storage-dir`) and remaining issues in `extract`. Applies the same improvement principles as the proxy consolidation: remove redundancy, fix undocumented defaults, improve naming.

This prompt is a follow-up to `implement.md` (proxy consolidation). That prompt handles `--proxy-tier`/`--proxy-tiers` removal from `extract`. This prompt covers everything else.

Context: `prompts/2026-05-19-cli-proxy-config-consolidation/context/`

## Current CLI surface (for reference)

```
contextractor --help
  extract [options] [urls...]
  list [options] [dataset]
  get [options] <dataset> <index>
  kvs put|get|ls|rm
  purge [options]
  storage-dir [options]
```

Full help output:
```
==> list
  [dataset]             Dataset name (default: default)
  --limit <n>           Max items to return
  --offset <n>          Number of items to skip
  --format <fmt>        Output format: json|jsonl|csv (default: jsonl)
  --desc                Return items in descending order
  --storage-dir <path>  Override Crawlee storage directory

==> get
  <dataset>             Dataset name
  <index>               Item index (0-based)
  --storage-dir <path>  Override Crawlee storage directory

==> kvs ls
  --store <name>               KVS store name (default: default)
  --limit <n>                  Max keys to list
  --exclusive-start-key <key>  Start listing after this key
  --storage-dir <path>         Override Crawlee storage directory

==> kvs put
  <key>                  Key name
  <file>                 File path or - to read from stdin
  --store <name>         KVS store name (default: default)
  --content-type <mime>  MIME content-type override
  --storage-dir <path>   Override Crawlee storage directory

==> kvs get / kvs rm
  --store <name>        KVS store name (default: default)
  --storage-dir <path>  Override Crawlee storage directory

==> purge
  --all                 Purge all datasets and key-value stores, not just the default
  --storage-dir <path>  Override Crawlee storage directory

==> storage-dir
  --storage-dir <path>  Override Crawlee storage directory
```

## Skills and Agents

- `ts-pro` — TypeScript implementation changes

---

## Step ANALYZE: Read Before Changing

Read these files before making any edits:

- `apps/standalone/src/cliProgram.ts` — full file
- `apps/standalone/README.md`
- `apps/standalone/SPEC.md`

---

## Step IMPLEMENT: Specific Fixes

Use the Edit tool for all changes. Never use Write on existing files.

### Fix LIST-1: Document the hidden default limit in `list`

**Problem:** `list` silently caps output at 1000 items when `--limit` is omitted (line ~706 in `cliProgram.ts`: `limit: opts.limit ?? 1000`). The help text says "Max items to return" with no mention of this default. Users running `contextractor list` on a large dataset get 1000 rows and have no idea they're missing data.

**Fix in `cliProgram.ts`:** Change the `--limit` option description to document the default:

```
old: '--limit <n>', 'Max items to return'
new: '--limit <n>', 'Max items to return (default: 1000)'
```

### Fix KVS-1: Rename `--exclusive-start-key` to `--after`

**Problem:** `--exclusive-start-key <key>` in `kvs ls` is a DynamoDB-style pagination parameter name that is unfamiliar outside that ecosystem. The implementation is a client-side filter (`key <= exclusiveStartKey`), not a true server-side cursor. The intent is simply "list keys after this key alphabetically."

**Fix:** Rename the flag from `--exclusive-start-key` to `--after`. This is a breaking change for any scripts using `--exclusive-start-key`.

In `cliProgram.ts`, change:
```
old: '--exclusive-start-key <key>', 'Start listing after this key'
new: '--after <key>',              'List keys alphabetically after this key'
```

Update the action's destructuring accordingly (`opts.exclusiveStartKey` → `opts.after`).

### Fix EXTRACT-1: Add security note to `--cookies` and `--headers`

**Problem:** `--cookies <json>` and `--headers <json>` accept sensitive values (session cookies, auth headers) as command-line arguments, which are visible in `ps` output and shell history. This is the same security concern documented for proxy URLs in the research.

**Fix:** Update the help text to point users toward `--config` for sensitive values:

```
old: '--cookies <json>', 'JSON array of cookie objects'
new: '--cookies <json>', 'JSON array of cookie objects. Use -c, --config for sensitive values (avoids ps/history exposure)'

old: '--headers <json>', 'JSON object of custom HTTP headers'
new: '--headers <json>', 'JSON object of custom HTTP headers. Use -c, --config for sensitive values (avoids ps/history exposure)'
```

### Fix EXTRACT-2: Fix `--proxy-rotation` warning message casing

**Problem:** The warning in `runExtractAction()` (~line 553–555) echoes back the SCREAMING_SNAKE_CASE internal value, not what the user typed:

```
Warning: --proxy-rotation=RECOMMENDED has no effect without --proxy; running without proxy.
```

A user who typed `--proxy-rotation recommended` sees `RECOMMENDED` in the warning, which is inconsistent with CLI conventions.

**Fix:** Change the warning to use a fixed lowercase display or map back to lowercase:

```typescript
// old
`Warning: --proxy-rotation=${cliOnly.proxyRotation} has no effect ` +
  `without --proxy; running without proxy.`

// new
`Warning: --proxy-rotation has no effect without --proxy; running without proxy.`
```

Simply dropping the value from the warning is safe — the user knows what they typed.

---

## Step DOCS: Update Documentation

### `apps/standalone/README.md`

Update the `list` row in the options reference table to reflect the default limit:

```
old: | `--limit` | Max items to return |
new: | `--limit` | Max items to return (default: 1000) |
```

Update `kvs ls` row:

```
old: | `--exclusive-start-key` | Start listing after this key |
new: | `--after` | List keys alphabetically after this key |
```

### `apps/standalone/SPEC.md`

Update the `kvs ls` description and the `list` description to reflect the rename and the documented default.

---

## Step TEST-LOCAL: Build and Verify

```bash
pnpm build
pnpm fix
pnpm lint
pnpm test
```

After building, verify the changes with spot checks:

```bash
CLI="apps/standalone/dist/cli.js"
node "$CLI" list --help          # confirm --limit shows (default: 1000)
node "$CLI" kvs ls --help        # confirm --after appears, --exclusive-start-key gone
node "$CLI" extract --help       # confirm --cookies and --headers show the security note
```

Fix any TypeScript type errors (most likely: `opts.exclusiveStartKey` renamed to `opts.after`).

---

## Step COMMIT: Commit All Changes

```
fix(standalone): cli usability and documentation fixes

- list: document hidden default limit of 1000 in --limit help text
- list: confirm --format default (jsonl) is visible in help
- kvs ls: rename --exclusive-start-key to --after for clarity (breaking)
- extract: add ps/history security note to --cookies and --headers help text
- extract: simplify --proxy-rotation warning to avoid echoing internal casing
- docs: update README and SPEC to match

BREAKING CHANGE: kvs ls --exclusive-start-key is renamed to --after.
```
