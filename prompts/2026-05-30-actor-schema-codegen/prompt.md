# Generate all `.actor/*.json` schemas from Zod, and unify dataset/KVS output across Actor + CLI + lib

> **TLDR**: Make `packages/schema` the single source of truth for **every** generated Apify schema file. Model the dataset's three record shapes (`success` / `failed` / `skipped`) as a Zod **discriminated union**, move Apify presentation concerns (views, display formats, output links, KVS collections) into typed **`.ts` config**, and rewrite the generator as **transformers** that emit `input_schema.json`, `dataset_schema.json` (nested members + union members, no longer collapsed), `output_schema.json`, **and** `key_value_store_schema.json`. Then extract a **shared sink core** into `@contextractor/crawler` so the **Apify Actor, the NPM CLI, and the NPM lib produce byte-identical dataset records and KVS output** (the only allowed difference is `ContentNode.url`, present only on the Apify platform). Unify the KVS key scheme to **`{format}-{md5(url)}.{ext}`**. Test locally (lib + CLI + Actor) and on the Apify platform.

> This prompt has been executed once and corrected against reality. The code blocks below are the **final, verified** versions — re-running this reproduces the implemented design. Read the "Verified facts" section before coding; it contains corrections to the original draft (nullable `loadedUrl`, the 3-branch enum merge, `enum` preservation, the no-auto-build deploy path).

## Context

`tools/gen-input-schema/src/main.ts` originally generated two of the four `.actor` files from Zod:

- `input_schema.json` ← `ContextractorInput` via `writeApifyInputSchema`. The input transformer is untouched, but four input **fields** are renamed to `apify/website-content-crawler` conventions — see "Input field renames" below.
- `dataset_schema.json` ← `ContextractorOutput` via a local `writeDatasetSchema` that **collapses all nested structure** to bare `type:"object"` and is **incomplete**.
- `output_schema.json` — **hand-written**.
- `key_value_store_schema.json` — **did not exist**.
- `actor.json` — **hand-written** deploy metadata; **stays hand-written** (not schema-derived).

Three problems are fixed together:

1. **The generator throws away structure.** `z.toJSONSchema(ContextractorOutput)` already contains `properties` for `metadata`/`crawl`, `anyOf` for the content unions, and (after the union change) `oneOf` for the record shapes. The old `writeDatasetSchema` discarded all of it, so the Apify Console Output tab could not show the members of `metadata`, the `ContentNode` fields, or `crawl`.

2. **The source of truth drifted from reality.** `ContextractorOutput` modeled a partial *success* record only. The dataset actually carries **three shapes** (`apps/apify-actor/SPEC.md`): `success`, `failed`, `skipped`. The fix is **expand the schema to match the code** — do not trim runtime fields.

3. **The CLI/lib and Actor output had diverged.** The standalone sink spread `metadata` at the top level, always inlined content (never wrote `ContentNode`s), pushed **no** dataset record in KVS-only mode, and keyed the KVS by URL slug; the Actor nested `metadata`, wrote `ContentNode`s, and keyed by `md5(url)[:16]`. **Requirement: the dataset records and KVS output must be identical across the Apify Actor, the NPM CLI, and the NPM lib** (greenfield — no backward compatibility). Only the *input* schema may legitimately differ per surface.

## The architecture: where each kind of variation lives

Three distinct concerns, three homes.

### Data-shape variations → Zod discriminated union (`output.ts`)

Everything about *what fields exist and their types*:

- `success` / `failed` / `skipped` → `z.discriminatedUnion('status', [Success, Failed, Skipped])`.
- Every content field (extracted formats + `original`) → a single `ContentNode` object `{ hash, bytes, content?, key?, url? }` — no union, no top-level `*Hash`. `content` holds the inline string (dataset); `key`/`url` reference the stored blob (key-value-store).
- Optional content fields `txt`/`markdown`/`json`/`html` → `.optional()` `ContentNode`s (present when extracted). `original` is a **required** `ContentNode` — the raw HTML's `hash`/`bytes` are always known.
- Nullable metadata/crawl fields, and `failed.loadedUrl` → `.nullable()`.

### Presentation / storage config → typed `.ts` (`apify/output-views.ts`)

Apify facts **not derivable from Zod**: which fields appear in the overview table, their labels and display `format`, the `output_schema` link templates, and the KVS **collection key-prefixes**. One typed config object (`OutputViews` + `KvsCollections`).

### Output parity → a shared sink core (`packages/crawler/src/sinks/storage.ts`)

Record assembly and KVS key derivation live **once**, in `@contextractor/crawler` (both apps already depend on it; it already depends on `@contextractor/extraction` — **no new package deps**). Both app sinks become thin wrappers, so output parity is *by construction*, not hand-sync.

### The generator becomes transformers

`toDatasetSchema(outputZod, views)`, `toOutputSchema(views)`, `toKeyValueStoreSchema(collections)` are pure functions consuming (Zod data schema) + (presentation config) → JSON. This mirrors the existing `to-apify-schema.ts` boundary used for the input schema.

## Scope

In:

- Expand `packages/schema/src/source-of-truth/output.ts` to a `z.discriminatedUnion('status', …)` modeling all three shapes with full envelope fields.
- New `packages/schema/src/apify/output-views.ts` (`OutputViews` + `KvsCollections`).
- New `packages/schema/src/apify/to-dataset-schema.ts`, `to-output-schema.ts`, `to-kvs-schema.ts` (move + rewrite the generator logic out of `tools/gen-input-schema`).
- Export the new functions + config from `packages/schema/src/index.ts`.
- Slim `tools/gen-input-schema/src/main.ts` to orchestration: call the input, dataset, output, **and KVS** writers.
- Regenerate `apps/apify-actor/.actor/dataset_schema.json`, `output_schema.json`, and new `key_value_store_schema.json`; wire `storages.keyValueStore` into `actor.json`.
- **Shared sink core** `packages/crawler/src/sinks/storage.ts` (`kvsKey`, `writeBlob`, `buildSuccessRecord`/`buildFailedRecord`/`buildSkippedRecord`, `ContentNode`/`KvsLike`/`ContentKind`); export from the crawler index.
- Rewrite both app sinks as thin wrappers over the shared core: `apps/apify-actor/src/sinks.ts` + `run.ts` (delete `apps/apify-actor/src/extraction.ts`, moved into the core); `apps/standalone/src/sinks.ts` + `cliProgram.ts` (remove `urlToFilename` + `KVS_FORMAT_INFO`).
- **Unify the KVS key scheme** to `{format}-{md5(url)}.{ext}` on both surfaces (changes the Actor's keys too).
- Tests (lib + crawler + CLI + Actor) and doc/SPEC sync.

Out:

- `actor.json` stays hand-written (deploy metadata). Do not generate it.
- Do **not** plumb a real `httpStatus` through the crawler — keep the literal `200` and flag it (separate cross-package change; see Flagged findings).
- No Rust / napi-rs crate changes (`.claude/rules/native-addon-boundary.md`); `txt` stays `txt`.

## Verified facts to bake in (corrections to the original draft)

Confirm the zod emit shapes before coding (zod **4.4.3**, `target:'draft-07', unrepresentable:'any', reused:'inline'`):

```bash
cd packages/schema && node --input-type=module -e '
import { z } from "zod";
const U = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), url: z.string(), metadata: z.object({ title: z.string().nullable() }), txt: z.object({hash:z.string(),bytes:z.number().int(),content:z.string().optional(),key:z.string().optional()}).optional() }),
  z.object({ status: z.literal("failed"),  url: z.string(), loadedUrl: z.string().nullable(), retryCount: z.number().int() }),
]);
console.log(JSON.stringify(z.toJSONSchema(U, { target:"draft-07", unrepresentable:"any", reused:"inline" }), null, 2));
'
```

Verified emit shapes the transformer must handle:

- **Top level**: `{ "$schema": …, "oneOf": [ {type:'object', properties, required, additionalProperties:false}, … ] }` (no top-level `type`).
- **Discriminator**: each branch's `status` is `{type:'string', const:'success'|'failed'|'skipped', description}`.
- **Nullable** (e.g. `metadata.title`, `failed.loadedUrl`): `{ description, anyOf:[{type:'string'},{type:'null'}] }` — **not** `type:['string','null']`. The `anyOf` handler picks the first non-null branch.
- **Content fields**: each is a single object `{type:'object', properties:{hash,bytes,content,key,url}, required:[hash,bytes]}` — no `anyOf` (the old `ContentField` union is gone), so the transformer recurses straight into its `properties`.

Three corrections to the original draft code (all applied below):

- **`FailedRecord.loadedUrl` must be `.nullable()`.** `createCrawler`'s `onFailedRequest` info types `loadedUrl: string | null`; `run.ts` / `cliProgram.ts` write it verbatim.
- **`mergeNode` must accumulate enum values across *all* branches.** The naive pairwise-collapse drops the third `status` (`skipped`): after `success`+`failed` the node has no `.const`, so the guard fails. Accumulate instead (see code).
- **`toDatasetField` must copy `enum`.** Otherwise the merged `status` enum is dropped. Apify's dataset `fields` is a JSON-Schema-style descriptor map that **does** accept `enum` and nested `properties` on a field (verified against the docs and a green platform build).

`buildSuccessRecord` content rules (identical on both surfaces): every content field — `txt`/`markdown`/`json`/`html` and `original` — is a `ContentNode` (`hash` + `bytes` always present). The **dataset** destination wins when both are selected: the content is inlined under `content`; otherwise the blob goes to the **key-value store** and is referenced by `key` + `url`. `original` is **always** present (at least `{ hash, bytes }`); its raw HTML is included (as `content`, or `key`/`url`) only when `"original"` is in `save`.

### KVS key scheme — research decision

Researched per Apify conventions (May 2026): Apify's own `apify/screenshot-url` keys per-URL blobs by **URL + MD5** (not content-hash, not slug). Content-hash keying is wrong here (breaks overwrite-on-recrawl, orphans blobs; the records already carry the raw HTML hash as `original.hash` and each content node's `hash`). KVS keys must match `^[a-zA-Z0-9!\-_.'()]{1,256}$` (no `/`, `:`, `?`, `#`) — slugs can violate this and exceed the length limit. **Decision: `{format}-{md5(url)}.{ext}`** (full 32-hex MD5 of `result.url`), identical on both surfaces. The **format prefix** lets `key_value_store_schema.json` group cleanly by `keyPrefix` (one collection per format).

### Content-node field naming — research decision

Researched (May 2026): the industry norm for a content object is a **single UTF-8 byte size** field, not a separate char count — JS `String.length` is UTF-16 code units (not chars or bytes), a char count is ambiguous and consumer-derivable, and S3/GitHub/HTTP expose bytes only. Field names: `hash` (MD5 hex), **`bytes`** (UTF-8 byte length), `content` (inline string, per the GitHub Contents API), `key` + `url` (KVS reference). So `ContentNode = { hash, bytes, content?, key?, url? }` — replacing the old `ContentRef` + `ContentField` union + the per-format `*Hash` top-level fields.

### Input field renames (verified against `apify/website-content-crawler`)

Rename four input fields to the WCC convention (greenfield, no backward-compat). `customHttpHeaders` and `respectRobotsTxtFile` **already match WCC — leave them** (Crawlee's own option is `respectRobotsTxtFile`). Internal crawler/CrawlConfig option names (`globs`, `excludes`, `maxCrawlingDepth`, `maxPages`, `crawlDepth`) and CLI flags (`--glob`, `--exclude`, `--max-pages`, `--crawl-depth`) stay; only the input-schema field names + their read sites change.

- `maxPagesPerCrawl` → `maxCrawlPages`
- `maxCrawlingDepth` → `maxCrawlDepth`
- `globs` → `includeUrlGlobs` (keep the `{glob}` array shape + `globs` editor)
- `excludes` → `excludeUrlGlobs` (same)

Read sites: `apps/apify-actor/src/config.ts` (`buildCrawlerOpts`), `apps/apify-actor/src/run.ts` (the sitemap block reads `input.includeUrlGlobs`/`input.excludeUrlGlobs` — **easy to miss**), `apps/standalone/src/config.ts` (`buildCrawlConfig`), `apps/standalone/src/cliProgram.ts` (the `s.maxCrawlPages._def` / `s.maxCrawlDepth._def` default reads + the `buildSchemaOverrides` output keys). Update `packages/schema/test/input.test.ts` + `apps/apify-actor/src/config.test.ts` mocks; regenerate `input_schema.json` + the `@generated` README input table via `pnpm docs:update`. `status` is kept (its values disambiguate it from `httpStatus`).

## File-by-file changes

### `packages/schema/src/source-of-truth/output.ts` — discriminated union

Replace the single `z.object` with a discriminated union. Keep the rs-trafilatura naming-convention header (extended to note the three shapes). `.describe()` on every field. Success fields ordered to match the runtime write order.

```ts
import { z } from 'zod';

/**
 * Zod source-of-truth for the Apify Actor dataset output schema.
 *
 * The dataset carries three record shapes discriminated by `status`
 * (see apps/apify-actor/SPEC.md): `success`, `failed`, `skipped`.
 *
 * Field names follow rs-trafilatura output conventions and align with the
 * upstream Python trafilatura metadata fields.
 */

// One piece of content (an extracted format or the raw original HTML). hash +
// bytes are always present; `content` is the inline string (dataset) and
// `key`/`url` reference the stored blob (key-value-store). No more ContentField
// union and no top-level `*Hash` fields.
const ContentNode = z.object({
  hash: z.string().describe('MD5 hex digest of the content'),
  bytes: z.number().int().describe('UTF-8 byte length of the content'),
  content: z
    .string()
    .optional()
    .describe('Inline content string. Present when saveDestination includes "dataset".'),
  key: z
    .string()
    .optional()
    .describe('Key-value store key. Present when stored in the key-value store.'),
  url: z.string().optional().describe('Public URL to the key-value store item.'),
});

const Metadata = z
  .object({
    title: z.string().nullable().describe('Page title'),
    author: z.string().nullable().describe('Content author'),
    publishedAt: z.string().nullable().describe('ISO 8601 publication date'),
    description: z.string().nullable().describe('Page description or summary'),
    siteName: z.string().nullable().describe('Site name (sitename in trafilatura)'),
    lang: z.string().nullable().describe('Detected content language code'),
  })
  .describe('Extracted page metadata');

const Crawl = z
  .object({
    depth: z.number().int().describe('Link distance from a start URL (0 for start URLs)'),
    referrerUrl: z.string().nullable().describe('The linking page URL, or null for start URLs'),
  })
  .describe('Crawl provenance for this page');

const SuccessRecord = z.object({
  url: z.string().describe('The original request URL'),
  loadedUrl: z.string().describe('The URL that was loaded (post-redirect)'),
  status: z.literal('success').describe('Record outcome discriminator'),
  loadedAt: z.string().describe('ISO 8601 timestamp when the page was loaded'),
  metadata: Metadata,
  httpStatus: z.number().int().describe('HTTP response status code (currently always 200; see SPEC)'),
  crawl: Crawl,
  // `original` is a required ContentNode: hash+bytes always present; content/key/url when in save.
  original: ContentNode.describe(
    'The raw page HTML. "hash" and "bytes" are always present. When "original" is in save, the raw HTML is included as "content" (dataset) or "key"/"url" (key-value store).',
  ),
  txt: ContentNode.optional().describe('Extracted plain text. Present when "txt" is in save.'),
  markdown: ContentNode.optional().describe('Extracted Markdown. Present when "markdown" is in save.'),
  json: ContentNode.optional().describe('Extracted structured JSON. Present when "json" is in save.'),
  html: ContentNode.optional().describe('Cleaned extracted HTML. Present when "html" is in save.'),
});

const FailedRecord = z.object({
  url: z.string().describe('The original request URL'),
  loadedUrl: z
    .string()
    .nullable() // CORRECTION: onFailedRequest types loadedUrl as string | null
    .describe('The URL that was loaded before failure, or null if navigation never completed'),
  status: z.literal('failed').describe('Record outcome discriminator'),
  errorMessages: z.array(z.string()).describe('Error messages from the final attempt'),
  retryCount: z.number().int().describe('Number of retries before the request was abandoned'),
  crawledAt: z.string().describe('ISO 8601 timestamp when the failed request was abandoned'),
});

const SkippedRecord = z.object({
  url: z.string().describe('The skipped URL'),
  status: z.literal('skipped').describe('Record outcome discriminator'),
  skipReason: z
    .enum(['robotsTxt', 'limit', 'enqueueLimit', 'filters', 'redirect', 'depth'])
    .describe('Why the URL was skipped'),
});

export const ContextractorOutput = z.discriminatedUnion('status', [
  SuccessRecord,
  FailedRecord,
  SkippedRecord,
]);
```

`packages/schema/src/index.ts` already had `export type ContextractorOutputType = z.infer<typeof ContextractorOutput>` — it becomes a 3-member union automatically.

### `packages/schema/src/apify/output-views.ts` (new) — presentation + KVS config

```ts
export const OutputViews = {
  title: 'Output schema',
  views: {
    overview: {
      title: 'Overview',
      transformation: { fields: ['loadedUrl', 'httpStatus', 'metadata.title', 'metadata.lang'] },
      display: {
        component: 'table',
        properties: {
          loadedUrl: { label: 'URL', format: 'link' },
          httpStatus: { label: 'Status', format: 'number' },
          'metadata.title': { label: 'Title', format: 'text' },
          'metadata.lang': { label: 'Language', format: 'text' },
        },
      },
    },
  },
  output: {
    overview: { type: 'string', title: 'Overview', template: '{{links.apiDefaultDatasetUrl}}/items?view=overview' },
  },
} as const;

/**
 * KVS collections. Each content format is written under a deterministic
 * `{format}-{md5(url)}.{ext}` key (see the crawler sink core), so collections
 * group cleanly by `keyPrefix`. These prefixes MUST stay in sync with `kvsKey`
 * in `@contextractor/crawler`; a test asserts they match. (contentTypes is
 * omitted to avoid charset-matching pitfalls on the platform build.)
 */
export const KvsCollections = {
  title: 'Stored content',
  collections: {
    txt: { title: 'Plain text', keyPrefix: 'txt-' },
    markdown: { title: 'Markdown', keyPrefix: 'markdown-' },
    json: { title: 'JSON', keyPrefix: 'json-' },
    html: { title: 'Extracted HTML', keyPrefix: 'html-' },
    original: { title: 'Original HTML', keyPrefix: 'original-' },
  },
} as const;
```

### `packages/schema/src/apify/to-dataset-schema.ts` (new) — the transformer

Merge the `oneOf` branches into one flat `fields` map; recurse nested `properties`; collapse nullable `anyOf` to its non-null branch; pick the `ContentNode` object for the content union; **accumulate the `status` consts into an `enum`** and **preserve `enum` on leaf fields**.

```ts
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { OutputViews } from './output-views.js';

type JsonNode = Record<string, unknown>;
type Field = Record<string, unknown>;

export function toDatasetSchema(schema: z.ZodType, views = OutputViews) {
  const jsonSchema = z.toJSONSchema(schema, {
    target: 'draft-07',
    unrepresentable: 'any',
    reused: 'inline',
  }) as JsonNode;

  const merged = mergeBranchProperties(jsonSchema);
  const fields: Record<string, Field> = {};
  for (const [name, node] of Object.entries(merged)) {
    const field = toDatasetField(node);
    if (field) fields[name] = field;
  }
  return { actorSpecification: 1, fields, views: views.views };
}

export function writeDatasetSchema(schema: z.ZodType, outPath: string): void {
  writeFileSync(outPath, `${JSON.stringify(toDatasetSchema(schema), null, 2)}\n`, 'utf8');
}

/** Merge every discriminated-union branch's properties into one flat map. */
function mergeBranchProperties(jsonSchema: JsonNode): Record<string, JsonNode> {
  const branches = Array.isArray(jsonSchema.oneOf) ? (jsonSchema.oneOf as JsonNode[]) : [jsonSchema];
  const out: Record<string, JsonNode> = {};
  for (const branch of branches) {
    const props = (branch.properties as Record<string, JsonNode>) ?? {};
    for (const [name, node] of Object.entries(props)) {
      const existing = out[name];
      out[name] = existing ? mergeNode(existing, node) : node;
    }
  }
  return out;
}

/**
 * Merge a field that appears in multiple branches. The only real cross-branch
 * conflict is the `status` discriminator: accumulate each branch's `const` into
 * one `enum` (accumulating, not pairwise-collapsing, so all three values
 * survive a 3-branch merge). Any other shared field (e.g. `loadedUrl`) keeps the
 * first branch's node — safe because `toDatasetField` normalizes leaf types
 * downstream (nullable `anyOf:[X,null]` collapses to `X` regardless).
 */
function mergeNode(a: JsonNode, b: JsonNode): JsonNode {
  const av = Array.isArray(a.enum) ? a.enum : a.const !== undefined ? [a.const] : null;
  const bv = Array.isArray(b.enum) ? b.enum : b.const !== undefined ? [b.const] : null;
  if (av && bv) {
    return { type: 'string', enum: [...new Set([...av, ...bv])], description: a.description ?? b.description };
  }
  return a;
}

/**
 * Convert one JSON-Schema node into an Apify dataset field descriptor. Recurses
 * into object `properties` (e.g. `metadata`, `crawl`, and the `ContentNode`
 * content fields), collapses nullable `anyOf:[X,null]` to X, and preserves `enum`.
 */
function toDatasetField(raw: unknown): Field | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const prop = raw as JsonNode;
  const description = typeof prop.description === 'string' ? prop.description : undefined;

  if (Array.isArray(prop.anyOf)) {
    const branches = prop.anyOf as JsonNode[];
    const objectBranch = branches.find((b) => b.type === 'object' && b.properties);
    const chosen = objectBranch ?? branches.find((b) => b.type && b.type !== 'null');
    const field = toDatasetField({ ...chosen }) ?? { type: 'object' };
    delete (field as JsonNode).description;
    if (description) field.description = description;
    return field;
  }

  const field: Field = {};
  const t = prop.type;
  if (t === 'string') field.type = 'string';
  else if (t === 'integer') field.type = 'integer';
  else if (t === 'number') field.type = 'number';
  else if (t === 'boolean') field.type = 'boolean';
  else if (t === 'array') field.type = 'array';
  else if (t === 'null') field.type = 'null';
  else field.type = 'object';

  if (field.type === 'object' && prop.properties && typeof prop.properties === 'object') {
    const nested: Record<string, Field> = {};
    for (const [k, v] of Object.entries(prop.properties as Record<string, unknown>)) {
      const sub = toDatasetField(v);
      if (sub) nested[k] = sub;
    }
    if (Object.keys(nested).length > 0) field.properties = nested;
  }

  if (Array.isArray(prop.enum)) field.enum = prop.enum; // CORRECTION: preserve enum
  if (prop.title) field.title = prop.title;
  if (description) field.description = description;
  return field;
}
```

### `packages/schema/src/apify/to-output-schema.ts` (new)

```ts
import { writeFileSync } from 'node:fs';
import { OutputViews } from './output-views.js';

export function toOutputSchema(views = OutputViews) {
  return { actorOutputSchemaVersion: 1, title: views.title, properties: views.output };
}
export function writeOutputSchema(outPath: string): void {
  writeFileSync(outPath, `${JSON.stringify(toOutputSchema(), null, 2)}\n`, 'utf8');
}
```

### `packages/schema/src/apify/to-kvs-schema.ts` (new)

```ts
import { writeFileSync } from 'node:fs';
import { KvsCollections } from './output-views.js';

export function toKeyValueStoreSchema(collections = KvsCollections) {
  return { actorKeyValueStoreSchemaVersion: 1, title: collections.title, collections: collections.collections };
}
export function writeKeyValueStoreSchema(outPath: string): void {
  writeFileSync(outPath, `${JSON.stringify(toKeyValueStoreSchema(), null, 2)}\n`, 'utf8');
}
```

### `packages/schema/src/index.ts`

Export alongside the existing input exports: `OutputViews`, `KvsCollections`, `toDatasetSchema`, `writeDatasetSchema`, `toOutputSchema`, `writeOutputSchema`, `toKeyValueStoreSchema`, `writeKeyValueStoreSchema`.

### `tools/gen-input-schema/src/main.ts` — slim to orchestration

Delete the local `writeDatasetSchema`; **drop the now-unused `import { z } from 'zod'`**; import the four writers; emit all four files, each followed by the existing Biome-format step. Keep repo-root resolution and the `process.argv[2]` input-path override (only the input path is overridable; dataset/output/kvs always write the repo's `.actor`).

```ts
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ContextractorInput, ContextractorOutput,
  writeApifyInputSchema, writeDatasetSchema, writeKeyValueStoreSchema, writeOutputSchema,
} from '@contextractor/schema';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const actorDir = resolve(repoRoot, 'apps/apify-actor/.actor');
const inputOut = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(actorDir, 'input_schema.json');

function emit(outPath: string, write: (p: string) => void): void {
  write(outPath);
  execFileSync('pnpm', ['exec', 'biome', 'format', '--write', outPath], { cwd: repoRoot, stdio: 'inherit' });
  console.log(`Wrote ${outPath}`);
}

emit(inputOut, (p) => writeApifyInputSchema(ContextractorInput, p, { title: 'Contextractor' }));
emit(resolve(actorDir, 'dataset_schema.json'), (p) => writeDatasetSchema(ContextractorOutput, p));
emit(resolve(actorDir, 'output_schema.json'), (p) => writeOutputSchema(p));
emit(resolve(actorDir, 'key_value_store_schema.json'), (p) => writeKeyValueStoreSchema(p));
```

### `packages/crawler/src/sinks/storage.ts` (new) — the shared sink core

Storage-agnostic; both apps wrap it. `computeContentInfo` and `OutputFormat` come from `@contextractor/extraction` (crawler already depends on it).

```ts
import { createHash } from 'node:crypto';
import { computeContentInfo, type OutputFormat } from '@contextractor/extraction';
import type { ExtractionResult } from './types.js';

export type ContentKind = OutputFormat | 'original';

interface KvsSpec { ext: string; contentType: string; keyPrefix: string; }

/** keyPrefix values MUST match `KvsCollections` in @contextractor/schema (a test asserts this). */
const KVS_SPECS: Record<ContentKind, KvsSpec> = {
  txt: { ext: 'txt', contentType: 'text/plain; charset=utf-8', keyPrefix: 'txt-' },
  markdown: { ext: 'md', contentType: 'text/markdown; charset=utf-8', keyPrefix: 'markdown-' },
  json: { ext: 'json', contentType: 'application/json; charset=utf-8', keyPrefix: 'json-' },
  html: { ext: 'html', contentType: 'text/html; charset=utf-8', keyPrefix: 'html-' },
  original: { ext: 'html', contentType: 'text/html; charset=utf-8', keyPrefix: 'original-' },
};

const CONTENT_FORMATS: readonly OutputFormat[] = ['txt', 'markdown', 'json', 'html'];

export interface ContentNode { hash: string; bytes: number; content?: string; key?: string; url?: string; }

export interface KvsLike {
  setValue(key: string, value: string, options?: { contentType?: string }): Promise<void>;
  getPublicUrl?(key: string): string | Promise<string>;
}

/** Deterministic KVS key for a content blob: `{keyPrefix}{md5(url)}.{ext}`. */
export function kvsKey(kind: ContentKind, url: string): string {
  const spec = KVS_SPECS[kind];
  return `${spec.keyPrefix}${createHash('md5').update(url).digest('hex')}.${spec.ext}`;
}

// Build a ContentNode: dataset wins → inline `content`; else write the blob to
// the KVS and reference it by `key` (+ `url` when the store has a public URL).
async function buildContentNode(kvs: KvsLike, kind: ContentKind, url: string, content: string, info: { hash: string; bytes: number }, toKvs: boolean, toDataset: boolean): Promise<ContentNode> {
  const node: ContentNode = { hash: info.hash, bytes: info.bytes };
  if (toDataset) {
    node.content = content;
  } else if (toKvs) {
    const key = kvsKey(kind, url);
    await kvs.setValue(key, content, { contentType: KVS_SPECS[kind].contentType });
    node.key = key;
    if (kvs.getPublicUrl) {
      const publicUrl = await kvs.getPublicUrl(key);
      if (publicUrl) node.url = publicUrl;
    }
  }
  return node;
}

export interface BuildSuccessRecordOpts { kvs: KvsLike; toKvs: boolean; toDataset: boolean; saveOriginal: boolean; }

/**
 * Assemble the `status: 'success'` record, shared by the Actor and CLI/lib so
 * their records are identical. Every content field (`txt`/`markdown`/`json`/
 * `html` and `original`) is a `ContentNode`: inline `content` for the dataset, or
 * `key`/`url` for the KVS (dataset wins when both selected). `original` is always
 * present (at least `{ hash, bytes }`); its raw HTML is included only when in save.
 */
export async function buildSuccessRecord(result: ExtractionResult, opts: BuildSuccessRecordOpts): Promise<Record<string, unknown>> {
  const { kvs, toKvs, toDataset, saveOriginal } = opts;
  const data: Record<string, unknown> = {
    url: result.url,
    loadedUrl: result.loadedUrl,
    status: 'success',
    loadedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    metadata: result.metadata,
    httpStatus: 200,
    crawl: { depth: result.crawlDepth, referrerUrl: result.referrerUrl },
  };

  // `original` always present; raw HTML included (content/key/url) only when in save.
  const originalInfo = { hash: result.rawHtmlHash, bytes: result.rawHtmlLength };
  data.original = saveOriginal
    ? await buildContentNode(kvs, 'original', result.url, result.html, originalInfo, toKvs, toDataset)
    : { ...originalInfo };

  for (const fmt of CONTENT_FORMATS) {
    const content = result.formats[fmt];
    if (content === undefined) continue;
    const info = computeContentInfo(content); // { hash, length }
    data[fmt] = await buildContentNode(kvs, fmt, result.url, content, { hash: info.hash, bytes: info.length }, toKvs, toDataset);
  }
  return data;
}

export interface FailedRequestInfo { url: string; loadedUrl: string | null; errorMessages: string[]; retryCount: number; }

export function buildFailedRecord(info: FailedRequestInfo): Record<string, unknown> {
  return {
    url: info.url, loadedUrl: info.loadedUrl, status: 'failed',
    errorMessages: info.errorMessages, retryCount: info.retryCount,
    crawledAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
}

export function buildSkippedRecord(url: string, skipReason: string): Record<string, unknown> {
  return { url, status: 'skipped', skipReason };
}
```

Export from `packages/crawler/src/index.ts`: `kvsKey`, `buildSuccessRecord`, `buildFailedRecord`, `buildSkippedRecord`, and the types `ContentKind`, `ContentNode`, `KvsLike`, `FailedRequestInfo`, `BuildSuccessRecordOpts`.

### `apps/apify-actor/src/` — wrap the shared core; delete `extraction.ts`

`sinks.ts` collapses to a thin wrapper (import `buildSuccessRecord`, `ExtractionResult`, `KvsLike`, `Sink` from `@contextractor/crawler`):

```ts
return async (result) => {
  const data = await buildSuccessRecord(result, { kvs, toKvs, toDataset, saveOriginal });
  await dataset.pushData(data);
};
```

`run.ts` failed/skipped handlers use `buildFailedRecord(info)` / `buildSkippedRecord(url, reason)`. **Delete `apps/apify-actor/src/extraction.ts`** (its `ContentInfo`/`saveContentToKvs` moved into the shared core; the Apify SDK `KeyValueStore` satisfies `KvsLike` structurally — it has `setValue` + `getPublicUrl`). Repoint the `KvsLike` type import in `sinks.test.ts` to `@contextractor/crawler`, and update the original-key test to `/^original-[0-9a-f]{32}\.html$/`.

### `apps/standalone/src/` — full parity via the shared core

`sinks.ts`: rewrite `createCrawleeStorageSink` to call `buildSuccessRecord`. **Keep the `formats` opt** (derive `saveOriginal = formats.includes('original')` internally) so the `cliProgram.ts` call site and `exitCode.test.ts` call-arg assertions are unchanged. Wrap the build + `pushData` in a try/catch (warn to stderr + continue — the CLI's existing resilience contract). Pass a `kvsLike` that **omits `getPublicUrl`** so local `ContentNode`s have no (misleading) `url`:

```ts
const kvsLike: KvsLike = { setValue: (key, value, options) => kvs.setValue(key, value, options) };
```

Remove `urlToFilename` and `KVS_FORMAT_INFO` (and the now-unused `computeContentInfo`/`createHash` imports). Drop the `urlToFilename` tests from `sinks.test.ts` and `cli.test.ts`. `cliProgram.ts` failed/skipped pushes use `buildFailedRecord`/`buildSkippedRecord` (keep the in-memory `failedRecords` array for the exit-code-2 check).

### `apps/apify-actor/.actor/actor.json`

Add `"keyValueStore": "./key_value_store_schema.json"` to `storages` (hand-edit; `actor.json` stays hand-written).

## Flagged findings — do NOT fix in this change

- **`httpStatus` hardcoded `200`** in `buildSuccessRecord`. `ExtractionResult` has no status field; a real fix means adding `httpStatus` to `ExtractionResult`, sourcing it per crawler type in `packages/crawler/src/handler.ts`, and updating the sink — a separate cross-package change. Keep `200`, document "currently always 200," note in the PR.
- **`crawledAt` vs `loadedAt`**: keep distinct (success loaded; failed never loaded).
- **`onSkippedUrl` is synchronous** (`(url, reason) => void`), so `void dataset.pushData(buildSkippedRecord(...))` is a floating promise on both surfaces — pre-existing, identical, not in scope.
- **`tools/platform-test-runner/` is pre-existing-stale — leave it.** `src/dataset-item.ts` validates against removed output fields (`extractedText`, `extractedXmlTei`, `rawHtml`) and `test-suites/*/settings.json` use the OLD input names (`maxPagesPerCrawl`, `maxCrawlingDepth`) plus long-removed fields (`trafilaturaConfig`, `saveRawHtmlToKeyValueStore`). The input renames make its page/depth-limit suites silently no-op (the input schema ignores unknown keys). It still builds (its `ContentRef`/`DatasetItem` are local types) and is not in the `pnpm test` assertion path, so it does not block this change — but flag that the platform-test-runner needs its own cleanup pass before it is usable again.

## Tests (same response as source — `.claude/rules/test-maintenance.md`)

- **`packages/schema/test/output.test.ts`** — `ContextractorOutput.parse` for: success w/ KVS content nodes (`{hash,bytes,key,url}`); success w/ inline content nodes (`{hash,bytes,content}`); mixed-null `metadata` + `crawl{depth:0, referrerUrl:null}`; `failed` (incl. `loadedUrl: null`); `skipped` (valid + invalid `skipReason`); unknown `status` rejected.
- **`packages/schema/test/to-dataset-schema.test.ts`** — deep-equal vs on-disk `dataset_schema.json` (read it with `JSON.parse(readFileSync(...))` — `any` from JSON.parse avoids explicit-`any` lint); invariants on the on-disk JSON: `fields.status.enum` is `['success','failed','skipped']`, `fields.metadata.properties.title.type==='string'`, `fields.crawl.properties.depth.type==='integer'`, `fields.txt.properties.hash.type==='string'`, `fields.skipReason.type==='string'`, `fields.errorMessages.type==='array'`, `views.overview.transformation.fields` unchanged; `toOutputSchema()`/`toKeyValueStoreSchema()` deep-equal their files; determinism + single trailing newline.
- **`packages/crawler/src/sinks/storage.test.ts`** — `kvsKey` matches `/^{prefix}[0-9a-f]{32}\.{ext}$/` per kind; `buildSuccessRecord` for KVS-only (`{hash,bytes,key}`, no `content`/`*Hash`), dataset-only (`{hash,bytes,content}`; `original` inlined too), both (dataset wins → all inline, KVS not written), and `original` always present (`{hash, bytes}` even when not in `save`; no top-level `originalHash`); a public-URL test (platform `KvsLike` with `getPublicUrl` sets `ContentNode.url`, local omits it, same key+hash); `buildFailedRecord`/`buildSkippedRecord` shapes.
- **`apps/apify-actor/src/storage-keys.test.ts`** — coupling: `kvsKey(kind, url)` starts with `KvsCollections.collections[kind].keyPrefix` (imports `kvsKey` from crawler + `KvsCollections` from schema — apify-actor depends on both).
- **Update** `apps/standalone/src/sinks.test.ts` for the new behavior (KVS-only still pushes a record of `ContentNode`s; dataset-mode content is `{hash,bytes,content}` not an inline string; `item.metadata.title`; `item.loadedAt` matches `/Z$/`; `item.httpStatus===200`; `both` mode: dataset wins so KVS not written; `original` always `{hash,bytes}`; no `*Hash`) and `apps/apify-actor/src/sinks.test.ts` (content fields are objects; import the `ContentNode` type from `@contextractor/crawler`). Keep `cli.test.ts`/`exitCode.test.ts` green.
- **Easy-to-miss test reader: `tools/proxy-rotation-tester/src/cli.test.ts`** reads the dataset item's `item.txt` **as a string** (`String(item.txt ?? '')`) — in dataset mode `txt` is now a `ContentNode`, so read `(item.txt as { content?: string }).content`. The sibling `lib.test.ts` reads `result.formats?.txt` (the in-memory `ExtractionResult`, **unchanged** — no change needed). After any output-shape change, grep the whole repo (incl. `tools/`) for readers of `item.{txt,markdown,json,html,original}` / `*Hash`.

## Verification — run from repo root, in order

- `pnpm install`
- **Regenerate via the full `pnpm build`** (not just the schema package): it rebuilds packages in dependency order, runs `gen-input-schema` (the four `.actor` JSON files) **and** `docs:update` (the `@generated` README regions). The intentional new baseline: `dataset_schema.json` gains the content-node members, `input_schema.json` gets the 4 renamed fields, `output_schema.json` is byte-unchanged, and the README input/enum tables update. **Gotcha:** do NOT regenerate by building only `@contextractor/schema` then running `pnpm docs:update` — `gen-md-regions` calls the standalone `buildProgram()`, which reads `ContextractorInput.shape` for CLI-flag defaults (`s.maxCrawlPages._def…`); against a stale `@contextractor/standalone` dist it throws `Cannot read properties of undefined (reading '_def')`. Use the full build (or rebuild `@contextractor/standalone` before `docs:update`).
- `pnpm build` · `pnpm lint` · `pnpm test` — all green. `npx knip --reporter compact` shows no dead **code** (two unused-**dependency** findings — `@contextractor/extraction` in standalone, `zod` in gen-input-schema — are transitive-type **false positives**; removing them needs a `pnpm install` and risks breaking type resolution, so leave them).
- `cargo build --workspace` · `cargo clippy --workspace --all-targets -- -D warnings` — green (unchanged).
- **CLI e2e**: `pnpm -F @contextractor/standalone build` then `CRAWLEE_STORAGE_DIR=/tmp/ctx-smoke node apps/standalone/dist/cli.js extract https://example.com --max-pages 1 --save markdown --save-destination key-value-store` → the dataset record has nested `metadata`, `loadedAt`, `httpStatus:200`, and `markdown` as a `ContentNode` `{hash,bytes,key:"markdown-{md5}.md"}` with **no `content`/`url`** (local); the KVS holds `markdown-{md5}.md`. (Note: the CLI uses `extract` subcommand + `--save`/`--max-pages`.)
- **Platform** (`/platform:deploy-and-test`, test actor only — `.claude/rules/apify-production.md`): see deploy notes below. Build must be `SUCCEEDED` with no `Invalid dataset/output/key-value-store schema`. A test run's dataset item must carry the full success shape with `markdown` as a `ContentNode` that **does** have a public `url` (platform) — the documented parity-modulo-`url` difference, with the identical `{format}-{md5}.{ext}` key on both surfaces. Report build + run URLs.
- Run `code-reviewer` over the diff before finishing.

### Platform deploy — operational notes (learned the hard way)

- **The dev push may NOT auto-trigger a build** for `glueo/contextractor-test`. After `git push origin HEAD:dev`, if no new build appears within ~1 min, trigger explicitly:
  ```bash
  apify builds create glueo/contextractor-test --version 0.3 --tag latest --log
  ```
  `--log` follows the build to completion ("ACTOR: Build finished." + image push = success). Multiple versions share the `latest` tag (0.0, 0.1, 0.3), so `--version 0.3` (the Git-connected one) is required.
- **`apify builds ls --json --limit N` is flaky** (returns an arbitrary subset / inconsistent ordering — it may not even include the just-created build). Trust the `builds create --log` output, not the listing.
- **mcpc sessions expire.** Use the Apify CLI for the test run instead (the production deny rule does not cover the test actor):
  ```bash
  apify call glueo/contextractor-test -b latest -t 240 -s -o -i '{"startUrls":[{"url":"https://en.wikipedia.org/wiki/Web_scraping"}],"maxCrawlPages":1,"save":["markdown"],"saveDestination":["dataset"]}'
  ```
  (`-o` and `--json` are mutually exclusive — use `-o` to print the dataset. The Actor input uses `save`/`maxCrawlPages`, **not** `outputFormat`/`maxRequestsPerCrawl`. With `saveDestination:["dataset"]`, each content field is a `ContentNode` `{hash, bytes, content}`; the renamed `maxCrawlPages` being honored confirms the input rename built on the platform.)

## Acceptance criteria

- `packages/schema` is the **only** place output fields/record shapes are declared; **all four** `.actor` schema JSON files are generated (input, dataset, output, key-value-store), none hand-edited except `actor.json`.
- `dataset_schema.json` exposes nested `properties` for `metadata`/`crawl`/`ContentNode`s, a `status` enum of all three values, and every field across success/failed/skipped. The `views.overview` block is preserved.
- `output_schema.json` and `key_value_store_schema.json` are generated from `OutputViews` / `KvsCollections`; `actor.json` references the KVS schema.
- **Dataset records and KVS output are identical across the Apify Actor, the NPM CLI, and the NPM lib** (one shared sink core), the only difference being `ContentNode.url` (platform-only); the unified KVS key scheme is `{format}-{md5(url)}.{ext}`.
- All local tests/lints/builds pass; the platform build on `glueo/contextractor-test` is `SUCCEEDED` and a test run's dataset item validates against the new schema.
- `httpStatus`-real-status remains explicitly flagged as out of scope.

## Constraints

- `.claude/rules/minimal-diff.md` — Edit, not Write, on existing files (the new transformer/sink files and the `output.ts`/`main.ts` rewrites are intentional full rewrites). The first generator run reflows the generated JSON — commit that as the baseline; thereafter the snapshot tests keep the diff empty.
- `.claude/rules/spec-maintenance.md` + `.claude/rules/test-maintenance.md` — update SPECs and tests in the same change.
- `.claude/rules/native-addon-boundary.md` — no Rust/napi changes; `txt` stays `txt`.
- `.claude/rules/apify-production.md` — test actor only; package.json dependency changes are ask-first (hence the two knip false-positives are left in place).
- `.claude/rules/json-config-only.md`, `.claude/rules/no-confirmation-prompts.md`, `.claude/rules/user-facing-docs.md`.

## Docs to sync

- `packages/schema/SPEC.md` + `README.md` — discriminated union, three shapes, four-writer generator, new exports; remove the "additional envelope fields not declared in this schema" note (now declared).
- `packages/crawler/SPEC.md` + `README.md` — the new shared sink core (`kvsKey`, `buildSuccessRecord`/`buildFailedRecord`/`buildSkippedRecord`, `ContentNode`/`KvsLike`); both apps are thin wrappers.
- `apps/apify-actor/SPEC.md` + `README.md` — schemas generated; `ContentNode` (not `ContentInfo`); `{format}-{md5}.{ext}` KVS keys.
- `apps/standalone/SPEC.md` + `README.md` — nested `metadata` + `loadedAt` + `httpStatus`; a dataset record is always pushed (ContentNode for KVS, inline for dataset); new KVS keys; parity note.
- Root `SPEC.md` + `README.md` + `CLAUDE.md` — generated output schemas, unified KVS keys, the standalone record change, "all four `.actor` schemas" / "input + output" structure comments.
- `tools/gen-input-schema/README.md` — now emits all four `.actor` schema files.

## Suggested sequence

`output.ts` union → `output-views.ts` (+`KvsCollections`) → `to-dataset/-output/-kvs-schema.ts` (with the three corrections) → `index.ts` → slim `main.ts` → shared crawler sink core + crawler index exports → Actor sink/run (+ delete `extraction.ts`) → standalone sink/cliProgram (remove `urlToFilename`) → regenerate `.actor` + wire `actor.json` (commit baseline) → tests → docs/SPEC/README sync → local gate → CLI e2e → `/platform:deploy-and-test` (manual `builds create` if no auto-trigger) → `code-reviewer`.
```
