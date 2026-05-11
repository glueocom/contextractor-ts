# Recommended Workflow for Consuming Crawlee Scraped Data

## TL;DR

Use `Dataset.open()` / `Dataset.getData()` (or the static `Dataset.*` shortcuts) as the default consumption path. Reading dataset JSON files directly is also legitimate for downstream pipelines on the same machine — the dataset format is stable. Key-value store records and request queue contents should always go through the API.

## Core pattern

- Push items during the crawl with `await Dataset.pushData(item)` from inside the request handler.
- Consume them with `await Dataset.getData()`, `dataset.forEach()`, `dataset.map()`, `dataset.reduce()`, or the static `Dataset.*` helpers.
- The same code runs unchanged on the Apify platform — `Dataset.getData()` calls the Apify API there instead of reading files.

```ts
import { PlaywrightCrawler, Dataset } from 'crawlee';

const crawler = new PlaywrightCrawler({
  async requestHandler({ page, request }) {
    await Dataset.pushData({
      url: request.loadedUrl,
      title: await page.title(),
    });
  },
});

await crawler.run(['https://crawlee.dev']);

const { items } = await Dataset.getData();
```

## When direct file reading is fine vs. when to use the API

| Storage type | Direct file reading | Reason |
| --- | --- | --- |
| **Dataset items** — same machine, outside the crawler process | **Fine.** | Stable format for years: one JSON per file, zero-padded numeric name under `storage/datasets/<name>/`. Common downstream practice with `jq`, Python, etc. |
| **Dataset items** — same process, or code that may run on Apify cloud | Use `Dataset.getData()`. | Portability and the in-memory shadow live in the same process. |
| **Key-value store records** | Use `KeyValueStore.getValue()`. | MIME-to-extension mapping and metadata sidecars are Crawlee's business. |
| **Request queue contents** | Use `RequestQueue` methods. | On-disk format has shifted between versions and the V2 rework. Fragile. |
| **`INPUT.json` from a shell script** | Fine. | Conventional location, used this way in CI and debug scripts. |
| **`INPUT.json` from code** | Use `KeyValueStore.getInput()` / `Actor.getInput()`. | Same code works locally and on the platform. |

The point of preferring the API is **portability and decoupling from a specific backend** (`@crawlee/memory-storage` today, something else tomorrow), not that reading dataset JSON is dangerous. If the deployment is one machine and there is no plan to push to Apify cloud, reading `datasets/<name>/*.json` yourself is a legitimate choice — especially for downstream tools written in other languages.

The performance angle cuts both ways: `Dataset.getData({ limit: 1_000_000 })` also has to read all those files into memory. The in-memory shadow only helps within the same process that wrote them; a separate consumer script reads from disk either way.

## Single output file

`exportTo*` writes the whole dataset as a single record into the default key-value store. Useful when downstream consumers expect a single file.

```ts
await Dataset.exportToJSON('OUTPUT');   // → ./storage/key_value_stores/default/OUTPUT.json
await Dataset.exportToCSV('OUTPUT');    // → OUTPUT.csv
```

## Streaming-style consumption

Process items one at a time without holding them all in memory.

```ts
const dataset = await Dataset.open();
await dataset.forEach(async (item) => {
  // process item
});
```

## Consuming from a separate script later

Default datasets are wiped on every fresh run — the most common gotcha. Use a **named** dataset to survive the automatic purge.

```ts
// crawler.ts
const ds = await Dataset.open('products');
await ds.pushData(item);
```

```ts
// consume.ts (run separately, later)
import { Configuration, Dataset } from 'crawlee';
Configuration.getGlobalConfig().set('purgeOnStart', false);

const ds = await Dataset.open('products');
const { items } = await ds.getData();
```

## Map / reduce for transformation

```ts
const ds = await Dataset.open();
const titles = await ds.map((item) => item.title);
const totalLinks = await ds.reduce((acc, item) => acc + (item.links?.length ?? 0), 0);
```

## Legitimate exceptions

- **No persistence needed.** For a short script, push to your own array from the request handler and skip `Dataset` entirely. Trade-off: no resumability, no Apify-platform portability.
  ```ts
  const results: any[] = [];
  const crawler = new PlaywrightCrawler({
    async requestHandler({ page, request }) {
      results.push({ url: request.loadedUrl, title: await page.title() });
    },
  });
  await crawler.run([...]);
  ```
- **Live monitoring from another process.** Mount a small HTTP server (Fastify/Express/Hono) inside the crawler process and have it call `Dataset.open().getData(...)`. Crawlee ships no built-in web server. Sketch in `05-crawlee-js-programmatic-access.md` §7.
- **Streaming to an external sink** (Postgres, S3, Kafka, etc.). Write to the sink from the request handler directly. Optionally also push to a `Dataset` as buffer / audit trail.
- **Cross-language downstream pipeline** (Python, Go, shell). Reading `storage/datasets/<name>/*.json` from the other language is fine; this is exactly what the stable on-disk format is good for.

## Decision matrix

| Situation | Use |
| --- | --- |
| Default consumption path inside Node | `Dataset.pushData` then `Dataset.getData()` |
| Need a single output file (JSON/CSV) | `Dataset.exportToJSON('OUTPUT')` or `exportToCSV` |
| Process items one at a time | `dataset.forEach()` |
| Consuming in a separate script later | **Named** dataset + `purgeOnStart: false` |
| Cross-language downstream (Python, shell, etc.) | Read `storage/datasets/<name>/*.json` directly — stable format |
| Quick `jq` / `cat` inspection during dev | Manual file reads |
| Short script, no persistence wanted | Push to your own array, skip `Dataset` |
| External sink (DB, S3, queue) | Write from the request handler, optionally also push to a `Dataset` |
| Live dashboard / cross-process access | HTTP server inside the crawler process, calling `Dataset.*` underneath |
| Reading `INPUT` / KVS records / queue from code | Always go through `KeyValueStore` / `RequestQueue` — those formats aren't stable contracts |

## Bottom line

`Dataset.open()` and `Dataset.getData()` are the recommended consumption path within Node, and the only sensible choice if the code may also run on the Apify platform. For purely local downstream pipelines — especially in other languages — reading dataset JSON files directly is a legitimate, common practice; the dataset on-disk format is stable. Key-value store records and request queue contents are different: always use the API, because their on-disk representations aren't a public contract.
