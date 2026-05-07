# Wire `--proxy-urls` and `--proxy-rotation` through to Crawlee

## Context

The standalone CLI registers `--proxy-urls <urls>` and `--proxy-rotation <strategy>` flags. They flow through Commander → `CliOnlyOverrides.proxyUrls` and `parsed.data.proxyRotation` → `cfg.proxyUrls` / `cfg.proxyRotation`, but the call to `createContextractorCrawler({...})` does not pass any proxy field. Both flags are silently dropped today. The audit (`autonomous-task-output/todo/sync-gui/prompts/sync-gui-prompt.md` Issue 2) flagged this.

The Apify Actor build also has a related latent bug: it forwards `proxyConfiguration` correctly but ignores `input.proxyRotation` — so `RECOMMENDED`, `PER_REQUEST`, and `UNTIL_FAILURE` all behave identically on the Actor today. Centralising the rotation logic in the shared crawler factory fixes both surfaces at once.

This prompt implements proxy support in the standalone CLI with full behavioural parity to the Apify Actor:

- CLI: build a Crawlee `ProxyConfiguration` from bare URLs in `--proxy-urls`, validate schemes, and pass it plus `proxyRotation` into `createContextractorCrawler`.
- Crawler factory: accept `proxyRotation` and apply the Apify-style `sessionPoolOptions` overrides (`sessionOptions.maxUsageCount` for all three modes; `maxPoolSize: 1` for UNTIL_FAILURE).
- Actor: forward `input.proxyRotation` through `buildCrawlerOpts` so it benefits from the same overrides.

Apify Proxy stays out of the standalone CLI surface. Power users who want Apify Proxy locally either run the Actor build under `apify run` or use the library API directly:

```ts
import { Actor } from 'apify';
import { ProxyConfiguration } from 'crawlee';
import { createContextractorCrawler } from '@contextractor/crawler';
const proxyConfiguration = await Actor.createProxyConfiguration({ groups: ['RESIDENTIAL'] });
const crawler = createContextractorCrawler({ proxyConfiguration, proxyRotation: 'PER_REQUEST', /* … */ });
```

## Skills and Agents

- `ts-pro` — TypeScript implementation
- `apify-actor-development` — Crawlee proxy and session pool reference

## Files to Change

### `packages/crawler/src/createCrawler.ts`

Add `proxyRotation` to the options interface, place it next to `proxyConfiguration`:

```ts
proxyConfiguration?: ProxyConfiguration;
/**
 * Proxy rotation strategy. Maps to Crawlee `sessionPoolOptions`.
 * Mirrors Apify scraper-tools semantics: RECOMMENDED uses the default
 * session reuse count; PER_REQUEST retires the session after one request
 * (new browser context per request); UNTIL_FAILURE forces a single-session
 * pool that stays on one proxy URL until the session retires from errors.
 * Has no effect when `proxyConfiguration` is undefined.
 */
proxyRotation?: 'RECOMMENDED' | 'PER_REQUEST' | 'UNTIL_FAILURE';
```

Add the constant near the top of the file (after imports). Values are sourced from `@apify/scraper-tools` (`packages/scraper-tools/src/consts.ts` on GitHub, `apify/actor-scraper`):

```ts
// From @apify/scraper-tools SESSION_MAX_USAGE_COUNTS (apify/actor-scraper).
const SESSION_MAX_USAGE_COUNTS = Object.freeze({
  RECOMMENDED: undefined,
  PER_REQUEST: 1,
  UNTIL_FAILURE: 1000,
} as const);
```

Wire the rotation override into `sessionPoolOptions` inside the `new PlaywrightCrawler({...})` call. The current factory passes `sessionPoolOptions` through unchanged when `opts.sessionPool` is an object; extend that path to merge in the rotation-driven overrides. Replace the existing `sessionPoolOptions` plumbing with this shape:

```ts
const useSessionPool = opts.sessionPool !== false;
const userSessionPoolOptions =
  typeof opts.sessionPool === 'object' ? opts.sessionPool : undefined;

const rotation = opts.proxyRotation ?? 'RECOMMENDED';
const rotationSessionPoolOptions = {
  sessionOptions: {
    ...(userSessionPoolOptions?.sessionOptions ?? {}),
    maxUsageCount: SESSION_MAX_USAGE_COUNTS[rotation],
  },
  ...(rotation === 'UNTIL_FAILURE' ? { maxPoolSize: 1 } : {}),
};

const sessionPoolOptions = userSessionPoolOptions
  ? { ...userSessionPoolOptions, ...rotationSessionPoolOptions }
  : rotationSessionPoolOptions;
```

In the `new PlaywrightCrawler({...})` call, replace the existing conditional spread:

```ts
...(sessionPoolOptions ? { sessionPoolOptions } : {}),
```

with the unconditional version (since `sessionPoolOptions` is now always built):

```ts
sessionPoolOptions,
```

Leave `useSessionPool` and `persistCookiesPerSession` untouched — both stay `true` by default.

### `apps/standalone/src/cliProgram.ts`

Add `ProxyConfiguration` to the `crawlee` import (alongside the existing `buildRequests, createContextractorCrawler` imports — those come from `@contextractor/crawler`, so add a separate import line):

```ts
import { ProxyConfiguration } from 'crawlee';
```

Inside the `.action(...)` callback, just before the `createContextractorCrawler({...})` call, build the `ProxyConfiguration` with up-front URL validation. Insert this block after `cfg` is built:

```ts
let proxyConfiguration: ProxyConfiguration | undefined;
if (cliOnly.proxyUrls.length > 0) {
  for (const raw of cliOnly.proxyUrls) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      console.error(
        `--proxy-urls: malformed URL "${raw}". ` +
          `Expected http://user:pass@host:port (also accepts https://, socks4://, socks5://).`,
      );
      process.exit(1);
    }
    if (!['http:', 'https:', 'socks4:', 'socks5:'].includes(parsed.protocol)) {
      console.error(
        `--proxy-urls: unsupported scheme "${parsed.protocol}" in "${raw}". ` +
          `Use http://, https://, socks4:// or socks5://. ` +
          `Apify Proxy configuration is only supported in the Apify Actor build.`,
      );
      process.exit(1);
    }
  }
  proxyConfiguration = new ProxyConfiguration({ proxyUrls: cliOnly.proxyUrls });
} else if (parsed.data.proxyRotation && parsed.data.proxyRotation !== 'RECOMMENDED') {
  console.warn(
    `Warning: --proxy-rotation=${parsed.data.proxyRotation} has no effect ` +
      `without --proxy-urls; running without proxy.`,
  );
}
```

Then add two lines to the `createContextractorCrawler({...})` call, near the other browser/network knobs:

```ts
proxyConfiguration,
proxyRotation: parsed.data.proxyRotation,
```

### `apps/standalone/src/config.ts`

Move `proxyRotation` from `CrawlConfig` into `CliOnlyOverrides`. Today `proxyUrls` lives in `CliOnlyOverrides` and `proxyRotation` lives in `CrawlConfig`; they should travel together. This is a breaking change to `CrawlConfig`'s shape — acceptable per the project's "breaking changes OK" stance.

In `CrawlConfig`, remove:

```ts
// Proxy.
proxyUrls: string[];
proxyRotation: 'recommended' | 'per_request' | 'until_failure';
```

In `CliOnlyOverrides`, replace:

```ts
proxyUrls: string[];
```

with:

```ts
proxyUrls: string[];
proxyRotation?: 'RECOMMENDED' | 'PER_REQUEST' | 'UNTIL_FAILURE';
```

Note: `CliOnlyOverrides.proxyRotation` keeps the uppercase Zod-enum casing because `cliProgram.ts` already passes `parsed.data.proxyRotation` directly to the crawler factory, which expects uppercase. The lowercase `WAIT_UNTIL_MAP`-style mapping is no longer needed for proxy rotation.

In `buildCrawlConfig`, remove the two lines that populate `proxyRotation` and `proxyUrls`. Delete `PROXY_ROTATION_MAP` from the file — nothing else uses it after this change.

`resolveCliOnly` in `cliProgram.ts` already builds `proxyUrls` from `opts.proxyUrls`. Extend it to also surface `proxyRotation` so the CLI program can read both from one place. In `cliProgram.ts`'s `resolveCliOnly` return:

```ts
return {
  urls,
  outputDir: opts.outputDir ?? './output',
  save,
  proxyUrls,
  proxyRotation: input.proxyRotation,
};
```

Then the build-up site reads `cliOnly.proxyRotation` instead of `parsed.data.proxyRotation`. (Either works; using `cliOnly` keeps the symmetry with `proxyUrls`.)

### `apps/apify-actor/src/run.ts`

Forward `input.proxyRotation` through `buildCrawlerOpts`. Update the call:

```ts
const crawler = createContextractorCrawler(
  buildCrawlerOpts(input, sink, proxyConfig, requestQueue, input.proxyRotation),
);
```

### `apps/apify-actor/src/config.ts`

Add a fifth optional parameter to `buildCrawlerOpts` and pass it through. Update the signature:

```ts
export function buildCrawlerOpts(
  input: ContextractorInputType,
  sink: Sink<ExtractionResult>,
  proxyConfiguration?: ProxyConfiguration,
  requestQueue?: RequestProvider,
  proxyRotation?: ContextractorInputType['proxyRotation'],
): ContextractorCrawlerOptions {
```

In the return object, add `proxyRotation` next to `proxyConfiguration`:

```ts
proxyConfiguration,
proxyRotation,
requestQueue,
```

## Behaviour parity matrix

After implementation, both surfaces behave identically per strategy:

| Strategy | Effect |
|---|---|
| `RECOMMENDED` | Default sticky-IP-per-session; sessions retire after 50 requests, rotating to the next proxy URL via Crawlee's round-robin. |
| `PER_REQUEST` | `sessionOptions.maxUsageCount: 1`; session retires after every request, new browser context per request, next proxy URL each time. |
| `UNTIL_FAILURE` | `sessionPoolOptions.maxPoolSize: 1` plus `maxUsageCount: 1000`; all requests share one session pinned to one proxy URL until the session retires from errors, then the next URL takes over. |

The only observable difference between Actor and CLI runs is the source of `proxyUrls` — Apify Proxy on the Actor side, the user's list on the CLI side.

## After Implementation

Build, lint, and run tests:

```bash
pnpm build && pnpm lint && pnpm test
```

Smoke-test against a local Squid proxy:

```bash
docker run -d --name squid -p 3128:3128 sameersbn/squid:3.5.27-2
node apps/standalone/dist/cli.js https://httpbin.org/ip \
  --proxy-urls=http://localhost:3128 -o ./out
docker exec squid tail -n 5 /var/log/squid/access.log
```

The Squid access log should show the request to `httpbin.org`, and the JSON response saved to `./out` should show Squid's egress IP rather than the host's direct IP.

For rotation, run two Squids on different ports and verify behaviour per strategy:

```bash
docker run -d --name squid2 -p 3129:3128 sameersbn/squid:3.5.27-2
# PER_REQUEST should split roughly evenly between the two access logs
node apps/standalone/dist/cli.js \
  https://httpbin.org/ip https://httpbin.org/ip https://httpbin.org/ip https://httpbin.org/ip \
  --proxy-urls=http://localhost:3128,http://localhost:3129 \
  --proxy-rotation=PER_REQUEST -o ./out-per-req
# UNTIL_FAILURE should send all four requests through the first Squid
node apps/standalone/dist/cli.js \
  https://httpbin.org/ip https://httpbin.org/ip https://httpbin.org/ip https://httpbin.org/ip \
  --proxy-urls=http://localhost:3128,http://localhost:3129 \
  --proxy-rotation=UNTIL_FAILURE -o ./out-until-fail
```

Error-message smoke tests:

```bash
node apps/standalone/dist/cli.js https://example.com --proxy-urls=not-a-url
# expect: '--proxy-urls: malformed URL "not-a-url". Expected http://user:pass@host:port…'

node apps/standalone/dist/cli.js https://example.com --proxy-urls=ftp://example.com:21
# expect: '--proxy-urls: unsupported scheme "ftp:" in "ftp://example.com:21"…'

node apps/standalone/dist/cli.js https://example.com --proxy-rotation=PER_REQUEST
# expect: 'Warning: --proxy-rotation=PER_REQUEST has no effect without --proxy-urls;…'
```

## Out of Scope

- Apify Proxy from the standalone CLI. Power users use the library API or run the Actor build under `apify run`.
- Per-request `userData.proxyUrl` overrides. No request-level override system exists in contextractor today.
- `tieredProxyUrls` / proxy chaining. Library consumers can construct `ProxyConfiguration` with `tieredProxyUrls` directly.
- `newUrlFunction`-based PER_REQUEST. Matching Apify's `maxUsageCount: 1` approach keeps cookie persistence and block-detection working; do not bypass the session pool.
- Touching the audit's Issue 1 (`waitUntil`) or Issue 3 (html output in Actor) — separate prompts.
