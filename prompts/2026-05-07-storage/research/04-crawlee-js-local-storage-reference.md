# Crawlee for JavaScript/TypeScript — Local Storage Reference

A comprehensive technical reference for how Crawlee (the `crawlee` npm package and `@crawlee/*` family) stores its data when running locally or in any self-hosted environment outside the Apify platform. This document covers Crawlee v3.x (current stable line through 3.16, May 2026).

---

## 1. The big picture

When Crawlee runs outside the Apify cloud (i.e. you have not called `Actor.init()` / `Actor.main()` from the `apify` package, or you have but `APIFY_IS_AT_HOME` is not set), the global storage client is an instance of **`MemoryStorage`** from the `@crawlee/memory-storage` package. This is the default that ships transitively with the `crawlee` meta-package — you do not have to install it separately.

Despite the name "memory storage," `MemoryStorage` is a *hybrid* implementation:

- It keeps a live, in‑memory representation of every Dataset, KeyValueStore and RequestQueue (this is what the crawler actually reads from at runtime, for speed).
- In parallel it **off‑loads everything to plain files on disk** so that you can inspect results, resume runs, and so the default key‑value store can hold things like `INPUT.json`.

This dual behavior is described in the official upgrade guide:

> When we store some data or intermediate state (like the one RequestQueue holds), we now use `@crawlee/memory-storage` by default. It is an alternative to the `@apify/storage-local`, that stores the state inside memory (as opposed to SQLite database used by `@apify/storage-local`). While the state is stored in memory, it also dumps it to the file system, so we can observe it, as well as respects the existing data stored in KeyValueStore (e.g. the `INPUT.json` file).

So in normal local development you get the speed of an in‑memory store and the inspectability of files. The on‑disk format is JSON files in a tree under a single root directory.

---

## 2. Default storage location and directory layout

### 2.1 Root directory

The root directory is resolved in this order (first match wins):

1. The `localDataDirectory` option passed explicitly to `MemoryStorage`.
2. The `CRAWLEE_STORAGE_DIR` environment variable.
3. A **default** that is computed from the current working directory:
   - If `./crawlee_storage` already exists in the CWD, that is used (this is a backward‑compatibility shim — Crawlee v3.0.0 used `crawlee_storage` as the default; v3.0.1+ changed it to `storage` but respects pre‑existing `crawlee_storage` directories).
   - Otherwise `./storage` is used.

The relevant excerpt from `packages/memory-storage/src/memory-storage.ts`:

```ts
// v3.0.0 used `crawlee_storage` as the default, we changed this in v3.0.1 to just `storage`,
// this function handles it without making BC breaks - it respects existing `crawlee_storage`
// directories, and uses the `storage` only if it's not there.
const defaultStorageDir = () => {
    if (pathExistsSync(resolve('./crawlee_storage'))) {
        return './crawlee_storage';
    }
    return './storage';
};

this.localDataDirectory = options.localDataDirectory
    ?? process.env.CRAWLEE_STORAGE_DIR
    ?? defaultStorageDir();

this.datasetsDirectory        = resolve(this.localDataDirectory, 'datasets');
this.keyValueStoresDirectory  = resolve(this.localDataDirectory, 'key_value_stores');
this.requestQueuesDirectory   = resolve(this.localDataDirectory, 'request_queues');
```

**Important:** the path is resolved **relative to `process.cwd()` at the time the storage client is first instantiated**, not to your project root or to the file calling Crawlee. If you launch your script from a different working directory, Crawlee will create a different `./storage` folder there. If you need a stable location regardless of where the process is started, set `CRAWLEE_STORAGE_DIR` to an absolute path (e.g. via a `.env` file or a wrapper script).

### 2.2 Subdirectory layout

Under the root you will see three subdirectories, one per storage type:

```
storage/
├── datasets/
│   └── {DATASET_ID}/
│       ├── 000000001.json
│       ├── 000000002.json
│       └── ...
├── key_value_stores/
│   └── {STORE_ID}/
│       ├── INPUT.json
│       ├── OUTPUT.json
│       ├── SDK_CRAWLER_STATISTICS_0.json
│       └── ...
└── request_queues/
    └── {QUEUE_ID}/
        └── entries.json     (older versions used per-request files; current versions write a single entries.json)
```

If you set `DEBUG=crawlee:memory-storage` (or any `DEBUG` value containing `*`), Crawlee will additionally write `__metadata__.json` files alongside the data, which are useful when debugging.

---

## 3. The three storage types in detail

### 3.1 Request queues (`RequestQueue`)

- **Purpose:** queue of URLs (`Request` objects) to crawl. Supports breadth‑first and depth‑first, deduplication via `uniqueKey`, locking for concurrent consumers.
- **Class:** `RequestQueue` in `@crawlee/core`.
- **Default queue ID:** `default` (override with `CRAWLEE_DEFAULT_REQUEST_QUEUE_ID`).
- **On disk:**
  ```
  {CRAWLEE_STORAGE_DIR}/request_queues/{QUEUE_ID}/entries.json
  ```
  `entries.json` contains the array of serialized requests. Each named queue (e.g. `await RequestQueue.open('my-named-queue')`) gets its own subfolder under `request_queues/`.
- **Persistence semantics:** the queue is held primarily in memory; writes are batched to `entries.json`. Reads at runtime do **not** go through disk, which is why the docs warn that under heavy concurrent access from multiple processes the file copy is a *backup*, not the source of truth.
- **Adding requests:** `await crawler.addRequests([...])` opens the default queue under the hood; you don't have to call `RequestQueue.open()` yourself.

```ts
import { RequestQueue, CheerioCrawler } from 'crawlee';

const queue = await RequestQueue.open();              // default queue
const namedQueue = await RequestQueue.open('my-q');   // ./storage/request_queues/my-q/

await queue.addRequests([
  { url: 'https://example.com/1' },
  { url: 'https://example.com/2' },
]);

const crawler = new CheerioCrawler({ /* uses default queue automatically */ });
await crawler.run();
```

### 3.2 Datasets (`Dataset`)

- **Purpose:** append‑only structured rows (think one JSON object per "table row"). Cannot be modified or deleted in‑place.
- **Class:** `Dataset` in `@crawlee/core`.
- **Default dataset ID:** `default` (override with `CRAWLEE_DEFAULT_DATASET_ID`).
- **On disk:**
  ```
  {CRAWLEE_STORAGE_DIR}/datasets/{DATASET_ID}/{INDEX}.json
  ```
  Each call to `Dataset.pushData(item)` (or `dataset.pushData([item1, item2])`) creates **one JSON file per item**, named with a zero‑based, zero‑padded integer index — typically nine digits, e.g. `000000001.json`, `000000002.json`, …. Pushing an array results in N files, not one file.
- **Named vs default:** `Dataset.pushData(...)` uses the default dataset; `await Dataset.open('my-name')` opens (creating if missing) a named dataset under `datasets/my-name/`.

```ts
import { Dataset } from 'crawlee';

await Dataset.pushData({ col1: 123, col2: 'val2' });   // → datasets/default/000000001.json

const named = await Dataset.open('products');
await named.pushData([{ sku: 'A' }, { sku: 'B' }]);    // → datasets/products/000000001.json + 000000002.json
```

If you want a single combined output file, write it to the key‑value store instead (see §3.3) — for example by calling `await dataset.getData()` then `KeyValueStore.setValue('OUTPUT', data.items)`.

### 3.3 Key‑value stores (`KeyValueStore`)

- **Purpose:** arbitrary blob storage by string key, with MIME content types. Used for `INPUT`, `OUTPUT`, screenshots, PDFs, persisted crawler state, statistics (`SDK_CRAWLER_STATISTICS_*`), etc.
- **Class:** `KeyValueStore` in `@crawlee/core`.
- **Default store ID:** `default` (override with `CRAWLEE_DEFAULT_KEY_VALUE_STORE_ID`).
- **On disk:**
  ```
  {CRAWLEE_STORAGE_DIR}/key_value_stores/{STORE_ID}/{KEY}.{EXT}
  ```
  Each record is **one file**. The extension is derived from the record's `contentType`:
  - JavaScript objects (the default when no `contentType` is provided) are stringified and written as `{KEY}.json`.
  - Strings written with `contentType: 'text/plain'` become `{KEY}.txt`.
  - Binary buffers with `image/png` become `{KEY}.png`, `application/pdf` becomes `.pdf`, etc.
- **`INPUT.json`:** by convention the key‑value store under `default` is also where Crawlee/the Apify SDK reads the run's input from. If a file `key_value_stores/default/INPUT.json` exists locally, `await KeyValueStore.getInput()` will return its parsed contents. This file is **not purged** on start (see §4) — it is the one piece of state Crawlee actively preserves so that you can rerun with the same input.
- **`OUTPUT`:** by convention `KeyValueStore.setValue('OUTPUT', value)` writes the run's final result.

```ts
import { KeyValueStore } from 'crawlee';

// Reading INPUT (parsed JSON object)
const input = await KeyValueStore.getInput();

// Writing OUTPUT (object → JSON file at key_value_stores/default/OUTPUT.json)
await KeyValueStore.setValue('OUTPUT', { count: 42 });

// Storing a screenshot (binary, custom MIME → screenshot.png on disk)
await KeyValueStore.setValue(
  'screenshot',
  pngBuffer,
  { contentType: 'image/png' },
);

// Named store (key_value_stores/my-store/...)
const store = await KeyValueStore.open('my-store');
await store.setValue('cached-html', '<html>...</html>', { contentType: 'text/html' });

// Delete a record by setting it to null
await store.setValue('cached-html', null);
```

---

## 4. Storage backends/clients available outside Apify

Crawlee's storage layer is pluggable. Anything implementing the `StorageClient` interface (from `@crawlee/types`) can be used. The crawler obtains its client through the `Configuration` instance.

### 4.1 `MemoryStorage` (`@crawlee/memory-storage`) — the default

- **Default for any standalone Crawlee project.**
- Hybrid in‑memory + on‑disk JSON, as described above.
- Constructor options (`MemoryStorageOptions`):
  | Option | Default | Description |
  |---|---|---|
  | `localDataDirectory` | `process.env.CRAWLEE_STORAGE_DIR ?? './storage'` (with `crawlee_storage` BC) | Where to mirror data on disk. |
  | `persistStorage` | `true` (overridable via `CRAWLEE_PERSIST_STORAGE=false`) | If `false`, **nothing is written to disk** — everything stays in RAM and is lost on process exit. Useful for ephemeral runs (serverless, tests). |
  | `writeMetadata` | `true` if `DEBUG` includes `*` or `crawlee:memory-storage`; otherwise `false` | If `true`, also write `__metadata__.json` files for each storage. |

```ts
import { MemoryStorage } from '@crawlee/memory-storage';

const client = new MemoryStorage({
    localDataDirectory: '/var/data/crawlee',
    persistStorage: true,
    writeMetadata: false,
});
```

### 4.2 `@apify/storage-local` (SQLite‑based, legacy)

`@apify/storage-local` was the original on‑disk client used by Apify SDK v2. It stores request queues in a SQLite database (one DB file per queue) plus regular files for datasets/KV records. **It is no longer the default**; in Crawlee v3 it was replaced by `@crawlee/memory-storage`, but it is still maintained and still installable for cases where you need the stronger ACID guarantees of SQLite (e.g. multiple concurrent crawler processes hitting the same queue).

```ts
import { Configuration } from 'crawlee';
import { ApifyStorageLocal } from '@apify/storage-local';

const storageClient = new ApifyStorageLocal({ enableWalMode: true });
Configuration.getGlobalConfig().useStorageClient(storageClient);
```

When using it through `Actor.init()` / `Actor.main()`:

```ts
import { Actor } from 'apify';
import { ApifyStorageLocal } from '@apify/storage-local';

await Actor.init({ storage: new ApifyStorageLocal() });
```

(Crawlee requires `@apify/storage-local` v2.1.0 or later.)

**Caveats:**
- Known issues with SQLite on certain container filesystems (Cloud Run, some CIFS/NFS mounts) — the maintainers' workaround is to disable WAL via `APIFY_LOCAL_STORAGE_ENABLE_WAL_MODE=false` or to fall back to `MemoryStorage`.
- The directory used by `@apify/storage-local` historically came from `APIFY_LOCAL_STORAGE_DIR` (not `CRAWLEE_STORAGE_DIR`). When wired up through Crawlee's `Configuration`, the modern usage is to construct it explicitly and let it default to `./storage` or pass an explicit `storageDir`.

### 4.3 The `Configuration` class and `storageClient`

The `Configuration` singleton from `@crawlee/core` is the canonical place to install/inspect/replace the active storage client.

Key APIs:

```ts
import { Configuration } from 'crawlee';

const config = Configuration.getGlobalConfig();

// Read a config value
config.get('persistStorage');           // → boolean
config.get('storageClient');            // → the active StorageClient instance

// Set a value
config.set('persistStorage', false);

// Install a custom storage client (the recommended way to swap backends)
config.useStorageClient(myCustomClient);

// Static shorthand
Configuration.set('storageClient', myCustomClient);
```

The corresponding `ConfigurationOptions` you can pass to `new Configuration({...})` include (non‑exhaustive):
- `storageClient` — a `StorageClient` instance.
- `eventManager` — custom event manager.
- `persistStorage`, `persistStateIntervalMillis`.
- `purgeOnStart` — see §5.
- `defaultDatasetId`, `defaultKeyValueStoreId`, `defaultRequestQueueId`.
- `storageClientOptions` — passed through to the storage client constructor when Crawlee instantiates the default one.
- `logLevel`, `headless`, `memoryMbytes`, `availableMemoryRatio`, etc.

Precedence (lowest → highest): `crawlee.json` < `Configuration` constructor options < environment variables.

### 4.4 Newer/alternative storage clients

In the **JavaScript** ecosystem, as of mid‑2026 the only first‑party clients are still `@crawlee/memory-storage` (default, hybrid in‑memory + filesystem JSON) and `@apify/storage-local` (SQLite, legacy but maintained). There is **no first‑party `FileSystemStorageClient` or `SqlStorageClient` in JS Crawlee yet** — those exist in the Python sister project (Crawlee for Python v1+, which split `MemoryStorageClient` into `MemoryStorageClient` and `FileSystemStorageClient`, and added `SqlStorageClient`/`RedisStorageClient`). For JavaScript users, the closest equivalent of "memory only" is `MemoryStorage` with `persistStorage: false` (or `CRAWLEE_PERSIST_STORAGE=false`).

If you need a custom backend (S3, Postgres, Redis…) you implement `StorageClient` yourself and register it via `Configuration.getGlobalConfig().useStorageClient(myClient)`. The Crawlee maintainers' recommended pattern in GitHub Discussions is to subclass `MemoryStorage` and override the resource clients in `packages/memory-storage/src/resource-clients/`.

### 4.5 Apify cloud client (for completeness)

When you call `Actor.init()` or `Actor.main()` from the `apify` package and `APIFY_IS_AT_HOME` is set (i.e. inside an Apify run), the SDK swaps the global storage client to `ApifyClient`, which talks to the Apify API. **This swap does not happen locally**, even if you call `Actor.init()` — locally `Actor.init()` keeps `MemoryStorage` (or whatever client you passed via `Actor.init({ storage })`).

---

## 5. Purging behavior between runs

Default storages are **destructive between runs**: every fresh run wipes them. This is the single most surprising thing for newcomers, so understand it well.

### 5.1 What gets purged

The purge targets (only) the *default* storages — i.e. the ones with ID `default`, plus any unnamed temporary storages that Crawlee created internally (named `__CRAWLEE_TEMPORARY_*`). **Named storages are NEVER purged automatically.**

Concretely the purge:
- Empties `request_queues/default/` and any `request_queues/__CRAWLEE_TEMPORARY*` folders.
- Empties `datasets/default/`.
- Empties most files in `key_value_stores/default/` **except `INPUT.json`** and any `__OLD_…` / temporary markers (the `INPUT` key is preserved on purpose so you can rerun with the same input).
- Leaves `datasets/<other-name>/`, `key_value_stores/<other-name>/`, `request_queues/<other-name>/` untouched.

### 5.2 When it happens

Purging happens **lazily** the first time you touch a default storage:
- on `Dataset.open()` / `KeyValueStore.open()` / `RequestQueue.open()` (with no name);
- on the implicit equivalents like `Dataset.pushData(...)`, `KeyValueStore.getInput()`, `crawler.addRequests([...])`;
- at the latest, when `crawler.run()` starts — `BasicCrawler.run` performs the purge if no storage has been opened yet.

If you want to force it earlier (or simply trigger it once), call:

```ts
import { purgeDefaultStorages } from 'crawlee';

await purgeDefaultStorages();                       // purges once per execution context
await purgeDefaultStorages({ onlyPurgeOnce: true }); // explicit form (idempotent)
```

`purgeDefaultStorages()` is idempotent within an execution context — even if you call it many times, it will only actually purge once.

### 5.3 How to disable purging

Three equivalent ways:

1. **Environment variable**:
   ```bash
   CRAWLEE_PURGE_ON_START=0   # or "false"
   ```
2. **`crawlee.json`**:
   ```json
   { "purgeOnStart": false }
   ```
3. **Programmatic**:
   ```ts
   import { Configuration } from 'crawlee';
   Configuration.getGlobalConfig().set('purgeOnStart', false);
   ```

This is what you want if you're appending to a Dataset across runs, accumulating a long‑lived RequestQueue, or otherwise want continuity.

### 5.4 `persistStorage` is not the same as "don't purge"

`persistStorage: false` (or `CRAWLEE_PERSIST_STORAGE=false`) tells `MemoryStorage` not to write anything to disk in the first place — everything lives in RAM and disappears on process exit. That is different from `purgeOnStart: false`, which keeps on‑disk persistence on but doesn't wipe defaults at the start of a run. The two settings are independent.

### 5.5 `Actor.init()` vs standalone Crawlee

`Actor.init()` from the `apify` package wraps Crawlee's lifecycle:
- **Locally**, `Actor.init()` does not change the storage client; you keep `MemoryStorage` and the same purge rules apply.
- **On the Apify platform**, `Actor.init()` swaps to `ApifyClient` and the platform itself handles purging — typically each run gets fresh default storages, but the actual lifecycle is governed by the platform run lifecycle, not by `CRAWLEE_PURGE_ON_START`.

In both environments, `Actor.exit()` performs a graceful shutdown and (in the cloud) detaches the run.

---

## 6. All relevant `CRAWLEE_*` environment variables for storage

| Variable | Default | Effect |
|---|---|---|
| `CRAWLEE_STORAGE_DIR` | `./storage` (or `./crawlee_storage` if it exists, for v3.0.0 BC) | Root directory for all on‑disk data. Resolved relative to `process.cwd()` if relative. |
| `CRAWLEE_DEFAULT_DATASET_ID` | `default` | Overrides the ID/folder name of the default dataset. |
| `CRAWLEE_DEFAULT_KEY_VALUE_STORE_ID` | `default` | Overrides the ID/folder name of the default key‑value store. |
| `CRAWLEE_DEFAULT_REQUEST_QUEUE_ID` | `default` | Overrides the ID/folder name of the default request queue. |
| `CRAWLEE_PURGE_ON_START` | `1` (true) | If `0`/`false`, don't purge default storages between runs. |
| `CRAWLEE_PERSIST_STORAGE` | `1` (true) | If `0`/`false`, `MemoryStorage` keeps everything in RAM and writes nothing to disk. |
| `CRAWLEE_MEMORY_MBYTES` | quarter of system RAM | Autoscaling memory cap (not strictly storage but often co‑configured). |
| `CRAWLEE_HEADLESS` | unset | Force browser headlessness. |
| `CRAWLEE_LOG_LEVEL` | `INFO` | Logging level. |
| `CRAWLEE_VERBOSE_LOG` | `false` | More verbose error logging. |
| `CRAWLEE_CONTAINERIZED` | unset | (with `systemInfoV2` experiment) override containerization detection. |

Legacy variable still respected when `@apify/storage-local` is in use:
- `APIFY_LOCAL_STORAGE_DIR` — root for SQLite store.
- `APIFY_LOCAL_STORAGE_ENABLE_WAL_MODE` — toggle SQLite WAL.

---

## 7. Configuration patterns

### 7.1 Global singleton vs per‑crawler instance

Crawlee maintains a single global `Configuration` accessible via `Configuration.getGlobalConfig()`. Every crawler that you construct without an explicit second argument uses it.

You can also create independent instances and pass them to crawlers:

```ts
import { CheerioCrawler, Configuration } from 'crawlee';

const config = new Configuration({
  persistStateIntervalMillis: 10_000,
  purgeOnStart: false,
});

const crawler = new CheerioCrawler({ /* opts */ }, config);
```

### 7.2 Precedence

When the same setting is provided in multiple places, the resolution order is:

```
crawlee.json   <   new Configuration({...})   <   environment variables
```

So an env var always wins over a `crawlee.json` value, which always wins over a hardcoded default.

### 7.3 `crawlee.json`

Place it in your project root next to `package.json`:

```json
{
  "persistStateIntervalMillis": 10000,
  "purgeOnStart": false,
  "logLevel": "DEBUG",
  "defaultDatasetId": "products",
  "defaultKeyValueStoreId": "kv-prod"
}
```

No code changes required — Crawlee picks it up automatically when `Configuration.getGlobalConfig()` is first instantiated.

---

## 8. Practical patterns

### 8.1 Point Crawlee at a custom directory

The simplest way (no code change) is the env var:

```bash
# .env or shell
CRAWLEE_STORAGE_DIR=/var/data/my-scraper
```

Programmatically, swap the storage client with a custom directory:

```ts
import { Configuration } from 'crawlee';
import { MemoryStorage } from '@crawlee/memory-storage';

Configuration.getGlobalConfig().useStorageClient(
  new MemoryStorage({ localDataDirectory: '/var/data/my-scraper' })
);
```

Do this **before** any `Dataset.open()`, `KeyValueStore.open()`, `RequestQueue.open()`, or `crawler.run()` call — the storage client is cached on first use.

### 8.2 Run multiple crawlers with isolated storage in the same process

Each crawler can have its own `Configuration` with its own storage client pointing at a different directory:

```ts
import { CheerioCrawler, Configuration } from 'crawlee';
import { MemoryStorage } from '@crawlee/memory-storage';

const cfgA = new Configuration({
  storageClient: new MemoryStorage({ localDataDirectory: './storage-a' }),
});
const cfgB = new Configuration({
  storageClient: new MemoryStorage({ localDataDirectory: './storage-b' }),
});

const crawlerA = new CheerioCrawler({ /* ... */ }, cfgA);
const crawlerB = new CheerioCrawler({ /* ... */ }, cfgB);

await Promise.all([
  crawlerA.run(['https://site-a.example/']),
  crawlerB.run(['https://site-b.example/']),
]);
```

Alternatively, use **named** storages within one root directory — `await RequestQueue.open('crawler-a-queue')` and `await Dataset.open('crawler-a-data')` — and rely on the fact that named storages are never auto‑purged.

### 8.3 Fully ephemeral (in‑memory only) runs

For a serverless function, an AWS Lambda, or a unit test where you don't want any files on disk:

```bash
CRAWLEE_PERSIST_STORAGE=0
```

or

```ts
import { Configuration } from 'crawlee';
import { MemoryStorage } from '@crawlee/memory-storage';

Configuration.getGlobalConfig().useStorageClient(
  new MemoryStorage({ persistStorage: false })
);
```

Caveats: `KeyValueStore.getInput()` won't find an `INPUT.json` (you'll need to inject input some other way), and you lose the ability to inspect or resume.

### 8.4 Append‑only Dataset across runs

```bash
CRAWLEE_PURGE_ON_START=0
```

Now each run keeps growing `datasets/default/`. Watch out: `RequestQueue` will also persist, so if you want a fresh URL queue every run, open it as a named queue and `drop()` it, or call `await (await RequestQueue.open()).drop()` at the start.

### 8.5 Inspecting and debugging storage during development

- The folders are plain JSON — `cat`, `jq`, your editor, or `tree storage/` all work.
- Enable extra metadata files (per‑resource state info):
  ```bash
  DEBUG=crawlee:memory-storage
  ```
- To dump a Dataset to a single file for grepping:
  ```ts
  const ds = await Dataset.open();
  const { items } = await ds.getData();
  await KeyValueStore.setValue('SNAPSHOT', items);
  // → ./storage/key_value_stores/default/SNAPSHOT.json
  ```
- To export to CSV:
  ```ts
  const ds = await Dataset.open();
  await ds.exportToCSV('SNAPSHOT_CSV');   // writes to default KV store as CSV
  ```

### 8.6 Force a purge mid‑program

```ts
import { purgeDefaultStorages } from 'crawlee';
await purgeDefaultStorages();
```

### 8.7 Switch backend to legacy SQLite (multi‑process safety)

```ts
import { Configuration } from 'crawlee';
import { ApifyStorageLocal } from '@apify/storage-local';

Configuration.getGlobalConfig().useStorageClient(
  new ApifyStorageLocal({ storageDir: './storage', enableWalMode: true })
);
```

(Useful when several worker processes share one queue; `MemoryStorage` does not coordinate across processes — its in‑memory state is per process and only the disk dump is shared.)

### 8.8 Combining with Apify SDK actors

If you want code that runs both on Apify (cloud client) and locally (memory client) without changes:

```ts
import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

await Actor.init();   // no-op storage swap locally; uses ApifyClient on the platform

const crawler = new PlaywrightCrawler({
  async requestHandler({ page, request, pushData }) {
    await pushData({ url: request.url, title: await page.title() });
  },
});

await crawler.run(['https://example.com']);
await Actor.exit();
```

Locally, results land in `./storage/datasets/default/`. On the platform, results land in the actor run's default Dataset on Apify cloud.

---

## 9. Quick‑reference cheat sheet

```
ROOT:           ./storage   (or $CRAWLEE_STORAGE_DIR; legacy ./crawlee_storage if pre-existing)

DATASETS:       ./storage/datasets/{NAME}/000000001.json, 000000002.json, ...
                default name: "default"     (override: CRAWLEE_DEFAULT_DATASET_ID)

KV STORES:      ./storage/key_value_stores/{NAME}/{KEY}.{ext}
                ext from MIME: json/txt/html/png/pdf/...
                default name: "default"     (override: CRAWLEE_DEFAULT_KEY_VALUE_STORE_ID)
                INPUT.json is preserved across runs.

REQUEST QUEUES: ./storage/request_queues/{NAME}/entries.json
                default name: "default"     (override: CRAWLEE_DEFAULT_REQUEST_QUEUE_ID)

PURGE:          On every run, default + temporary storages are wiped.
                Disable: CRAWLEE_PURGE_ON_START=0 or { purgeOnStart: false }.
                Named storages are never auto-purged.
                Force: await purgeDefaultStorages();

PERSIST:        MemoryStorage writes to disk by default.
                Disable: CRAWLEE_PERSIST_STORAGE=0 or new MemoryStorage({ persistStorage: false }).

BACKEND SWAP:   Configuration.getGlobalConfig().useStorageClient(client);
                Available: MemoryStorage (default), ApifyStorageLocal (SQLite, legacy),
                custom (implement StorageClient).
```

---

## 10. Source references

- Official guides:
  - Request Storage — `https://crawlee.dev/js/docs/guides/request-storage`
  - Result Storage — `https://crawlee.dev/js/docs/guides/result-storage`
  - Configuration — `https://crawlee.dev/js/docs/guides/configuration`
- API reference:
  - `MemoryStorageOptions` — `https://crawlee.dev/js/api/memory-storage/interface/MemoryStorageOptions`
  - `Configuration` — `https://crawlee.dev/js/api/core/class/Configuration`
  - `KeyValueStore`, `Dataset`, `RequestQueue` under `https://crawlee.dev/js/api/core/class/...`
- Source code:
  - `packages/memory-storage/src/memory-storage.ts` in `apify/crawlee` on GitHub (default‑directory logic, purge logic).
- Upgrade notes: `https://crawlee.dev/js/docs/upgrading/upgrading-to-v3` (explains the move from `@apify/storage-local` to `@crawlee/memory-storage`).
- `@apify/storage-local` repository: `https://github.com/apify/apify-storage-local-js`.

This reference reflects Crawlee for JavaScript through the 3.16 release line (May 2026). The split into separate `MemoryStorageClient` / `FileSystemStorageClient` / `SqlStorageClient` / `RedisStorageClient` that has shipped in **Crawlee for Python** v1 has not (as of this writing) landed in the JavaScript package — JS users still get the hybrid `MemoryStorage` as the default and switch to `@apify/storage-local` if they need SQLite semantics.
