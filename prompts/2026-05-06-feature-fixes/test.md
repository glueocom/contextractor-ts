# Test: waitUntil, proxy support, and html output

Autonomous end-to-end verification for the three features implemented by `wait-until-wire.md`, `proxy.md`, and `html-output-actor.md`. Run each step in sequence. When a step fails, diagnose the root cause, fix the implementation, and retry before moving on. Save a report at the end.

All commands run from the repo root.

---

## Step BUILD: Verify clean build

```bash
pnpm build && pnpm lint && pnpm test
```

If this fails:
- `pnpm build` errors → read each TypeScript error, fix the implementation file, retry.
- `pnpm lint` errors → run `pnpm biome check --write .` to auto-apply safe fixes, then fix remaining issues manually, retry.
- `pnpm test` failures → read each failing test, fix the implementation or test, retry. Do NOT skip failing tests.

Do not proceed to later steps until the build is clean.

---

## Step WAIT-UNTIL: Verify waitUntil wiring

### CLI smoke test

```bash
node apps/standalone/dist/cli.js --wait-until domcontentloaded https://example.com -o ./out-dcl
node apps/standalone/dist/cli.js --wait-until load            https://example.com -o ./out-load
node apps/standalone/dist/cli.js --wait-until networkidle     https://example.com -o ./out-ni
```

All three must produce output files. If a run errors or produces no output, read the console output, identify the bug, fix `packages/crawler/src/createCrawler.ts` or the relevant app file, run `pnpm build`, and retry.

### Lib API smoke test

Write `test-wait-until.mjs` and run it:

```js
import { createContextractorCrawler } from './packages/crawler/dist/index.js';
import { Request } from 'crawlee';

for (const waitUntil of ['load', 'domcontentloaded', 'networkidle']) {
  const results = [];
  const sink = async (r) => results.push(r.url);
  const crawler = createContextractorCrawler({ startUrls: ['https://example.com'], sink, waitUntil });
  const req = new Request({ url: 'https://example.com', uniqueKey: `${waitUntil}-example` });
  await crawler.run([req]);
  console.log(`waitUntil=${waitUntil}: extracted ${results.length} page(s) — OK`);
}
```

```bash
node test-wait-until.mjs
```

Expected: three lines each ending in `1 page(s) — OK`. If any line is missing or shows `0 page(s)`, the `waitUntil` hook is not wiring correctly — re-read `createCrawler.ts`, fix the `preNavigationHooks` build logic, rebuild, and retry.

Note: each `Request` uses a `uniqueKey` to prevent Crawlee's in-process URL deduplication from skipping the second and third runs.

---

## Step PROXY: Verify proxy wiring

### Docker availability check

```bash
docker info 2>&1 | head -3
```

If Docker is not running, skip the Docker-dependent proxy tests (Steps PROXY-CLI and PROXY-ROTATION) and record them as deferred in the report. Continue with PROXY-ERRORS.

### PROXY-CLI: Start Squid containers and run basic proxy test

```bash
docker stop squid squid2 2>/dev/null; docker rm squid squid2 2>/dev/null; true
docker run -d --name squid  -p 3128:3128 sameersbn/squid:3.5.27-2
docker run -d --name squid2 -p 3129:3128 sameersbn/squid:3.5.27-2
sleep 3
node apps/standalone/dist/cli.js https://httpbin.org/ip \
  --proxy-urls=http://localhost:3128 -o ./out-proxy
docker exec squid tail -n 5 /var/log/squid/access.log
```

The Squid access log must contain a `httpbin.org` entry. If the CLI exits with an error, read the error message, fix the relevant file (`cliProgram.ts` or `createCrawler.ts`), rebuild, and retry.

### PROXY-ROTATION: Verify rotation strategies

```bash
docker restart squid squid2 && sleep 3
node apps/standalone/dist/cli.js \
  https://httpbin.org/ip https://httpbin.org/ip https://httpbin.org/ip https://httpbin.org/ip \
  --proxy-urls=http://localhost:3128,http://localhost:3129 \
  --proxy-rotation=PER_REQUEST -o ./out-per-req
docker exec squid  wc -l /var/log/squid/access.log
docker exec squid2 wc -l /var/log/squid/access.log
```

PER_REQUEST: both Squids should show roughly equal counts (~2 each). If squid2 shows 0, the session pool rotation override is not wiring — fix `createCrawler.ts` `sessionPoolOptions` logic, rebuild, retry.

```bash
docker restart squid squid2 && sleep 3
node apps/standalone/dist/cli.js \
  https://httpbin.org/ip https://httpbin.org/ip https://httpbin.org/ip https://httpbin.org/ip \
  --proxy-urls=http://localhost:3128,http://localhost:3129 \
  --proxy-rotation=UNTIL_FAILURE -o ./out-until-fail
docker exec squid  wc -l /var/log/squid/access.log
docker exec squid2 wc -l /var/log/squid/access.log
```

UNTIL_FAILURE: squid must show ~4 requests; squid2 must show 0. If squid2 shows requests, the `maxPoolSize: 1` override is missing — fix and retry.

### PROXY-ERRORS: Verify error messages

```bash
node apps/standalone/dist/cli.js https://example.com --proxy-urls=not-a-url 2>&1; true
node apps/standalone/dist/cli.js https://example.com --proxy-urls=ftp://example.com:21 2>&1; true
node apps/standalone/dist/cli.js https://example.com --proxy-rotation=PER_REQUEST 2>&1; true
```

Expected output lines:
- `--proxy-urls: malformed URL "not-a-url"…`
- `--proxy-urls: unsupported scheme "ftp:"…`
- `Warning: --proxy-rotation=PER_REQUEST has no effect without --proxy-urls…`

If any expected message is absent, fix the validation block in `apps/standalone/src/cliProgram.ts`, rebuild, and retry.

---

## Step HTML: Verify html output wiring

### CLI test

```bash
node apps/standalone/dist/cli.js https://example.com --save html -o ./out-html
ls -lh ./out-html/
```

Expect one `.html` file with extracted HTML content. If no file appears, check that `formats: ['html']` is being passed through — the standalone already handled `--save html` before this change, so a failure here likely indicates a build issue.

### Lib API smoke test

Write `test-html.mjs` and run it:

```js
import { createContextractorCrawler } from './packages/crawler/dist/index.js';
import { Request } from 'crawlee';

const htmlResults = [];
const sink = async (r) => htmlResults.push(r.formats.html ?? '');
const crawler = createContextractorCrawler({ startUrls: ['https://example.com'], sink, formats: ['html'] });
const req = new Request({ url: 'https://example.com', uniqueKey: 'html-example' });
await crawler.run([req]);
console.assert(htmlResults[0]?.includes('<'), 'html format must contain HTML tags');
console.log(`html lib test: extracted ${htmlResults[0]?.length ?? 0} chars — OK`);
```

```bash
node test-html.mjs
```

If the assertion fires (output contains no `<` tags), the extraction engine is not returning html format — check `formats` is passed to `createHandler` in `createCrawler.ts`, fix, rebuild, retry.

Platform verification is covered in Step PLATFORM below.

---

## Step PLATFORM: Apify platform verification

Run this step after all local tests pass. Deploys to `glueo/contextractor-test` and verifies all three features on the real platform.

### Pre-flight

Confirm `apps/apify-actor/.actor/actor.json` has `"name": "contextractor-test"` before pushing. Never push to `contextractor` (production).

### Deploy

Follow the deploy-and-test workflow from `.claude/commands/platform/deploy-and-test.md`:

```bash
# Push current branch to dev to trigger a Git-connected build
git push origin HEAD:dev
```

Poll every 15 s until the build is `SUCCEEDED`:

```bash
apify builds ls glueo/contextractor-test --limit 3
```

If build fails, fetch the log (`apify builds log <BUILD_ID>`), fix the error, rebuild locally, and push again.

### PLATFORM-WAITUUNTIL: Verify waitUntil on platform

```bash
mcpc --json @apify tools-call call-actor \
  actor:="glueo/contextractor-test" \
  input:='{"startUrls":[{"url":"https://en.wikipedia.org/wiki/Web_scraping"}],"waitUntil":"NETWORKIDLE","maxPagesPerCrawl":1}'
```

Expected: run status `SUCCEEDED`, dataset item contains `extractedMarkdown` (or `extractedText` etc.) with `length > 0`. A clean run confirms `waitUntil` is accepted and does not break navigation.

### PLATFORM-HTML: Verify html output on platform

```bash
mcpc --json @apify tools-call call-actor \
  actor:="glueo/contextractor-test" \
  input:='{"startUrls":[{"url":"https://blog.apify.com/what-is-web-scraping/"}],"saveExtractedHtmlToKeyValueStore":true,"saveExtractedMarkdownToKeyValueStore":false}'
```

Expected:
- Run status `SUCCEEDED`
- Dataset item has `extractedHtml.hash`, `extractedHtml.length`, `extractedHtml.key`, `extractedHtml.url`
- KVS record at `extractedHtml.key` has content type `text/html; charset=utf-8`

If `extractedHtml` is absent or missing fields, check `FORMAT_SPECS` in `apps/apify-actor/src/sinks.ts`, the `formats.push('html')` branch in `apps/apify-actor/src/config.ts`, and that the schema field `saveExtractedHtmlToKeyValueStore` is present in `apps/apify-actor/.actor/input_schema.json`.

### PLATFORM-PROXY: Verify proxyRotation on platform

```bash
mcpc --json @apify tools-call call-actor \
  actor:="glueo/contextractor-test" \
  input:='{"startUrls":[{"url":"https://en.wikipedia.org/wiki/Web_scraping"}],"proxyRotation":"PER_REQUEST","maxPagesPerCrawl":1}'
```

Expected: run status `SUCCEEDED`. A clean run confirms `proxyRotation` is accepted and passed through without error (the platform uses Apify Proxy by default; rotation strategy is applied to that proxy pool).

### Inspect results

After each call, inspect the run and dataset:

```bash
apify runs ls glueo/contextractor-test --limit 3
```

Record the run IDs and dataset IDs in the Step REPORT.

---

## Step CLEANUP: Remove test artifacts

```bash
docker stop squid squid2 2>/dev/null; docker rm squid squid2 2>/dev/null; true
rm -rf ./out-dcl ./out-load ./out-ni ./out-proxy ./out-per-req ./out-until-fail ./out-html
rm -f test-wait-until.mjs test-html.mjs
```

---

## Step REPORT: Save report

Save `autonomous-task-output/claude/reports/feature-fixes-test-report.md` with:
- Date/time
- Build result (pass/fail)
- waitUntil: CLI result, lib result, platform result (run ID, status)
- Proxy: CLI result, rotation result (PER_REQUEST, UNTIL_FAILURE), error-message result; or "skipped — Docker unavailable"; platform proxyRotation result
- HTML: CLI result, lib result, platform result (run ID, extractedHtml fields verified)
- All code fixes applied (file path, what changed, why)
- Deferred items with exact commands to run manually
