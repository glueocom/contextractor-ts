# Proxy Management Improvements

Implement the proxy/session configuration improvements identified in `prompts/2026-05-19-contextractor-proxy-config/context/report.md`.

Reference report: `prompts/2026-05-19-contextractor-proxy-config/context/report.md`

## Context Files to Read First

- `packages/schema/src/source-of-truth/input.ts` — Zod source of truth
- `packages/crawler/src/createCrawler.ts` — crawler options and wiring
- `apps/apify-actor/src/run.ts` — Actor proxy construction
- `apps/apify-actor/src/config.ts` — `buildCrawlerOpts`
- `apps/standalone/src/cliProgram.ts` — CLI flags and proxy block
- `apps/standalone/src/config.ts` — `CrawlConfig`, `CliOnlyOverrides`, `buildCrawlConfig`
- `tools/proxy-rotation-tester/src/lib.test.ts`
- `tools/proxy-rotation-tester/src/cli.test.ts`
- `tools/proxy-rotation-tester/src/actor.test.ts`
- `tools/proxy-simulator/src/main.ts`

## Step SCHEMA: Add Three New Fields to Zod Source of Truth

File: `packages/schema/src/source-of-truth/input.ts`

Add all three fields after the `proxyRotation` field, inside the `ContextractorInput` object:

### Field `tieredProxyUrls`

```typescript
tieredProxyUrls: z
  .array(z.array(z.string().url().nullable()).min(1))
  .min(1)
  .optional()
  .describe(
    'Tiered proxy URLs for automatic escalation. An array of tiers; each tier is a list of ' +
    'proxy URLs (or null for "no proxy"). Crawling starts on tier 0; Crawlee escalates a domain ' +
    'to a higher tier on block detection and probes lower tiers periodically to downshift. ' +
    'Takes precedence over a flat custom proxy list. Not combinable with useApifyProxy: true ' +
    'in proxyConfiguration.',
  )
  .meta({
    title: 'Tiered proxy URLs',
    ...apifyMeta({ editor: 'json', sectionCaption: 'Proxy', isSecret: true, prefill: [] }),
  }),
```

### Field `tieredProxyConfig`

Apify-specific alternative to `tieredProxyUrls` for tiering between different Apify proxy configurations (groups, countries). Each element is an Apify `ProxyConfigurationOptions` object minus core Crawlee fields. The Apify SDK converts it to `tieredProxyUrls` internally.

```typescript
tieredProxyConfig: z
  .array(z.record(z.string(), z.unknown()))
  .min(1)
  .optional()
  .describe(
    'Tiered Apify proxy configurations for automatic escalation. An array of Apify proxy ' +
    'configuration objects; Crawlee starts on tier 0 and escalates per domain on block detection. ' +
    'Each element accepts the same fields as proxyConfiguration (groups, countryCode, password, etc.) ' +
    'but not proxyUrls or tieredProxyUrls. Example: ' +
    '[{"groups":["RESIDENTIAL"]},{"groups":["DATACENTER"]}]. ' +
    'Takes precedence over tieredProxyUrls if both are set. Requires Apify Proxy access.',
  )
  .meta({
    title: 'Tiered Apify proxy config',
    ...apifyMeta({ editor: 'json', sectionCaption: 'Proxy', isSecret: true, prefill: [] }),
  }),
```

### Field `sessionPoolName`

```typescript
sessionPoolName: z
  .string()
  .min(3)
  .max(200)
  .regex(/^[0-9A-Za-z_-]+$/)
  .optional()
  .describe(
    'Name for a persistent, shared session pool. Sessions (IP + cookies) are saved under this ' +
    'key and reused across Actor runs. Useful when proxies are frequently blocked — previously ' +
    'working sessions are preferred over random ones.',
  )
  .meta({
    title: 'Session pool name',
    ...apifyMeta({ editor: 'textfield', sectionCaption: 'Proxy' }),
  }),
```

### Field `maxSessionRotations`

```typescript
maxSessionRotations: z
  .int()
  .min(0)
  .max(20)
  .default(10)
  .describe(
    'Maximum number of session (IP + browser fingerprint) rotations per request on block ' +
    'detection. Independent of maxRequestRetries. Set to 0 to disable session rotation.',
  )
  .meta({
    title: 'Max session rotations',
    ...apifyMeta({ sectionCaption: 'Proxy' }),
  }),
```

After editing, regenerate the Apify input schema:

```bash
pnpm --filter @contextractor/gen-input-schema generate
```

Verify `apps/apify-actor/.actor/input_schema.json` now contains `tieredProxyUrls`, `tieredProxyConfig`, `sessionPoolName`, and `maxSessionRotations` fields.

## Step CRAWLER: Extend ContextractorCrawlerOptions

File: `packages/crawler/src/createCrawler.ts`

### Add two fields to `ContextractorCrawlerOptions`

After the existing `proxyRotation` field:

```typescript
sessionPoolName?: string;
maxSessionRotations?: number;
```

### Wire `maxSessionRotations` into all crawler constructors

Add `maxSessionRotations: opts.maxSessionRotations ?? 10` to `baseOptions` (shared Playwright object) and to the `CheerioCrawler` constructor options block.

### Wire `sessionPoolName` into `sessionPoolOptions`

When `opts.sessionPoolName` is set, set `persistStateKey: opts.sessionPoolName` inside `sessionPoolOptions`. This saves the session pool state under a named key in the default KV store, enabling cross-run sharing.

In the Playwright path, merge it into the existing `sessionPoolOptions` construction:

```typescript
const sessionPoolOptions = {
  ...(userSessionPoolOptions ? { ...userSessionPoolOptions } : {}),
  ...rotationSessionPoolOptions,
  ...(opts.sessionPoolName ? { persistStateKey: opts.sessionPoolName } : {}),
};
```

Apply the same `persistStateKey` merge in the `CheerioCrawler` options block.

## Step ACTOR_CONFIG: Thread New Fields Through buildCrawlerOpts

File: `apps/apify-actor/src/config.ts`

Add to the returned object in `buildCrawlerOpts`:

```typescript
sessionPoolName: input.sessionPoolName,
maxSessionRotations: input.maxSessionRotations,
```

## Step ACTOR_WIRING: Handle tieredProxyUrls in run.ts

File: `apps/apify-actor/src/run.ts`

Replace the current proxy construction block:

```typescript
const proxyConfig = input.proxyConfiguration
  ? await Actor.createProxyConfiguration(input.proxyConfiguration as ProxyConfigurationOptions)
  : undefined;
```

With:

```typescript
let proxyConfig: Awaited<ReturnType<typeof Actor.createProxyConfiguration>> | undefined;
if (input.tieredProxyUrls && input.tieredProxyConfig) {
  log.error('tieredProxyUrls and tieredProxyConfig are mutually exclusive. Remove one of them.');
  await Actor.exit({ exitCode: 1 });
  process.exit(1);
} else if (input.tieredProxyUrls) {
  if (input.proxyConfiguration && (input.proxyConfiguration as Record<string, unknown>)['useApifyProxy'] === true) {
    log.error('tieredProxyUrls and proxyConfiguration.useApifyProxy are mutually exclusive. Remove one of them.');
    await Actor.exit({ exitCode: 1 });
    process.exit(1);
  }
  proxyConfig = await Actor.createProxyConfiguration({
    tieredProxyUrls: input.tieredProxyUrls as (string | null)[][],
  });
} else if (input.tieredProxyConfig) {
  proxyConfig = await Actor.createProxyConfiguration({
    tieredProxyConfig: input.tieredProxyConfig as ProxyConfigurationOptions[],
  });
} else if (input.proxyConfiguration) {
  proxyConfig = await Actor.createProxyConfiguration(
    input.proxyConfiguration as ProxyConfigurationOptions,
  );
}
```

Proxy construction precedence: `tieredProxyUrls` (custom URL tiers) → `tieredProxyConfig` (Apify proxy tiers) → flat `proxyConfiguration`. `tieredProxyUrls` and `tieredProxyConfig` are mutually exclusive and produce an immediate error if both are set. `tieredProxyUrls` combined with `useApifyProxy: true` is also rejected.

Note: `tieredProxyConfig` is Apify-SDK-specific — it is converted to `tieredProxyUrls` internally by the SDK via `_generateTieredProxyUrls`. It is not available in the standalone CLI (no Apify proxy off-platform).

## Step CLI: Add New Flags to cliProgram.ts

File: `apps/standalone/src/cliProgram.ts`

### In `addExtractionOptions`, add after the `--proxy-rotation` option

```typescript
.option(
  '--proxy-tier <tier>',
  'Proxy tier: comma-separated URLs for one tier, empty string for no-proxy tier (repeatable)',
  collectValues,
  [] as string[],
)
.option('--proxy-tiers <json>', 'Tiered proxy URLs as JSON (string|null)[][]')
.option('--session-pool-name <name>', 'Named session pool for cross-run session sharing')
.addOption(
  new Option('--max-session-rotations <n>', 'Max session rotations per request on block detection')
    .argParser(toInt)
    .default(s.maxSessionRotations._def.defaultValue),
)
```

### In `buildSchemaOverrides`, add handlers for the new flags

```typescript
if (isCliOverride(command, 'proxyTiers') && opts.proxyTiers) {
  const parsed = parseJsonArray(opts.proxyTiers, '--proxy-tiers') as (string | null)[][];
  out.tieredProxyUrls = parsed;
} else if (isCliOverride(command, 'proxyTier') && opts.proxyTier?.length) {
  out.tieredProxyUrls = opts.proxyTier.map((tier) =>
    tier === '' ? [null] : tier.split(',').map((u) => u.trim() || null),
  );
}
if (isCliOverride(command, 'sessionPoolName') && opts.sessionPoolName) {
  out.sessionPoolName = opts.sessionPoolName;
}
if (isCliOverride(command, 'maxSessionRotations')) {
  out.maxSessionRotations = opts.maxSessionRotations;
}
```

### In the proxy construction block (around line 472)

After the existing `cliOnly.proxyUrls` path, add a tiered proxy branch. The full precedence for proxy construction:
- `parsed.data.tieredProxyUrls` set (from `--proxy-tiers` or `--proxy-tier` via `buildSchemaOverrides`) → build `new ProxyConfiguration({ tieredProxyUrls: parsed.data.tieredProxyUrls })`
- `cliOnly.proxyUrls.length > 0` → existing `new ProxyConfiguration({ proxyUrls })` path (unchanged)

Replace the `proxyConfiguration` construction block:

```typescript
let proxyConfiguration: ProxyConfiguration | undefined;
if (parsed.data.tieredProxyUrls) {
  const tiers = parsed.data.tieredProxyUrls as (string | null)[][];
  for (const tier of tiers) {
    for (const url of tier) {
      if (url === null) continue;
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        console.error(`--proxy-tier/--proxy-tiers: malformed URL "${url}".`);
        process.exit(1);
      }
      if (!['http:', 'https:', 'socks4:', 'socks5:'].includes(parsedUrl.protocol)) {
        console.error(`--proxy-tier/--proxy-tiers: unsupported scheme "${parsedUrl.protocol}" in "${url}".`);
        process.exit(1);
      }
    }
  }
  proxyConfiguration = new ProxyConfiguration({ tieredProxyUrls: tiers });
} else if (cliOnly.proxyUrls.length > 0) {
  // ... existing URL validation and ProxyConfiguration({ proxyUrls }) construction unchanged
}
```

### In the `createContextractorCrawler` call, pass new fields

```typescript
sessionPoolName: parsed.data.sessionPoolName,
maxSessionRotations: parsed.data.maxSessionRotations,
```

### Update `ExtractOpts` interface

Add:

```typescript
proxyTier?: string[];
proxyTiers?: string;
sessionPoolName?: string;
maxSessionRotations?: number;
```

## Step STANDALONE_CONFIG: Extend CrawlConfig and buildCrawlConfig

File: `apps/standalone/src/config.ts`

### Add to `CrawlConfig` interface

```typescript
sessionPoolName: string | undefined;
maxSessionRotations: number;
```

### Add to `buildCrawlConfig` return value

```typescript
sessionPoolName: input.sessionPoolName,
maxSessionRotations: input.maxSessionRotations,
```

Note: `maxSessionRotations` has a Zod default of 10, so it is always present on `ContextractorInputType`.

## Step PROXY_ROTATION_TESTS: Add Tiered Proxy Tests

### `tools/proxy-rotation-tester/src/lib.test.ts`

Add a new `describe` block using ports 8091–8094 (no conflict with existing 8081–8083):

```typescript
describe('Proxy Rotation - Library (Tiered Proxies)', () => {
  const servers: Server[] = [];
  const tier0Ports = [8091, 8092];
  const tier1Ports = [8093, 8094];
  const allPorts = [...tier0Ports, ...tier1Ports];

  beforeAll(async () => {
    for (const port of allPorts) {
      const server = new Server({
        port,
        prepareRequestFunction: () => ({
          customResponseFunction: () => ({
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `<!DOCTYPE html><html><head><title>Proxy ${port}</title></head><body><article><p>Intercepted by proxy on port ${port}</p></article></body></html>`,
          }),
        }),
      });
      await server.listen();
      servers.push(server);
    }
  });

  afterAll(async () => {
    for (const server of servers) await server.close(true);
  });

  it('should route requests through tiered proxies', async () => {
    const sink = memorySink();
    const startUrls = ['http://example.com'];
    const crawler = createContextractorCrawler({
      startUrls,
      crawlerType: 'cheerio',
      proxyConfiguration: new ProxyConfiguration({
        tieredProxyUrls: [
          tier0Ports.map((p) => `http://127.0.0.1:${p}`),
          tier1Ports.map((p) => `http://127.0.0.1:${p}`),
        ],
      }),
      formats: ['txt'],
      sink,
    });

    await crawler.run(buildRequests(startUrls));

    expect(sink.results.length).toBeGreaterThan(0);
    const content = sink.results[0]?.formats?.txt ?? '';
    const usedPort = allPorts.some((port) => content.includes(port.toString()));
    expect(usedPort, `Content did not include any proxy port. Content: "${content.slice(0, 300)}"`).toBe(true);
  });
}, 60_000);
```

### `tools/proxy-rotation-tester/src/cli.test.ts`

Add a new `describe` block using ports 8095–8097 (no conflict with existing 8084–8086):

```typescript
describe('Proxy Rotation - CLI (Tiered Proxies)', () => {
  const servers: Server[] = [];
  const proxyPorts = [8095, 8096, 8097];
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(REPO_ROOT, 'tmp-cli-tiered-test-'));
    for (const port of proxyPorts) {
      const server = new Server({
        port,
        prepareRequestFunction: () => ({
          customResponseFunction: () => ({
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `<!DOCTYPE html><html><head><title>Proxy ${port}</title></head><body><article><p>Intercepted by proxy on port ${port}</p></article></body></html>`,
          }),
        }),
      });
      await server.listen();
      servers.push(server);
    }
  });

  afterAll(async () => {
    for (const server of servers) await server.close(true);
    try { rmSync(tempDir, { recursive: true }); } catch { /* ignore */ }
  });

  it('should route requests through tiered proxies via --proxy-tier flag', async () => {
    const outputDir = join(tempDir, 'output-tier-flag');
    const cliBin = join(REPO_ROOT, 'apps/standalone/dist/cli.js');

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve) => {
        const child = spawn(
          'node',
          [
            cliBin, 'extract', 'http://example.com',
            '--output-dir', outputDir,
            '--proxy-tier', `http://127.0.0.1:${proxyPorts[0]},http://127.0.0.1:${proxyPorts[1]}`,
            '--proxy-tier', `http://127.0.0.1:${proxyPorts[2]}`,
            '--save', 'txt',
            '--max-pages', '1',
            '--crawler-type', 'cheerio',
          ],
          { env: { ...process.env, PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK: '1', CRAWLEE_STORAGE_DIR: join(tempDir, 'crawlee-tier-flag') } },
        );
        let stdout = '', stderr = '';
        child.stdout?.on('data', (d: Buffer) => { stdout += String(d); });
        child.stderr?.on('data', (d: Buffer) => { stderr += String(d); });
        child.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
      },
    );

    expect(result.exitCode, `CLI stderr: ${result.stderr}`).toBe(0);
    const files = readdirSync(outputDir).filter((f) => f.endsWith('.txt'));
    expect(files.length).toBeGreaterThan(0);
    const content = readFileSync(join(outputDir, files[0]), 'utf-8');
    const usedPort = proxyPorts.some((port) => content.includes(port.toString()));
    expect(usedPort, `No proxy port found in content: ${content.slice(0, 200)}`).toBe(true);
  });

  it('should route requests through tiered proxies via --proxy-tiers JSON flag', async () => {
    const outputDir = join(tempDir, 'output-tier-json');
    const cliBin = join(REPO_ROOT, 'apps/standalone/dist/cli.js');
    const tiers = JSON.stringify([[`http://127.0.0.1:${proxyPorts[0]}`], [`http://127.0.0.1:${proxyPorts[1]}`]]);

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve) => {
        const child = spawn(
          'node',
          [
            cliBin, 'extract', 'http://example.com',
            '--output-dir', outputDir,
            '--proxy-tiers', tiers,
            '--save', 'txt',
            '--max-pages', '1',
            '--crawler-type', 'cheerio',
          ],
          { env: { ...process.env, PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK: '1', CRAWLEE_STORAGE_DIR: join(tempDir, 'crawlee-tier-json') } },
        );
        let stdout = '', stderr = '';
        child.stdout?.on('data', (d: Buffer) => { stdout += String(d); });
        child.stderr?.on('data', (d: Buffer) => { stderr += String(d); });
        child.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
      },
    );

    expect(result.exitCode, `CLI stderr: ${result.stderr}`).toBe(0);
    const files = readdirSync(outputDir).filter((f) => f.endsWith('.txt'));
    expect(files.length).toBeGreaterThan(0);
    const content = readFileSync(join(outputDir, files[0]), 'utf-8');
    const usedPort = proxyPorts.some((port) => content.includes(port.toString()));
    expect(usedPort, `No proxy port found in content: ${content.slice(0, 200)}`).toBe(true);
  });
}, 60_000);
```

### `tools/proxy-rotation-tester/src/actor.test.ts`

Add two new tests inside the existing `describe('Proxy Rotation - Apify Actor')` block. Use ports 8098–8099 (no conflict with existing 8087–8089):

**Test 1 — tiered proxy routing:**

```typescript
it('should route requests through tiered proxies via tieredProxyUrls input', async () => {
  const tieredPorts = [8098, 8099];
  const tieredServers: Server[] = [];
  for (const port of tieredPorts) {
    const server = new Server({
      port,
      prepareRequestFunction: () => ({
        customResponseFunction: () => ({
          statusCode: 200,
          headers: { 'Content-Type': 'text/html' },
          body: `<!DOCTYPE html><html><head><title>Proxy ${port}</title></head><body><article><p>Intercepted by proxy on port ${port}</p></article></body></html>`,
        }),
      }),
    });
    await server.listen();
    tieredServers.push(server);
  }

  try {
    const result = await runActor(storageDir, {
      startUrls: [{ url: 'http://example.com' }],
      maxRequestsPerCrawl: 1,
      save: ['txt'],
      crawlerType: 'cheerio',
      tieredProxyUrls: [[`http://127.0.0.1:${tieredPorts[0]}`], [`http://127.0.0.1:${tieredPorts[1]}`]],
    });

    expect(
      result.stdout.includes('requestsFinished'),
      `Actor did not complete. stdout: ${result.stdout.slice(-500)}`,
    ).toBe(true);

    const datasetPath = join(storageDir, 'datasets/default');
    const files = readdirSync(datasetPath);
    expect(files.length).toBeGreaterThan(0);
    const datasetFile = JSON.parse(readFileSync(join(datasetPath, files[0]), 'utf-8'));
    const content = typeof datasetFile.txt === 'string' ? datasetFile.txt : JSON.stringify(datasetFile);
    const usedPort = tieredPorts.some((port) => content.includes(port.toString()));
    expect(usedPort, `Proxy port not found in dataset. content: ${content.slice(0, 300)}`).toBe(true);
  } finally {
    for (const server of tieredServers) await server.close(true);
  }
});
```

**Test 2 — mutual exclusivity validation:**

```typescript
it('should reject input when both tieredProxyUrls and useApifyProxy are set', async () => {
  const result = await runActor(storageDir, {
    startUrls: [{ url: 'http://example.com' }],
    maxRequestsPerCrawl: 1,
    save: ['txt'],
    crawlerType: 'cheerio',
    tieredProxyUrls: [['http://127.0.0.1:8098']],
    proxyConfiguration: { useApifyProxy: true },
  });

  const hasError =
    result.stderr.toLowerCase().includes('mutually exclusive') ||
    result.stdout.toLowerCase().includes('mutually exclusive') ||
    result.stderr.toLowerCase().includes('error') ||
    result.stdout.includes('exitCode: 1');
  expect(
    hasError,
    `Expected Actor to reject conflicting input. stdout: ${result.stdout.slice(-300)}\nstderr: ${result.stderr.slice(-200)}`,
  ).toBe(true);
});
```

Note: `runActor` kills the process via `SIGTERM` after detecting completion or on timeout. For the error case the process exits with code 1; the test asserts on log content rather than exit code since `runActor` kills via signal.

## Step SPEC: Update SPEC.md Files

### `packages/schema/SPEC.md`

In the proxy section, add entries for `tieredProxyUrls` (optional, `(string|null)[][]`, Apify JSON editor, secret), `tieredProxyConfig` (optional, `object[]`, Apify JSON editor, secret, Actor-only), `sessionPoolName` (optional, string, 3–200 chars, alphanumeric/dash/underscore), and `maxSessionRotations` (integer, 0–20, default 10).

### `packages/crawler/SPEC.md`

In the `ContextractorCrawlerOptions` section, add `sessionPoolName?: string` (sets `persistStateKey` in `sessionPoolOptions` for cross-run pool sharing) and `maxSessionRotations?: number` (direct Crawlee crawler option, default 10).

### `apps/apify-actor/SPEC.md`

In the proxy section, document:
- `tieredProxyUrls` — custom URL tiers, maps to `Actor.createProxyConfiguration({ tieredProxyUrls })`
- `tieredProxyConfig` — Apify proxy tiers (groups/countries), maps to `Actor.createProxyConfiguration({ tieredProxyConfig })`; converted to `tieredProxyUrls` internally by the Apify SDK
- Precedence: `tieredProxyUrls` → `tieredProxyConfig` → flat `proxyConfiguration`
- Mutual exclusivity rules: `tieredProxyUrls` + `tieredProxyConfig` → error; `tieredProxyUrls` + `useApifyProxy: true` → error
- `tieredProxyConfig` is Actor-only (not in the standalone CLI)
- `sessionPoolName` wires into `sessionPoolOptions.persistStateKey`
- `maxSessionRotations` passes through `buildCrawlerOpts` to the crawler

### `apps/standalone/SPEC.md`

In the proxy section, document the four new CLI flags: `--proxy-tier`, `--proxy-tiers`, `--session-pool-name`, `--max-session-rotations`. Document precedence: `--proxy-tiers` JSON > `--proxy-tier` repeated > `--proxy` flat.

## Step VERIFY: Build, Lint, and Test

Run in order, fixing all failures before moving to the next step:

```bash
pnpm build
```

```bash
pnpm lint
```

```bash
pnpm test
```

```bash
PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1 pnpm --filter proxy-rotation-tester test
```

## Step DOCS: Regenerate Documentation

```bash
pnpm docs:update
```

## Step COMMIT

```bash
git add -p
git commit -m "feat(proxy): add tieredProxyUrls, sessionPoolName, maxSessionRotations"
```
