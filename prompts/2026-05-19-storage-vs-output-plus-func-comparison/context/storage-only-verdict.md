# Storage-Only vs Parallel `output/` for `contextractor-ts`: An Architectural Verdict

## TL;DR

- **Verdict: ⚠️ Acceptable but not idiomatic — and risky as proposed.** Removing `output/` is correct, but routing users to `cat storage/datasets/default/000000001.json` violates the spirit (not the letter) of Crawlee's docs and ignores Crawlee's own canonical export pattern.
- **Two critical gaps in the proposal**: (1) Crawlee's default `purgeOnStart=true` will silently destroy users' previous results on the next run; (2) the idiomatic Crawlee consumption pattern is `Dataset.exportToJSON('OUTPUT')` writing a **single** consolidated file to KVS — not a directory of zero-padded JSON shards. Telling users to read raw `storage/` is documented but Apify's own academy says *"there are a lot of files, and we don't want to work with those manually."*
- **Right answer**: delete `output/` and `fileSink` (yes), set `purgeOnStart: false`, move `CRAWLEE_STORAGE_DIR` out of CWD, write a single canonical artifact via `crawler.exportData()` *or* per-URL KVS blobs into a user-visible directory, and make `contextractor list/get` the primary consumption surface (mirroring `apify datasets get-items`). Raw `storage/` access is an undocumented power-user escape hatch, not a recommended workflow.

---

## 1. Is direct filesystem consumption of `storage/` a documented, supported pattern?

**Documented: yes. Recommended for end-user consumption: no.**

The on-disk layout is explicitly published in Crawlee's docs. From the Result Storage guide (crawlee.dev/js/docs/guides/result-storage):

> "The data is stored in the directory specified by the `CRAWLEE_STORAGE_DIR` environment variable as follows: `{CRAWLEE_STORAGE_DIR}/datasets/{DATASET_ID}/{INDEX}.json`"

> "{CRAWLEE_STORAGE_DIR}/key_value_stores/{STORE_ID}/{KEY}.{EXT}"

The Saving Data tutorial (crawlee.dev/js/docs/introduction/saving-data) reinforces this:

> "you'll find your data in the storage directory that Crawlee creates in the working directory of the running script: `{PROJECT_FOLDER}/storage/datasets/default/`"

So the format **is** part of the public API surface — reading it won't violate any contract. However, the same docs **steer users away from manually reading the shards**. The Apify academy lesson on exporting data (docs.apify.com/academy/scraping-basics-javascript/legacy/crawling/exporting-data) is blunt:

> "when we look inside the folder, we see that there are a lot of files, and we don't want to work with those manually."

The path layout is a documented contract; Apify's own pedagogical content explicitly tells users not to navigate it manually.

## 2. Crawlee's officially recommended way for end users to consume scraped data locally

A clear two-step canonical pattern:

1. **Inside the crawler**: call `Dataset.pushData()` (or per-URL `KeyValueStore.setValue()`).
2. **At the end of the run**: call `Dataset.exportToJSON('OUTPUT')` or `Dataset.exportToCSV('OUTPUT')`. This writes a **single consolidated file** into the default key-value store at `./storage/key_value_stores/default/OUTPUT.json`.

From the Crawlee Dataset API reference (crawlee.dev/js/api/core/class/Dataset):

> "Save entire default dataset's contents into one JSON file within a key-value store."

The newer `crawler.exportData()` helper (PR #2166, commit `c8c09a5`, authored by B4nan, March 2024) goes further and writes directly to an arbitrary user-chosen path. PR description:

> "Retrieves all the data from the default crawler Dataset and exports them to the specified format. Supported formats are currently 'json' and 'csv', and will be inferred from the path automatically."

This is the idiomatic Crawlee equivalent of Scrapy's `FEEDS` setting and trafilatura's `-o/--output-dir`. The `@crawlee/memory-storage` package — which writes the local `storage/` format — is described as a runtime store; its on-disk dump exists for inspection/persistence, not as the primary consumption surface.

The **Apify CLI** (the closest thing to an official tool for consuming Apify/Crawlee output locally) provides explicit query commands rather than asking users to read raw files: `apify datasets get-items`, `apify datasets info`, `apify datasets ls`, plus `apify key-value-stores` (per docs.apify.com/cli/docs/reference). The Apify CLI's `-s -o` (silent + output-dataset) flags print clean JSON to stdout — it treats the dataset as a queryable resource, not a filesystem to crawl.

## 3. Community / GitHub / Discord discussion

Several findings from issues and discussions are material to your proposal:

- **Purge-on-start is the default** (`CRAWLEE_PURGE_ON_START=true`). From crawlee.dev/js/api/core/function/purgeDefaultStorages: *"Purging will remove all the files in all storages except for `INPUT.json` in the default KV store."* If `contextractor` users run two extractions in a row without consuming the first, the first is destroyed.
- **The default storage dir name changed** between v3.0.0 (`crawlee_storage`) and v3.0.1 (`storage`). Source `packages/memory-storage/src/memory-storage.ts` at master: *"v3.0.0 used `crawlee_storage` as the default, we changed this in v3.0.1 to just `storage`, this function handles it without making BC breaks — it respects existing `crawlee_storage` directories, and uses the `storage` only if it's not there."* The change shipped in PR #1403. Backward-compatible code still falls through to old `crawlee_storage` if present — users with an old crawl on disk get split data across two directories. This is a single past breaking change, but it proves the path is not eternally stable.
- **`.DS_Store` and other dotfiles crash purging** (issue #1985, title *"purgeOnStart=false and a .DS_Store file in the crawlee_storage/request_queues/default directory causes crash"*): *"If you have a prior run and for any reason have a file starting with `.` in the request_queues/default directory it will fail with very ambiguous errors."* Fixed by PR #2132 ("fix(MemoryStorage): ignore invalid files for request queues", merged Oct 17, 2023 by vladfrangu, commit `fa58581`) — but this is a recurring *class* of bug: anything writing tempfiles into `storage/` can destabilize Crawlee. If you tell users to open `storage/` in Finder they will silently break the next run.
- **Purge sometimes does not actually purge** (issue #1602; discussion #1706, *"purgeDefaultStorages() doesn't work with express"*): one user reports *"my crawler runs again but shows that all routes have already finished. I'm even removing the ./storage folder … It clears the file storage correctly but something is lingering in memory that keeps it cached."* (Discussion #2610, *"How does crawlee work with node-schedule?"*, Aug 12, 2024, covers a related scheduler scenario.) These are stability concerns when the same directory is both runtime DB and user-visible output.

I did **not** find a Discord/GH thread explicitly debating "should my Crawlee CLI expose a parallel human-readable `output/`." The ecosystem is dominated by Apify Actors (where consumption is via API/UI), so the question is genuinely under-discussed.

## 4. How production CLI tools built on Crawlee handle this

A focused search turned up **no third-party npm-installable CLI** that depends on `crawlee`, ships a `bin` entry with `list`/`get` subcommands, and maintains a parallel human-readable `output/` directory. The ecosystem splits into three buckets:

1. **Apify Actors** (e.g. `apify/website-content-crawler` at github.com/apify/actor-scraper, published on Apify Store) — output is pushed to Apify Dataset + KVS via Crawlee. Per its input schema docs: *"Storing HTML in key-value store is preferred to storing it into the dataset with the saveHtml option, because there's no size limit and it's easier for debugging as you can easily view the HTML."* Consumption is via Apify console UI or API. No local `output/`.
2. **Project scaffolders** (`@crawlee/cli`, `apify-cli create`) — generate code that writes to `./storage/` only.
3. **Bespoke scripts** — Crawlee usage in users' own repos, almost always one-off code where the developer reads `storage/` themselves during debugging and then uses `Dataset.exportToCSV/JSON` for the final artifact.

This means `contextractor-ts` is genuinely **filling a gap** the ecosystem hasn't standardized. There is no reference architecture to copy from a peer Crawlee CLI. That makes your design decision higher-stakes, not lower.

For comparison with non-Crawlee peers:
- **trafilatura** (CLI) uses an explicit `-o/--output-dir`; no internal storage exposed. From its docs: *"-o or --output-dir to define a directory to eventually store the results"*.
- **Scrapy** uses `FEEDS = {"file:///path/items.json": {"format": "json"}}` — user-controlled URI, separate from internal job state.
- Both peers cleanly separate "runtime state" from "user output."

## 5. On-disk format of Crawlee local storage in 2026

Confirmed structure for Crawlee for JS v3.x (current stable 3.16.0 per npm, *"Latest version: 3.16.0, last published: 3 months ago"* as of May 2026):

```
storage/
├── datasets/{default|name}/
│   ├── 000000001.json       # one item per file, 9-digit zero-padded sequential
│   ├── 000000002.json
│   └── ...
├── key_value_stores/{default|name}/
│   ├── INPUT.json           # convention: input
│   ├── OUTPUT.json          # convention: output (Dataset.exportToJSON target)
│   ├── {key}.{ext}          # user-defined key + MIME-derived extension
│   └── ...
└── request_queues/{default|name}/
    ├── entries.json         # or {request_id}.json depending on version/client
```

Key facts:

- **Dataset items**: `{INDEX}.json` per the docs; index is zero-padded sequential. The Python sibling docs visually show `000000001.json` and the JS implementation matches. Per Result Storage: *"{INDEX} is a zero-based index of the item in the dataset"* — documented as zero-based but the printed pattern starts at `000000001`.
- **KVS filenames**: literal `{KEY}.{EXT}` with no prefix/suffix — your `example-com.md` slug produces exactly `example-com.md`. Per JSDoc in `packages/core/src/storages/key_value_store.ts`: *"The `{KEY}` is the key of the record and `{EXT}` corresponds to the MIME content type."*
- **KVS key constraints**: *"It can be at most 256 characters long and only consist of the following characters: a-z, A-Z, 0-9 and !-_.'()"* (crawlee.dev/js/api/core/class/KeyValueStore). Permissive enough for domain slugs (`example-com`, `example.com`) but case is preserved, so `Example-com.md` and `example-com.md` collide on default macOS APFS and Windows NTFS (case-insensitive).
- **`__metadata__.json` files**: JS Crawlee's `@crawlee/memory-storage` defaults `writeMetadata` to **false** unless `DEBUG=crawlee:memory-storage` (or `DEBUG=*`) is set. Source: `packages/memory-storage/src/memory-storage.ts`: *"this.writeMetadata = options.writeMetadata ?? process.env.DEBUG?.includes('*') ?? process.env.DEBUG?.includes('crawlee:memory-storage') ?? false;"*. This differs from Python `FileSystemStorageClient`, whose docs show `__metadata__.json` always present in each storage folder. So today JS users won't see metadata files in their KVS by default — but a future change aligning the JS client with Python could introduce them and clutter your "one blob per URL" UX.
- **request_queues/**: contains an `entries.json` (or per-request files in some versions). Pure runtime garbage from a user's perspective; sits alongside results in the same `storage/` tree.

Format-stability history: the only breaking format change in v3.x was the v3.0.0 → v3.0.1 directory rename. Within v3.1–v3.16, dataset/KVS file naming has been stable. There is no published deprecation notice for the layout — but also no public stability guarantee that future major versions won't restructure it.

## 6. Apify platform asymmetry

When the same Actor runs on Apify's cloud:

- There is no local filesystem the user has access to. Output is the Dataset (queryable via `GET /v2/datasets/{id}/items?format=json|csv|jsonl|html|xlsx|xml|rss`) and Key-Value Store (`GET /v2/key-value-stores/{id}/records/{key}`).
- Consumption is via Apify Console UI, the Apify API, the JS/Python `apify-client`, or `run-sync-get-dataset-items`.
- Users **never** "read files" — they query a resource.

**The asymmetry matters**, but in the *opposite* direction someone reading "behave analogously locally" might assume. "Analogously" does not mean "expose the underlying disk layout." It means **expose a query interface that hides the storage backend** — exactly what your `contextractor list` / `contextractor get` subcommands provide. The local CLI subcommands are the on-disk analog of `apify datasets get-items`. That part of your proposal is correct and idiomatic.

What is **not** idiomatic is also telling users *"or just `cat storage/datasets/default/000000001.json` directly."* On the Apify platform there is no equivalent affordance, because storage is opaque. If you want symmetry with the cloud Actor experience, your CLI should make the subcommands the *only* documented consumption path — and treat raw filesystem access the way Apify treats it: an undocumented escape hatch for power users debugging the tool, not a recommended workflow.

## 7. Verdict on the proposal

Restating the proposal:
- Delete `output/` and `fileSink`.
- Route everything through Crawlee's `storage/`.
- Users consume via `contextractor list/get` **OR** by reading `storage/datasets/default/*.json` and `storage/key_value_stores/default/*` directly.
- `--save-destination` chooses between KVS (one blob per URL per format) and Dataset (one record with all formats inline).
- `--save` formats: `markdown,html,txt,json,jsonl,original,all`.

### Score by component

| Component | Verdict | Why |
|---|---|---|
| Delete `output/` directory | ✅ Best practice | Eliminates double-write, race conditions, and "which is canonical?" confusion. |
| Delete `fileSink` | ✅ Best practice | Crawlee already is the file sink — having a second one is redundant. |
| Push everything through Crawlee storage | ✅ Best practice | Matches Apify cloud semantics. |
| `contextractor list/get` subcommands | ✅ Best practice | Mirrors `apify datasets get-items`. This is the right consumption interface. |
| `--save-destination=key-value-store` (one blob per URL per format) | ✅ Idiomatic | Matches Website Content Crawler's pattern: store large content in KVS, metadata in dataset. KVS filenames `{slug}.md` are immediately human-usable. |
| `--save-destination=dataset` (one JSON record per page with all formats inline) | ⚠️ Workable but fat | Crawlee's per-item limit becomes a real problem on long pages. From `Dataset.pushData()` JSDoc (crawlee.dev/js/api/core/class/Dataset): *"The objects must be serializable to JSON and the JSON representation of each object must be smaller than 9MB."* Users hit this on news/wiki sites that bundle `original` HTML. |
| **Telling users to read `storage/datasets/default/000000001.json` directly** | ❌ Anti-pattern | Documented? Yes. Recommended? No — Apify's own academy: *"we see that there are a lot of files, and we don't want to work with those manually."* Filename is opaque (no URL in name), one item per file, mixed with `request_queues/` and `key_value_stores/INPUT.json`. |
| **Not addressing default purge-on-start** | ❌ Critical risk | Default Crawlee config purges storage at the start of every crawl. Users who run `contextractor extract a.com` then `contextractor extract b.com` lose `a.com`'s output unless you set `purgeOnStart: false` or use named datasets. |

### Bottom line

The user's internal research is **directionally correct** — `output/` duplication should die — but **incomplete on three critical points**: (a) purge-on-start, (b) the "one big consolidated file" idiom that Crawlee itself recommends via `Dataset.exportToJSON`/`crawler.exportData`, and (c) the difference between *documenting* a storage layout (which Crawlee does) and *recommending users read it* (which Crawlee does not).

## 8. Specific risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Default `purgeOnStart=true` destroys previous run's results when a user runs the CLI again | 🔴 Critical | Set `Configuration({ purgeOnStart: false })` in `contextractor`. Document that users can opt in with `--clean`. **OR** use named (not default) datasets keyed by run timestamp / domain, since named storages are never auto-purged. |
| `request_queues/`, `key_value_stores/SDK_CRAWLER_STATISTICS_*.json`, session pool files clutter the same `storage/` tree users browse | 🟡 Medium | Either (a) hide noise behind `contextractor list/get` and discourage raw browsing, or (b) set `CRAWLEE_STORAGE_DIR` to a tool-managed cache location (e.g. `~/.cache/contextractor/`) and write **only** user-facing outputs to a `./contextractor-output/` directory via `crawler.exportData()`. The latter restores something like `output/` but on the CLI's terms, not by manual writes. |
| KVS key regex `[a-zA-Z0-9!\-_.'()]` collides with realistic slugs | 🟡 Medium | `example.com` → KVS key `example.com` → file `example.com.md`. The dot in the key is fine but your slugger must strip colons, slashes, query strings. Lowercase to avoid case-insensitive FS collisions (`Example.com` vs `example.com`). |
| 9 MB-per-dataset-item limit on `--save-destination=dataset` with `original,all` | 🟡 Medium | Document the limit. Auto-overflow large fields to KVS with a `htmlUrl`/`originalUrl` pointer field (exactly what Website Content Crawler does). |
| Future Crawlee major version may reorganize storage (precedent: v3.0.0→v3.0.1 rename via PR #1403) | 🟡 Medium | Wrap raw-file access guidance behind a clearly-marked "low-level" section in your README. Make `contextractor list/get` the primary documented surface so a future rename only breaks the escape hatch. |
| `.DS_Store` / editor tempfiles in `storage/` cause crawler crashes (issue #1985, fixed in PR #2132 Oct 2023 but a recurring class of bug) | 🟢 Low | Tell users not to open `storage/` in Finder/Explorer — which is easier if you don't tell them to read it in the first place. |
| Concurrent `contextractor` runs sharing `storage/` | 🟡 Medium | Crawlee Python docs warn: *"The FileSystemStorageClient is not safe for concurrent access from multiple crawler processes."* The JS storage has similar limitations. Use a per-invocation `CRAWLEE_STORAGE_DIR` (e.g. `~/.cache/contextractor/runs/{timestamp}/`) if concurrency is in scope. |
| Aside: the previous "should `--save-destination` gate `output/` writes?" question | N/A | Moot. The new design removes `output/`, so this debate dissolves. |
| `__metadata__.json` not present today in JS but present in Python; future alignment could change that | 🟢 Low | Document filenames you write (`{slug}.{ext}`), not "everything in the folder." Code defensively in `contextractor get` so unrecognized files are ignored. |

---

## Recommendations

**Do this (staged):**

1. **Delete `output/` and `fileSink`.** ✅ Your instinct is correct.
2. **Set `purgeOnStart: false` globally** in the Crawlee `Configuration`. Add `--clean` / `--fresh` CLI flag for users who explicitly want a purge. This is non-negotiable — without it the tool silently destroys data.
3. **Move runtime storage out of CWD.** Default `CRAWLEE_STORAGE_DIR` to `$XDG_DATA_HOME/contextractor/storage` (or `~/.local/share/contextractor/storage` / `~/Library/Application Support/contextractor/storage`). Users browsing the project directory should not see `request_queues/` and SDK statistics files.
4. **Write a single consumable artifact per run** using `await crawler.exportData('./contextractor-output/run-{timestamp}.jsonl')` (or `.json`, `.csv`). This is a thin, predictable, single-file artifact users *can* `cat`/`jq`/grep. It's what Scrapy users get from `FEEDS`, what trafilatura users get from `-o`, and what Crawlee itself recommends via `Dataset.exportToJSON`/`crawler.exportData()`.
5. **Keep your `--save-destination=key-value-store` mode for per-URL blobs.** This is the right pattern for the markdown-per-page UX (mirrors Website Content Crawler's HTML-in-KVS approach). Write those blobs *to a user-visible directory* via a small wrapper — don't make users dig into `~/.local/share/...`. Suggested: `./contextractor-output/{slug}.{ext}`.
6. **Ship `contextractor list` and `contextractor get`** as the *primary* documented consumption interface. Make them work against either the local Crawlee dataset (default) or a user-specified `--storage-dir`.
7. **Document the raw `storage/` layout in an "advanced" README section** as an escape hatch, with explicit warnings: (a) filenames may change across Crawlee majors; (b) don't open the folder in Finder; (c) the tool may purge it on `--clean`.
8. **For the Apify Actor build of the same codebase**: keep it pure (Dataset + KVS via Apify API, no local files). Use `Actor.isAtHome()` (apify SDK) to branch.

**Don't do this:**

- ❌ Don't make `cat storage/datasets/default/000000001.json` a documented user-facing workflow. It's documented Crawlee, but it's not documented Crawlee *for end users* — it's documented Crawlee for crawler authors debugging their own scrapers.
- ❌ Don't co-locate `storage/` (which holds `request_queues/`, session pool state, statistics JSONs) with what users perceive as "my output." Either route output through a different directory via `crawler.exportData()`/per-URL writes, or move `storage/` out of CWD entirely.
- ❌ Don't rely on default `purgeOnStart`. Default Crawlee behavior is hostile to the "I ran the CLI yesterday, where are my results?" use case.

**Thresholds that would change the recommendation:**

- If Crawlee ships a `--no-purge` default or a public `Result Storage Stability` guarantee for v3+ → the "documented but not recommended" tension dissolves; raw-storage exposure becomes safer to recommend.
- If Crawlee adds a first-class `exportToDirectory({ format, perItem: true })` API → you can drop your KVS-blob workaround and use it directly.
- If a peer Crawlee-based CLI emerges with a clean output-directory convention → adopt it for ecosystem consistency.

The user's internal research nailed the *direction* — eliminate the double-write, route everything through Crawlee. But the proposal as stated treats Crawlee's `storage/` as if it were a user-friendly output directory; it isn't. With `purgeOnStart=false`, an out-of-CWD storage dir, and `crawler.exportData()` writing a single canonical artifact per run, the design becomes both idiomatic and robust.

## Caveats

- This verdict rests on Crawlee for JS v3.16.0 (current stable per npm registry, *"Latest version: 3.16.0, last published: 3 months ago"* — i.e., ~February 2026). A future v4 could change defaults; the v3.0.0→v3.0.1 directory rename (PR #1403) shows Apify is willing to tweak the layout without deeming it major-breaking.
- I could not locate a third-party npm CLI built on Crawlee that solves this exact problem in production, so `contextractor-ts` is operating in an under-standardized niche. The recommendations above are extrapolated from (a) Crawlee/Apify docs, (b) Website Content Crawler's pattern (Apify Actor, not standalone CLI), (c) Scrapy/trafilatura conventions, and (d) 12-factor CLI guidance — not from a proven Crawlee-CLI archetype.
- Some Crawlee storage bugs (#1602, #1706, #1985 fixed via #2132, #2610) suggest the local storage backend has rough edges around purging and concurrent access. Crawlee's own Python docs note that `FileSystemStorageClient` is *"not safe for concurrent access from multiple crawler processes."* Don't let two `contextractor` runs share a storage dir.
- The exact 9-digit zero-padding of dataset filenames is visually documented in Crawlee's Python sibling docs and visible in tutorials referencing `000000001.json` (e.g. zenrows.com/blog/crawlee), but I did not retrieve the exact `padStart(9, '0')` line from JS source. If precision matters for `contextractor get`, code defensively against any zero-padded integer width rather than hard-coding `9`.
