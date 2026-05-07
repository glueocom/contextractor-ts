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
import { createContextractorCrawler, buildRequests } from '@contextractor/crawler';

for (const waitUntil of ['load', 'domcontentloaded', 'networkidle']) {
  const results = [];
  const sink = async (r) => results.push(r.url);
  const crawler = createContextractorCrawler({ startUrls: ['https://example.com'], sink, waitUntil });
  await crawler.run(buildRequests(['https://example.com']));
  console.log(`waitUntil=${waitUntil}: extracted ${results.length} page(s) — OK`);
}
```

```bash
node test-wait-until.mjs
```

Expected: three lines each ending in `1 page(s) — OK`. If any line is missing or shows `0 page(s)`, the `waitUntil` hook is not wiring correctly — re-read `createCrawler.ts`, fix the `preNavigationHooks` build logic, rebuild, and retry.

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
import { createContextractorCrawler, buildRequests } from '@contextractor/crawler';

const htmlResults = [];
const sink = async (r) => htmlResults.push(r.formats.html ?? '');
const crawler = createContextractorCrawler({ startUrls: ['https://example.com'], sink, formats: ['html'] });
await crawler.run(buildRequests(['https://example.com']));
console.assert(htmlResults[0]?.includes('<'), 'html format must contain HTML tags');
console.log(`html lib test: extracted ${htmlResults[0]?.length ?? 0} chars — OK`);
```

```bash
node test-html.mjs
```

If the assertion fires (output contains no `<` tags), the extraction engine is not returning html format — check `formats` is passed to `createHandler` in `createCrawler.ts`, fix, rebuild, retry.

### Apify platform test

Confirm `apps/apify-actor/.actor/actor.json` has `"name": "contextractor-test"` before pushing.

Defer this test to the report as a manual step if the Actor has not been deployed yet. Record the exact `apify push` and `apify call` commands needed so the user can run them after deployment:

```bash
# From apps/apify-actor/
apify push

apify call glueo/contextractor-test --input '{
  "startUrls": [{"url": "https://blog.apify.com/what-is-web-scraping/"}],
  "saveExtractedHtmlToKeyValueStore": true,
  "saveExtractedMarkdownToKeyValueStore": false
}'
```

Expected: dataset item has `extractedHtml` with `hash`, `length`, `key`, and `url` fields; KVS content type is `text/html; charset=utf-8`.

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
- waitUntil: CLI result, lib result
- Proxy: CLI result, rotation result (PER_REQUEST, UNTIL_FAILURE), error-message result; or "skipped — Docker unavailable"
- HTML: CLI result, lib result, platform test (deferred/pass)
- All code fixes applied (file path, what changed, why)
- Deferred items with exact commands to run manually
