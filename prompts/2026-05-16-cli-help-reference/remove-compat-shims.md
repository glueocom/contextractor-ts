# Remove Backward Compatibility Shims

> **TLDR**: Removes three backward-compat constructs that serve no purpose after clean-break changes: silent YAML config parsing in `loadConfigFile()`, the no-subcommand URL shorthand (`contextractor <url>` without `extract`), and the `normalizeConfigKeys` / `toCamelCase` snake_case normalization utilities.

Items 1 and 2 (YAML, root shorthand) are independent and can run in any order. Item 3 (`normalizeConfigKeys`) depends on `optimize-cli-args.md` being applied first — it removes the `trafilaturaConfig` call sites that are the only callers.

Read `apps/standalone/src/config.ts`, `apps/standalone/src/cliProgram.ts`, and `packages/extraction/src/index.ts` in full before making any change. Do not touch unrelated code.

## Drop: YAML config file support

**File**: `apps/standalone/src/config.ts`

`loadConfigFile()` silently accepts `.yaml`, `.yml`, and any other file extension by falling back to YAML parsing. This is documented in `.claude/rules/json-config-only.md` as an explicit backward compat concession. The supported format is JSON only.

Remove all YAML parsing. After the change, `loadConfigFile()` accepts only JSON — any non-JSON content throws an error.

Remove from `config.ts`:
- The `YamlModule` interface defined near the top of the file
- The `loadYaml()` async function (around lines 173–191)
- The `isYamlModule()` helper function
- The `.yaml` / `.yml` branch inside `loadConfigFile()`
- The YAML fallback in the `else` branch for unknown extensions

Replace the dispatch block in `loadConfigFile()` with:

```ts
if (ext === '.yaml' || ext === '.yml') {
  throw new Error(`YAML config is not supported. Convert "${filePath}" to JSON format.`);
}
data = JSON.parse(text);
```

The `yaml` package is loaded only via dynamic import inside `loadYaml()` and never imported statically — no static import line to remove. Verify that `yaml` does not appear in `apps/standalone/package.json` `dependencies` or `devDependencies`; if it does, remove it.

### Tests

No existing test exercises the YAML paths in `loadConfigFile()`. No test update is needed. Run `pnpm --filter @contextractor/standalone test` to confirm nothing breaks.

## Drop: Root command URL shorthand

**File**: `apps/standalone/src/cliProgram.ts`

`buildProgram()` registers all extraction options and a variadic positional URL argument on the root `program` object, alongside a comment reading "Root command — backwards-compatible single-URL shorthand." This allows `contextractor https://example.com` without a subcommand. The `extract` subcommand is the correct entry point; the root action is redundant.

Remove from `buildProgram()`, preserving everything else:
- The comment block starting with "Root command — backwards-compatible single-URL shorthand"
- The `addExtractionOptions(program)` call on the root program
- The `program.argument('[urls...]', ...)` declaration on the root program
- The `program.action(async (urls, opts) => ...)` block on the root program

After removal, the root program has no argument and no action — Commander shows the help screen by default when invoked without a subcommand. `contextractor extract <url>` is the required form.

Do NOT remove the `extract` subcommand or its `addExtractionOptions(extract)` call — those stay.

### Tests

`apps/standalone/src/cli.test.ts` currently checks that options like `--store-skipped-urls`, `--wait-for-selector`, `--soft-wait-for-selector`, `--dynamic-content-wait`, `--use-sitemaps`, `--initial-concurrency`, `--ignore-canonical-url` are registered on the root program via `program.options`. After this change those options live only on the `extract` subcommand.

Update every such test to check the `extract` subcommand instead of the root program:

```ts
// Before:
const program = buildProgram();
const allOptions = program.options.map((o) => o.long);
expect(allOptions).toContain('--store-skipped-urls');

// After:
const program = buildProgram();
const extract = program.commands.find((c) => c.name() === 'extract');
const allOptions = extract?.options.map((o) => o.long) ?? [];
expect(allOptions).toContain('--store-skipped-urls');
```

Apply to every option-presence test in `cli.test.ts` that calls `program.options.map(...)` on the root program.

## Drop: `normalizeConfigKeys` and `toCamelCase`

**Prerequisite**: Apply `optimize-cli-args.md` first. It removes `trafilaturaConfig` from both apps' schemas and configs, eliminating the only callers of `normalizeConfigKeys`.

**File**: `packages/extraction/src/index.ts`

`normalizeConfigKeys()` is a public export that normalizes a `Record<string, unknown>` — accepting both snake_case and camelCase keys — and merges the result over `DEFAULT_CONFIG`. Its only callers after schema promotion are:
- `apps/standalone/src/config.ts:146` — removed by `optimize-cli-args.md`
- `apps/apify-actor/src/config.ts:31` — removed by `optimize-cli-args.md`

Once those callers are gone, `normalizeConfigKeys` and its private `toCamelCase` helper are dead exports. Remove both from `packages/extraction/src/index.ts`.

Verify first that `optimize-cli-args.md` has been applied:

```bash
grep -rn 'normalizeConfigKeys' apps/
```

Must return no matches before proceeding. If matches remain, apply `optimize-cli-args.md` first.

**File**: `packages/extraction/src/index.test.ts`

Remove the two test cases that exercise `normalizeConfigKeys`:
- `'normalizeConfigKeys accepts snake_case and camelCase'`
- `'normalizeConfigKeys ignores unknown and null values'`

Remove the `normalizeConfigKeys` named import from the test file's import statement.

## After changes

- `pnpm --filter @contextractor/standalone build` — must compile clean
- `pnpm test` — all tests pass including the updated option-presence tests in `cli.test.ts`
- `grep -rn 'loadYaml\|isYamlModule\|YamlModule' apps/standalone/src/config.ts` — must return no matches
- `contextractor --help` — must list subcommands, not dump extraction flags at the top level
- `contextractor extract --help` — must show all extraction options
- `grep -rn 'normalizeConfigKeys\|toCamelCase' packages/extraction/src/` — must return no matches after item 3 is applied
