# Programmatic Access to Crawlee (JS/TS) Local Storage

**Short answer (yes/no up front):**

- **In‑process JS/TS API:** Yes — full and well‑documented. `Dataset`, `KeyValueStore`, and `RequestQueue` give you everything you need to read and write local storage from inside the crawler.
- **Lower‑level `StorageClient` interface:** Yes — exists, is exported via `@crawlee/types`, and is implemented by `@crawlee/memory-storage` (the default local backend). It is publicly documented but described as the "extension point" rather than the everyday API.
- **Built‑in HTTP/REST API for local storage:** **No.** Crawlee does not ship a local HTTP server. The Apify REST API at `api.apify.com` only fronts cloud storage. The Apify CLI does not start a local API server either. If you want HTTP, you build it yourself (or use a third‑party project like Crawlee Cloud).
- **Cross‑process / cross‑language access:** Possible, with caveats — `@crawlee/memory-storage` is the default and it keeps the source of truth **in memory** while writing files eagerly per operation. External readers see the on‑disk JSON, but external **writers** during a live run will desync the in‑memory copy. `@apify/storage-local` (SQLite) is more concurrency‑friendly for readers but is no longer the default.
- **Reading a previous run's storage from a standalone script:** Yes, idiomatic — `await Dataset.open()` from a small Node script will spin up `MemoryStorage` pointed at `./storage` and read the existing JSON files just fine.
- **`Actor.*` helpers from `apify` SDK:** These are the everyday "API". Locally they delegate to the same `MemoryStorage`; on the platform they delegate to the Apify cloud API.

The rest of this document fills in the substantive details.

---

## 1. The in‑process JavaScript/TypeScript API

This is the primary surface and the only one Crawlee officially calls an "API". Everything is async and lives in the `crawlee` package (re‑exported from `@crawlee/core`).

### 1.1 `Dataset`

```ts
import { Dataset } from 'crawlee';

const ds = await Dataset.open();              // default dataset
const named = await Dataset.open('products'); // named dataset
```

Instance methods (the most useful ones):

| Method | Purpose |
| --- | --- |
| `pushData(item \| item[])` | Append one or many objects. Items must be JSON‑serializable, each ≤ 9 MB. |
| `getData(options?)` | Returns a `DatasetContent` (`{ items, total, offset, limit, count, desc }`). Supports `offset`, `limit`, `desc`, `clean`, `fields`, `omit`, `unwind`, `skipEmpty`, `skipHidden`. Pagination is delegated to the underlying client's `listItems()`. |
| `getInfo()` | Returns metadata (id, name, itemCount, timestamps). The shape mirrors the Apify cloud `Get dataset` endpoint. |
| `forEach(iteratee, options?, index?)` | Iterates items page‑by‑page. |
| `map(iteratee, options?)` | Map → returns a new array (awaits async iteratee). |
| `reduce(iteratee, memo, options?)` | Standard reduce. |
| `exportTo(key, options?, contentType?)` | Writes the whole dataset as a single record into a key‑value store. `contentType` is `'json'` or `'csv'`. `options.toKVS` selects the target KVS. Returns the items it wrote. |
| `exportToJSON(key, options?)` / `exportToCSV(key, options?)` | Convenience wrappers around `exportTo`. |
| `drop()` | Deletes the dataset (in local mode, removes the directory). |

Static convenience methods (operate on the **default** dataset):

```ts
await Dataset.pushData({ url, title });
await Dataset.exportToJSON('OUTPUT');
await Dataset.exportToCSV('OUTPUT', { toKVS: 'my-data' });
```

The static `Dataset.open(idOrName?)` is what you normally call; **do not** use the constructor directly.

### 1.2 `KeyValueStore`

```ts
import { KeyValueStore } from 'crawlee';

const kvs = await KeyValueStore.open();
await kvs.setValue('OUTPUT', { foo: 'bar' });
const value = await kvs.getValue<MyType>('OUTPUT');
```

Instance methods:

| Method | Purpose |
| --- | --- |
| `getValue<T>(key)` | Reads the record. Resolves to an object/string/Buffer depending on stored MIME type, or `null` if missing. |
| `setValue(key, value, options?)` | Writes the record. Pass `value = null` to delete. `options.contentType` controls MIME (defaults to `application/json; charset=utf-8` for objects). |
| `recordExists(key)` | True/false without reading the value. |
| `getAutoSavedValue<T>(key, defaultValue?)` | Returns a proxied object that is automatically persisted on `PERSIST_STATE` events — handy for crawler state. |
| `forEachKey(iteratee, options?)` | Iterates keys (callback signature). |
| `keys(options?)` | Async generator yielding keys (`for await (const key of kvs.keys())`). |
| `iterate(...)` / `entries(...)` | Iterate `[key, value]` pairs. KVS itself is an `AsyncIterable<[string, T]>`. |
| `getPublicUrl(key)` | Cloud only; on local it returns a URL pointing at `api.apify.com`, which is **not useful for purely local data**. |
| `drop()` | Deletes the entire store. |

Static convenience methods:

```ts
const input  = await KeyValueStore.getInput();             // reads INPUT from default KVS
const value  = await KeyValueStore.getValue('STATE');
await       KeyValueStore.setValue('STATE', { page: 5 });
const exists = await KeyValueStore.recordExists('STATE');
```

By convention, the default KVS holds the run's `INPUT` and `OUTPUT`. The Apify SDK's `Actor.getInput()` is just `KeyValueStore.getInput()` under the hood.

### 1.3 `RequestQueue`

```ts
import { RequestQueue } from 'crawlee';

const rq = await RequestQueue.open();        // default
const named = await RequestQueue.open('crawl-1');
```

Instance methods:

| Method | Purpose |
| --- | --- |
| `addRequest(req, options?)` | Adds one request. `options.forefront` puts it at the head. Returns `QueueOperationInfo` (`{ requestId, wasAlreadyPresent, wasAlreadyHandled }`). |
| `addRequests(reqs, options?)` | Batched add. There's also `addRequestsBatched(...)` on the crawler/context for very large lists. |
| `fetchNextRequest()` | Dequeues the next pending request, or `null` if none currently. |
| `getRequest(id)` | Looks up a request by ID. |
| `markRequestHandled(req)` | Mark as done. |
| `reclaimRequest(req, options?)` | Push it back to be retried; `options.forefront` to the head. |
| `isEmpty()` | True if no pending; doesn't mean finished (in‑flight may still be processing). |
| `isFinished()` | True if all requests have been handled. |
| `getInfo()` | Returns `{ id, name, totalRequestCount, handledRequestCount, pendingRequestCount, ... }` — same shape as the Apify cloud `Get request queue` endpoint. |
| `getTotalCount()` / `getHandledCount()` / `getPendingCount()` | Offline approximations that survive restarts. |
| `drop()` | Deletes the queue. |

Note: there are two implementations evolving in parallel — the classic `RequestQueue` and `RequestQueueV2` (referenced from `@crawlee/core`). For local use both work the same way through the API above.

### 1.4 Working on data from a previous run

`Dataset.open()`, `KeyValueStore.open()`, `RequestQueue.open()` **work on existing on‑disk data with no extra configuration**. When Crawlee initializes, `MemoryStorage` is constructed with `localDataDirectory = process.env.CRAWLEE_STORAGE_DIR ?? './storage'` and lazily reads existing folders on first access.

There are two important behavioral details:

1. **Default storages get purged on startup.** `purgeDefaultStorages()` is called automatically the first time you open any storage in a process (this is what wipes `./storage/datasets/default` etc. between runs). To inspect a previous run, either:
   - open by **name** (`Dataset.open('previous-run')`) — named storages are not purged, or
   - set `CRAWLEE_PURGE_ON_START=0`, or
   - in code, pass `Configuration` with `purgeOnStart: false`, or
   - point `CRAWLEE_STORAGE_DIR` at a copy of the directory you want to inspect.

2. **Reading is lazy.** The first call to `getValue`, `getData`, etc. loads files from disk into the in‑memory shadow.

A standalone "inspect a previous crawl" script is a one‑liner:

```ts
// inspect.ts
import { Configuration, Dataset } from 'crawlee';
process.env.CRAWLEE_STORAGE_DIR = './storage';
Configuration.getGlobalConfig().set('purgeOnStart', false);

const ds = await Dataset.open('products'); // a named dataset
console.log(await ds.getInfo());
const { items } = await ds.getData({ limit: 50 });
console.dir(items, { depth: null });
```

---

## 2. The lower‑level `StorageClient` interface

Crawlee abstracts storage behind a `StorageClient` so you can swap backends (memory + filesystem, SQLite, Apify cloud, custom). This is documented (`@crawlee/types`, `@crawlee/core`, `@crawlee/memory-storage`) but described as the extension point — not the recommended day‑to‑day API.

### 2.1 Getting the active client

```ts
import { Configuration } from 'crawlee';

const client = Configuration.getGlobalConfig().getStorageClient();
// In a default local run this is a MemoryStorage instance.
```

You can also override it for the whole process:

```ts
import { MemoryStorage } from '@crawlee/memory-storage';
Configuration.getGlobalConfig().useStorageClient(
    new MemoryStorage({ localDataDirectory: './storage', persistStorage: true }),
);
```

### 2.2 The `StorageClient` shape (from `@crawlee/types`)

```ts
interface StorageClient {
    datasets():        DatasetCollectionClient;
    dataset(id:string):DatasetClient<Dictionary>;
    keyValueStores():  KeyValueStoreCollectionClient;
    keyValueStore(id:string): KeyValueStoreClient;
    requestQueues():   RequestQueueCollectionClient;
    requestQueue(id:string, options?: RequestQueueOptions): RequestQueueClient;

    purge?():           Promise<void>;
    teardown?():        Promise<void>;
    setStatusMessage?(msg:string, opts?:SetStatusMessageOptions): Promise<void>;
    stats?: { rateLimitErrors: number[] };
}
```

### 2.3 Resource clients

These mirror the Apify REST API, so the method names will look familiar if you've used `apify-client`. The exact signatures come from `packages/types/src/storages.ts` in the repo. The key ones you'd actually call:

**`DatasetClient`**
- `get()` → metadata
- `update(newFields)` → rename, etc.
- `delete()`
- `listItems(options?)` → `PaginatedList<Item>` (this is what `Dataset.getData()` calls)
- `pushItems(items)` → append
- `downloadItems(format, options?)` → returns a Buffer in JSON/CSV/etc.

**`KeyValueStoreClient`**
- `get()` / `update(...)` / `delete()`
- `listKeys({ exclusiveStartKey?, limit? })` → `{ items, count, isTruncated, nextExclusiveStartKey }`
- `getRecord(key, opts?)` → `{ key, value, contentType }` or `undefined`
- `setRecord({ key, value, contentType? })`
- `deleteRecord(key)`
- `recordExists(key)`

**`RequestQueueClient`**
- `get()` / `update(...)` / `delete()`
- `listHead({ limit? })` → next pending requests without locking them
- `addRequest(request, { forefront? })`
- `batchAddRequests(requests, { forefront? })`
- `getRequest(id)`
- `updateRequest(request)`
- `deleteRequest(id)`
- `prolongRequestLock(id, { lockSecs, forefront? })` / `deleteRequestLock(id)`
- `listAndLockHead({ limit, lockSecs })` (used by RequestQueueV2)

### 2.4 Going straight to `MemoryStorage`

This is the most useful trick for "I just want to read everything in `./storage` from a script":

```ts
import { MemoryStorage } from '@crawlee/memory-storage';

const ms = new MemoryStorage({
    localDataDirectory: './storage',
    persistStorage: false,   // we're a reader; don't write anything back
});

// Datasets
const ds = ms.dataset('default');
const page = await ds.listItems({ offset: 0, limit: 100 });
console.log(page.items, page.total);

// Key-value store
const kv = ms.keyValueStore('default');
const keys = await kv.listKeys({ limit: 100 });
const input = await kv.getRecord('INPUT');

// Request queue
const rq = ms.requestQueue('default');
const head = await rq.listHead({ limit: 50 });
```

`MemoryStorage` reads existing folders lazily on first access for each id. Setting `persistStorage: false` (or `CRAWLEE_PERSIST_STORAGE=false`) prevents the inspector from writing anything back. For pure read‑only operations it doesn't matter much — you're not pushing data — but it's safer when running concurrently with a crawler.

### 2.5 Public vs internal

The interfaces are **public**: `StorageClient`, `DatasetClient`, `KeyValueStoreClient`, `RequestQueueClient` are all exported types in `@crawlee/types` and reachable through `crawlee.dev/js/api/types/...`. However, the docs explicitly route users to the high‑level `Dataset` / `KeyValueStore` / `RequestQueue` classes; the resource‑client methods are documented mostly as the contract you implement when you build a custom backend (e.g. for Postgres, Redis, S3). Treat them as a stable extension API, but be aware that some method names changed during the V2 RequestQueue work.

---

## 3. HTTP / REST API access — is there one?

**Locally: no.** This is the single most important point. Crawlee for JS:

- does **not** start an HTTP server,
- does **not** expose any port,
- has **no** "local Apify API" mode,
- and the Apify CLI (`apify run`) does not start a local API server either — it just runs your script as a Node process with environment variables (`APIFY_LOCAL_STORAGE_DIR`, etc.) set, and the CLI itself shells out to your `npm start`.

**The Apify CLI's `apify` storage commands target the cloud, not your `./storage` folder.** The `apify datasets`, `apify key-value-stores`, and `apify request-queues` namespaces in the CLI reference call the Apify REST API and require an API token; they will list the datasets in your Apify account, not the folders under `./storage/datasets`. Don't be fooled by the names.

There is, however, a related set of CLI commands intended to be called **from inside a running Actor process** (so they execute against whatever storage client is active — which, locally, means your filesystem):

```
apify actor get-input
apify actor get-value <key>
apify actor set-value <key> [value]
apify actor push-data '<json>'
apify actor get-public-url <key>
```

These are convenient as shell helpers for an Actor that wants to run sub‑processes, but they're not a server — they just operate on the same on‑disk storage your Node process is using.

**On the Apify cloud platform there *is* a full REST API:**

```
GET    https://api.apify.com/v2/datasets/{id}/items
POST   https://api.apify.com/v2/datasets/{id}/items
GET    https://api.apify.com/v2/key-value-stores/{id}/records/{key}
PUT    https://api.apify.com/v2/key-value-stores/{id}/records/{key}
GET    https://api.apify.com/v2/request-queues/{id}/requests/...
```

These endpoints only work for storages hosted on Apify's platform. They have no local equivalent that ships with Crawlee.

**Community projects that fill the gap**

- **Crawlee Cloud** (`github.com/crawlee-cloud/crawlee-cloud`) — a self‑hosted, open‑source re‑implementation of the Apify API server, runner, and dashboard, so you can point the Apify SDK at your own infrastructure and get an HTTP API + UI. It uses Postgres + Redis + S3‑compatible storage rather than Crawlee's `./storage` directory directly, so it's a "deploy this stack instead" answer rather than a "wrap my existing folder" answer. It is third‑party (not Apify‑maintained); evaluate accordingly.
- Various ad‑hoc Express/Fastify wrappers around `Dataset.open()`. There is no widely adopted package for this; everyone rolls their own. See §7 for a sketch.

---

## 4. Cross‑process and cross‑language access

### 4.1 The default backend (`@crawlee/memory-storage`)

`@crawlee/memory-storage` is the default storage client since Crawlee v3. Two things to know:

1. **Source of truth is in memory.** Each running Crawlee process holds an in‑memory copy of every dataset/KVS/RQ it has touched. Disk is a *projection* of that memory.
2. **Writes are eager but not transactional.** Each `pushData`, `setValue`, queue update writes the corresponding JSON file (and metadata file, if `writeMetadata`/`DEBUG=*` is set) shortly after the operation. There is no global file lock and no fsync barrier across files.

Implications:

- **An external reader can tail the on‑disk files while a crawler runs.** This is how every "watch the dataset grow" hack works. Just `fs.readdir('./storage/datasets/default')`, sort numerically, read the new files. You will see eventually consistent data. A Python script doing `glob('./storage/datasets/default/*.json')` is fine.
- **An external *writer* will desync the running crawler.** If a separate process writes a new `000000005.json` while the crawler holds an in‑memory dataset, the crawler will overwrite or ignore it. Don't do this.
- **Two Crawlee processes pointed at the same `CRAWLEE_STORAGE_DIR` will fight.** Each has its own in‑memory copy and they'll clobber each other. Use distinct directories per process.
- **Request queue mutation from outside is especially unsafe** because the running crawler keeps an in‑memory cache of pending/handled state and lock IDs. Treat the RQ as owned by exactly one process.

There are no advisory file locks (`flock`/`O_EXLOCK`) used by `@crawlee/memory-storage`. Concurrency is not designed for; it is "best effort, single owner".

### 4.2 `@apify/storage-local` (legacy SQLite backend)

Before v3, Crawlee's local backend was `@apify/storage-local`, which used SQLite for the request queue and JSON files for datasets and KVS. It is still installable and you can plug it in via `Configuration.useStorageClient(...)`. SQLite gives you:

- **Multiple readers concurrently** with one writer (especially in WAL mode).
- **Safe concurrent writes** through SQLite's locking, at the cost of `SQLITE_BUSY` errors when contention is high.
- The dataset and KVS portions, however, are still flat JSON files with the same caveats as `@crawlee/memory-storage`.

If you specifically need a separate inspector or dashboard process to read the request queue while a crawl is running, `@apify/storage-local` is a more honest substrate than `@crawlee/memory-storage`. It is no longer the default and is not getting new features.

### 4.3 Reading from another language (e.g. Python)

The on‑disk layout is stable and trivially readable:

```
./storage/
    datasets/<name>/<index>.json       # one JSON object per file
    key_value_stores/<name>/<key>.<ext>
    key_value_stores/<name>/<key>.__metadata__.json   # if writeMetadata
    request_queues/<name>/...           # JSON files keyed by request id; an index/queue file for ordering
```

For datasets and KVS, a Python script can simply walk the directory. For the request queue, parsing the on‑disk files is doable but fragile — the schema has shifted between Crawlee versions and the V2 queue rework. If you need request‑queue access from Python, prefer **Crawlee for Python** (`apify/crawlee-python`), which has its own `FileSystemStorageClient` reading the same convention, or run a small Node "broker" exposing the queue over HTTP (see §7).

---

## 5. Reading / manipulating storage from outside the running crawler

The idiomatic path: a small Node script using the same `crawlee` package.

```ts
// scripts/dump-dataset.ts
import { Configuration, Dataset } from 'crawlee';

process.env.CRAWLEE_STORAGE_DIR = './storage';
Configuration.getGlobalConfig().set('purgeOnStart', false);

const ds = await Dataset.open(process.argv[2] ?? null);
console.log(JSON.stringify(await ds.getData({ limit: 1_000_000 }), null, 2));
```

Run with `npx tsx scripts/dump-dataset.ts products`. Internally this just constructs a fresh `MemoryStorage` over the existing directory and reads it.

For ad‑hoc tools you can skip the high‑level wrappers entirely and use `MemoryStorage` directly (§2.4) — it's actually a slightly cleaner path for read‑only inspectors because it doesn't trigger purge logic.

### 5.1 Apify CLI's role

The Apify CLI does not have an `apify storage ls` for local data. The closest things are:

- `apify run` — runs your project (with `npm start`) and sets the right environment variables.
- `apify actor get-value <key>`, `apify actor set-value`, `apify actor push-data`, `apify actor get-input` — runtime helpers usable inside an Actor or from your shell while in an Actor's directory; locally they read/write the local storage. Useful for quick `jq` pipelines, but they call the same in‑process APIs we've been describing.
- `apify datasets get-items`, `apify datasets ls`, `apify key-value-stores get-value`, etc. — **cloud only**, talk to `api.apify.com` with your API token.

### 5.2 Tips for building a debugging UI

If you want a live dashboard of the local storage:

1. **Run the dashboard in the same Node process as the crawler** (recommended). Spin up a small HTTP server (Express/Fastify/Hono) inside your crawler entry point that calls `Dataset.open()`, `KeyValueStore.open()`, `RequestQueue.open()` directly. This avoids every consistency problem.
2. **If you must run it as a separate process**, use it strictly for **read‑only** views of `./storage/datasets/*` and `./storage/key_value_stores/*`. Either:
   - read JSON files from disk yourself, or
   - construct `new MemoryStorage({ localDataDirectory, persistStorage: false })` in the dashboard and never write through it.
   Avoid trying to read the request queue concurrently — if you need that, switch the crawler to `@apify/storage-local` and have the dashboard open a read‑only SQLite connection.
3. **Polling is fine.** `Dataset.getInfo().itemCount` and re‑reading the highest‑numbered file in `datasets/<name>/` are cheap; refresh every 1–2 seconds.
4. **Use named storages.** Default storages are purged on startup. Named ones (`Dataset.open('run-2026-05-07')`) are preserved across runs and easier to introspect later.

---

## 6. The Apify SDK (`apify`) `Actor.*` methods

For most users, this is the everyday "API". The `apify` package wraps Crawlee's storage classes and switches the storage client based on environment:

- **Locally** (no `APIFY_IS_AT_HOME`), `Actor.init()` keeps the default `MemoryStorage`, so calls go to your `./storage` folder.
- **On the Apify platform**, `Actor.init()` swaps in `ApifyStorageClient`, which talks to `api.apify.com`.

The methods that matter:

```ts
import { Actor } from 'apify';
await Actor.init();

// Datasets
const ds = await Actor.openDataset('products');     // named, persistent
await Actor.pushData({ url, title });               // default dataset

// Key-value store
const input = await Actor.getInput<MyInput>();
await Actor.setValue('OUTPUT', { ok: true });
const kvs = await Actor.openKeyValueStore('files');

// Request queue
const rq = await Actor.openRequestQueue();

await Actor.exit();
```

Each `Actor.openX(idOrName, { forceCloud })` accepts `forceCloud: true` to push a specific storage to the cloud even when running locally — useful when you want intermediate results in the cloud while developing.

If you're using Crawlee directly (`crawlee`) without `apify`, the `Dataset.open()` / `KeyValueStore.open()` / `RequestQueue.open()` static methods are the equivalent and are what `Actor.openX` calls under the hood.

---

## 7. Custom HTTP wrapper patterns

Since there is no built‑in HTTP API for local storage, the typical pattern is to expose what you need yourself. A few sketches:

### 7.1 Embedded server in the crawler process (recommended)

Co‑locating the server with the crawler avoids all the cross‑process consistency concerns.

```ts
// src/main.ts
import { PlaywrightCrawler, Dataset, KeyValueStore, RequestQueue } from 'crawlee';
import Fastify from 'fastify';

const app = Fastify();

app.get('/dataset/:name', async (req) => {
    const ds = await Dataset.open(req.params.name);
    const { offset = '0', limit = '100' } = req.query as Record<string, string>;
    return ds.getData({ offset: +offset, limit: +limit });
});

app.get('/dataset/:name/info', async (req) =>
    (await Dataset.open(req.params.name)).getInfo());

app.get('/kvs/:name/:key', async (req, reply) => {
    const kvs = await KeyValueStore.open(req.params.name);
    const v = await kvs.getValue(req.params.key);
    if (v == null) return reply.code(404).send();
    return v;
});

app.get('/queue/:name/info', async (req) =>
    (await RequestQueue.open(req.params.name)).getInfo());

await app.listen({ port: 3000 });

const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, enqueueLinks }) {
        await Dataset.pushData({ url: request.loadedUrl, title: await page.title() });
        await enqueueLinks();
    },
});
await crawler.run(['https://crawlee.dev']);
```

You now have `GET http://localhost:3000/dataset/default?offset=0&limit=50` returning live data, and any Python/curl/dashboard client can hit it. Because the server uses the same in‑memory `MemoryStorage` instance, reads are always consistent with what the crawler has written.

### 7.2 Sidecar inspector process

If the crawler is a black box you can't modify, run a separate Node process for read‑only inspection:

```ts
// inspector.ts
import express from 'express';
import { MemoryStorage } from '@crawlee/memory-storage';

const ms = new MemoryStorage({
    localDataDirectory: process.env.CRAWLEE_STORAGE_DIR ?? './storage',
    persistStorage: false,                  // never write back
});

const app = express();

app.get('/datasets/:id', async (req, res) => {
    const ds = ms.dataset(req.params.id);
    res.json(await ds.listItems({
        offset: Number(req.query.offset ?? 0),
        limit: Number(req.query.limit ?? 100),
    }));
});

app.get('/kvs/:id/:key', async (req, res) => {
    const rec = await ms.keyValueStore(req.params.id).getRecord(req.params.key);
    if (!rec) return res.sendStatus(404);
    res.type(rec.contentType ?? 'application/octet-stream').send(rec.value);
});

app.listen(3001);
```

Polls each directory on demand. Works well for datasets and KVS; **avoid** doing this for request queues during a live crawl unless you've switched the crawler to `@apify/storage-local`.

### 7.3 Live monitoring during long crawls

A few things that scale well in practice:

- Cache `Dataset.getInfo()` per second; the `itemCount` field is cheap and gives you progress.
- Stream new items by tracking the highest `<index>.json` file you've seen and yielding only newer ones (works because dataset writes are append‑only and monotonically numbered).
- Use `KeyValueStore.setValue('CRAWL_STATUS', { phase, processed, errors })` from the crawler and poll that key in the dashboard. This is by far the cleanest way to surface arbitrary structured progress.
- Pair it with the Apify SDK's `Actor.events` (`PERSIST_STATE`, `SYSTEM_INFO`, `MIGRATING`) if you want push‑style updates within the same process.

---

## TL;DR cheat sheet

| Need | Use this |
| --- | --- |
| Push/read dataset items inside the crawler | `Dataset.pushData`, `Dataset.open().getData(...)` |
| Read input / write output | `KeyValueStore.getInput()` / `KeyValueStore.setValue('OUTPUT', ...)` (or `Actor.*` equivalents) |
| Iterate a dataset | `ds.forEach`, `ds.map`, `ds.reduce`, or `ds.getData({ offset, limit })` |
| Export to one file | `Dataset.exportToJSON('OUTPUT')` / `exportToCSV` |
| Open a previous run's data in a script | `Dataset.open('name')` with `purgeOnStart=false` and `CRAWLEE_STORAGE_DIR` set |
| Read raw clients without the high‑level wrappers | `new MemoryStorage(...).dataset(id).listItems(...)` |
| HTTP API for local storage | Build it yourself with Express/Fastify/Hono in‑process |
| HTTP API for cloud storage | `api.apify.com/v2/...` — does not work locally |
| Read storage from Python | Walk `./storage/**/*.json` or use Crawlee for Python's filesystem client |
| Concurrent multi‑process access | Avoid; if unavoidable switch to `@apify/storage-local` (SQLite) and keep external readers read‑only |
| Self‑hosted Apify‑API‑compatible server | Crawlee Cloud (third‑party, separate stack) |

The single‑sentence summary: **the only "API" Crawlee gives you for local storage is the in‑process JS/TS one** (`Dataset` / `KeyValueStore` / `RequestQueue` plus the lower‑level `StorageClient` interface implemented by `@crawlee/memory-storage`). Anything HTTP‑shaped you build yourself, ideally inside the same process as the crawler.
