# CLI Proxy Config Consolidation — Implementation

> **TLDR**: Removes `--proxy-tier` and `--proxy-tiers` from `cliProgram.ts` (`addExtractionOptions`, `buildSchemaOverrides`, `ExtractOpts`), updates two error messages in `runExtractAction`, adds `--proxy` + `tieredProxyUrls` conflict validation, replaces two proxy-tier tests in `proxy-rotation-tester` with a single config-file test, and removes the flags from `standalone/README.md` and `SPEC.md`.

> **Note:** This is a greenfield project — no backward compatibility requirements.

Remove `--proxy-tier` and `--proxy-tiers` from the standalone CLI. Keep `--proxy` (repeatable flat list) + `--proxy-rotation` + `-c, --config` (full tiered proxy support via `tieredProxyUrls` field). The `tieredProxyUrls` Zod field and Apify Actor input remain unchanged.

Research backing this decision: `prompts/2026-05-19-cli-proxy-config-consolidation/context/`.

## Skills and Agents

- `ts-pro` — TypeScript implementation changes
- `proxy-test` skill — run proxy rotation tests with auto-fix after implementing

---

## Step ANALYZE: Read Before Changing

Read all files before making any edits:

- `apps/standalone/src/cliProgram.ts` — full file (989 lines)
- `packages/schema/src/source-of-truth/input.ts` — `tieredProxyUrls` field location
- `apps/standalone/README.md` — lines 128–145 (proxy flag table)
- `apps/standalone/SPEC.md` — lines 30–70 (proxy flags, config merge)
- `tools/proxy-rotation-tester/src/cli.test.ts` — full file (225 lines)
- `tools/proxy-rotation-tester/README.md` — lines 20–35

---

## Step IMPLEMENT: Code Changes

Use the Edit tool for all changes. Never use Write on existing files.

### `apps/standalone/src/cliProgram.ts`

**Remove `--proxy-tier` and `--proxy-tiers` options from `addExtractionOptions()` (~lines 145–151):**

Remove these two `.option()` / `.addOption()` calls:
```
.option(
  '--proxy-tier <tier>',
  'Proxy tier: comma-separated URLs for one tier, empty string for no-proxy tier (repeatable)',
  collectValues,
  [] as string[],
)
.option('--proxy-tiers <json>', 'Tiered proxy URLs as JSON (string|null)[][]')
```

**Remove `proxyTier`/`proxyTiers` branch from `buildSchemaOverrides()` (~lines 380–387):**

Remove this entire block (the `proxyTiers`/`proxyTier` branch):
```typescript
if (isCliOverride(command, 'proxyTiers') && opts.proxyTiers) {
  const parsed = parseJsonArray(opts.proxyTiers, '--proxy-tiers') as (string | null)[][];
  out.tieredProxyUrls = parsed;
} else if (isCliOverride(command, 'proxyTier') && opts.proxyTier?.length) {
  out.tieredProxyUrls = opts.proxyTier.map((tier) =>
    tier === '' ? [null] : tier.split(',').map((u) => u.trim() || null),
  );
}
```

**Update error messages in `runExtractAction()` (~lines 519, 524):**

The `tieredProxyUrls` validation loop stays — it now validates config-file-provided tiered proxies. Update the error message prefix from `--proxy-tier/--proxy-tiers:` to `tieredProxyUrls:`:

```typescript
// line ~519
console.error(`--proxy-tier/--proxy-tiers: malformed URL "${url}".`);
// → replace with:
console.error(`tieredProxyUrls: malformed URL "${url}".`);

// line ~524
`--proxy-tier/--proxy-tiers: unsupported scheme "${parsedUrl.protocol}" in "${url}".`
// → replace with:
`tieredProxyUrls: unsupported scheme "${parsedUrl.protocol}" in "${url}".`
```

**Add conflict validation in `runExtractAction()` after `resolveCliOnly()` call (~line 473):**

Insert immediately after `const cliOnly = resolveCliOnly(opts, parsed.data, command);`:
```typescript
if (cliOnly.proxyUrls.length > 0 && parsed.data.tieredProxyUrls) {
  console.error(
    'Error: --proxy and tieredProxyUrls in --config are mutually exclusive. ' +
      'Use one or the other, not both.',
  );
  process.exit(1);
}
```

**Remove `proxyTier` and `proxyTiers` from `ExtractOpts` interface (~lines 971–972):**

Remove:
```typescript
proxyTier?: string[];
proxyTiers?: string;
```

**Do NOT remove `parseJsonArray`** — it is still used for `--cookies` (line 345).

### No changes needed in `packages/schema/src/source-of-truth/input.ts`

The `tieredProxyUrls` Zod field stays. It is used by the config file path and the Apify Actor.

---

## Step DOCS: Update Documentation

### `apps/standalone/README.md`

Remove the two proxy-tier/proxy-tiers rows from the options table (~lines 137–138):
```
| `--proxy-tier` | Proxy tier: comma-separated URLs for one tier, empty string for no-proxy tier (repeatable) |
| `--proxy-tiers` | Tiered proxy URLs as JSON (string\|null)[][] |
```

Add a note about tiered proxies after the `--proxy-rotation` row:

```
> **Tiered proxies:** Pass `tieredProxyUrls` in your `-c, --config` JSON file to use
> Crawlee's automatic tier escalation. `--proxy` (flat list) and `tieredProxyUrls` in
> config are mutually exclusive.
```

### `apps/standalone/SPEC.md`

Remove the two bullet points (~lines 38–39):
```
- `--proxy-tier <tier>` — repeatable; each use adds one proxy tier ...
- `--proxy-tiers <json>` — tiered proxy URLs as a JSON ...
```

Update the config merge section (~line 67) — remove `--proxy-tier`, `--proxy-tiers` from the CLI-only flags list:

Change:
```
CLI-only flags (`--proxy`, `--proxy-tier`, `--proxy-tiers`, `--dataset`) are not accepted in the config file.
```
To:
```
CLI-only flags (`--proxy`, `--dataset`) are not accepted in the config file.
```

### All other SPEC.md and README.md files

After the specific updates above, search for any remaining references across the full repo:

```bash
grep -r "proxy-tier\|proxy-tiers" --include="*.md" .
```

Update every file found (`apps/apify-actor/README.md`, `packages/schema/SPEC.md`, etc.) to remove or replace mentions of the removed flags.

---

## Step TEST-LOCAL: Build and Lint

Run in sequence, autofix errors:

```bash
pnpm build
pnpm fix
pnpm lint
pnpm test
```

Fix any TypeScript type errors (most likely: `proxyTier` / `proxyTiers` still referenced somewhere) and biome lint issues before proceeding.

---

## Step TEST-PROXY: Proxy Rotation Tests

### Update tests first

In `tools/proxy-rotation-tester/src/cli.test.ts`, the two tests that use `--proxy-tier` and `--proxy-tiers` (~lines 121–224) must be updated to reflect the removal of those flags.

**Replace the two tests** (lines 121–224) with a single test that verifies tiered proxy via config file:

```typescript
it('should route requests through tiered proxies via --config tieredProxyUrls', async () => {
  const storageDir = join(tempDir, 'crawlee-tier-config');
  const cliBin = join(REPO_ROOT, 'apps/standalone/dist/cli.js');
  const configPath = join(tempDir, 'proxy-config.json');
  const tieredProxyUrls = [[sim.proxies[0]!], [sim.proxies[1]!]];
  writeFileSync(configPath, JSON.stringify({ tieredProxyUrls }));

  const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
    (resolve) => {
      const child = spawn(
        'node',
        [
          cliBin,
          'extract',
          'http://example.com',
          '--config',
          configPath,
          '--save',
          'txt',
          '--save-destination',
          'dataset',
          '--max-pages',
          '1',
          '--crawler-type',
          'cheerio',
        ],
        {
          env: {
            ...process.env,
            PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK: '1',
            CRAWLEE_STORAGE_DIR: storageDir,
          },
        },
      );
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (d: Buffer) => { stdout += String(d); });
      child.stderr?.on('data', (d: Buffer) => { stderr += String(d); });
      child.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
    },
  );

  expect(result.exitCode, `CLI stderr: ${result.stderr}`).toBe(0);
  const rawItem = readFirstDatasetItem(storageDir);
  const item = JSON.parse(rawItem) as Record<string, unknown>;
  const content = String(item.txt ?? '');
  const usedPort = sim.ports.some((port) => content.includes(port.toString()));
  expect(usedPort, `No proxy port found in content: ${content.slice(0, 200)}`).toBe(true);
});
```

Check what imports are at the top of `cli.test.ts` — add `writeFileSync` from `'node:fs'` if not already imported.

### Update `tools/proxy-rotation-tester/README.md`

Remove or replace lines 27–28:
```
- Tiered proxy routing via `--proxy-tier` flag (comma-separated URLs per tier, repeatable) (ports 8095–8097)
- Tiered proxy routing via `--proxy-tiers` JSON flag (ports 8095–8097)
```
Replace with:
```
- Tiered proxy routing via `--config tieredProxyUrls` (config file, ports 8095–8097)
```

### Run proxy tests

After updating the tests, run the proxy rotation test suite:

```bash
export PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1
pnpm --filter proxy-rotation-tester test
```

Or use the `/proxy-test` skill which includes the proxy simulator and autofix.

Autofix any failures before proceeding.

---

## Step TEST-ACTOR: Local Actor Run

```bash
cd apps/apify-actor && apify run
```

Verify the Actor starts and processes URLs. A minimal run is sufficient.

---

## Step COMMIT: Commit All Changes

Commit all changed files with:

```
feat(standalone)!: remove --proxy-tier and --proxy-tiers CLI flags

Tiered proxy config now belongs in the -c, --config JSON file under
tieredProxyUrls. The --proxy flag (flat list) and tieredProxyUrls in
config are mutually exclusive — the CLI now validates this explicitly.

BREAKING CHANGE: --proxy-tier and --proxy-tiers are removed.
```
