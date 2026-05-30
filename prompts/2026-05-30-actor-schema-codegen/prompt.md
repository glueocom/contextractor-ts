# Generate all `.actor/*.json` schemas from the Zod source of truth, with record-shape variations

> **TLDR**: Make `packages/schema` the single source of truth for **every** generated Apify schema file. Model the dataset's three record shapes (`success` / `failed` / `skipped`) as a Zod **discriminated union**, move Apify presentation concerns (views, display formats, output links) into a typed **`.ts` config**, and rewrite the generator as a **transformer** that emits `input_schema.json`, `dataset_schema.json` (with nested object members + union members, no longer collapsed), and `output_schema.json`. Reconcile the standalone CLI dataset record with the Actor's. Then test locally (lib + CLI + Actor) and on the Apify platform.

## Context

`tools/gen-input-schema/src/main.ts` currently generates two of the four `.actor` files from Zod:

- `input_schema.json` ← `ContextractorInput` via `writeApifyInputSchema` (good — leave the input path untouched).
- `dataset_schema.json` ← `ContextractorOutput` via a local `writeDatasetSchema` that **collapses all nested structure** to bare `type:"object"` (main.ts:59-65) and is **incomplete**.
- `output_schema.json` — **hand-written** (`.actor/output_schema.json`, 11 lines).
- `actor.json` — **hand-written** deploy metadata; **stays hand-written** (it is not schema-derived).

Two independent problems must be fixed together:

1. **The generator throws away structure.** `z.toJSONSchema(ContextractorOutput)` already contains `properties` for `metadata`, `anyOf` for the content unions, and (after change #2) `oneOf` for the record shapes. `writeDatasetSchema` discards all of it. The Apify Console Output tab therefore cannot show the members of `metadata`, the `ContentRef` fields (`hash`/`length`/`key`/`url`), or `crawl`.

2. **The source of truth has drifted from reality.** `ContextractorOutput` models a partial *success* record only. The dataset actually carries **three shapes**, accurately documented in `apps/apify-actor/SPEC.md:28-34`:
   - **success** (`apps/apify-actor/src/sinks.ts:52-92`): `{ url, loadedUrl, status:'success', loadedAt, metadata, httpStatus, originalHash, crawl:{depth,referrerUrl}, original?, txt?, markdown?, json?, html?, txtHash?, markdownHash?, jsonHash?, htmlHash? }`. Content fields are a `ContentRef` object when `saveDestination` includes `key-value-store`, an inline string when `dataset`; the `*Hash` fields appear only in the `dataset` branch.
   - **failed** (`apps/apify-actor/src/run.ts:67-76`): `{ url, loadedUrl, status:'failed', errorMessages, retryCount, crawledAt }`.
   - **skipped** (`apps/apify-actor/src/run.ts:77-83`): `{ url, status:'skipped', skipReason }`; reasons `'robotsTxt' | 'limit' | 'enqueueLimit' | 'filters' | 'redirect' | 'depth'`.

The fix direction is **expand the schema to match the code** (the code and SPEC are correct; the Zod type drifted). Do **not** trim runtime fields.

## The architecture: where each kind of variation is defined

There are two distinct kinds of "variation," and they get two distinct homes. This separation is the point of the task.

### Data-shape variations → Zod discriminated union (the data source of truth)

Everything about *what fields exist and their types* lives in Zod:

- `success` / `failed` / `skipped` → `z.discriminatedUnion('status', [Success, Failed, Skipped])`.
- KVS-reference vs inline-string content → the existing `ContentField = z.union([ContentRef, z.string()])`.
- Conditional fields (per-format hashes, optional content/`original`) → `.optional()`.
- Nullable metadata/crawl fields → `.nullable()`.

Verified zod 4.4.3 emit shapes the transformer must handle:
- discriminated union → `{ oneOf: [ {type:'object', properties, required}, … ] }`, each branch's `status` as `{type:'string', const:'success'|'failed'|'skipped'}`.
- nullable → `{ anyOf: [ {type:'string'}, {type:'null'} ] }`.
- content union → `{ anyOf: [ {type:'object', properties:{hash,length,key,url}}, {type:'string'} ] }`.

### Presentation / UX variations → a typed `.ts` config (NOT hardcoded in the generator)

Apify-specific facts that are **not derivable from Zod** — which fields appear in the overview table, their labels and display `format` (`link`/`number`/`text`/`date`), and the `output_schema` link templates. Today these are **hardcoded inside `writeDatasetSchema`** (main.ts:76-92) — the wrong home. Extract them into one typed config object so the data schema (Zod) and the presentation config (`.ts`) are cleanly separated and independently testable.

### The generator becomes a transformer

`toDatasetSchema(outputZod, viewConfig)` and `toOutputSchema(viewConfig)` are pure functions that consume (Zod data schema) + (presentation config) and emit the JSON. They merge the `oneOf` branches into the single flat Apify `fields` map, recurse into nested object `properties`, collapse nullable `anyOf` to the non-null branch, and represent the `ContentField` union as the richer `ContentRef` object. This mirrors the existing `to-apify-schema.ts` boundary already used for the input schema.

## Scope

In:

- Expand `packages/schema/src/source-of-truth/output.ts` to a `z.discriminatedUnion('status', …)` modeling all three record shapes with full envelope fields.
- New presentation config `packages/schema/src/apify/output-views.ts`.
- New `packages/schema/src/apify/to-dataset-schema.ts` (move + rewrite the generator logic out of `tools/gen-input-schema`, export `toDatasetSchema`/`writeDatasetSchema`) and `to-output-schema.ts` (`toOutputSchema`/`writeOutputSchema`). Mirrors how `writeApifyInputSchema` already lives in the package.
- Slim `tools/gen-input-schema/src/main.ts` to orchestration: call the input, dataset, and output writers.
- Regenerate `apps/apify-actor/.actor/dataset_schema.json` and `output_schema.json`.
- Reconcile `apps/standalone/src/sinks.ts` dataset record with the Actor's shape (nest `metadata`, add `loadedAt` + `httpStatus`).
- Tests (lib + CLI + Actor) and doc/SPEC sync.

Out:

- `actor.json` stays hand-written (deploy metadata, not schema). Do not generate it.
- Do **not** plumb a real `httpStatus` through the crawler — keep the literal `200` and flag it (separate change; see Flagged findings).
- No Rust / napi-rs crate changes (`.claude/rules/native-addon-boundary.md`).
- `key_value_store_schema.json` generation is an **optional stretch** only (see Optional stretch); KVS keys are hash-prefixed, so `keyPrefix` grouping does not fit cleanly — do not force it.

## Prerequisites — read first

- `/Users/miroslavsekera/r/contextractor-ts/CLAUDE.md` and the rules it links: `minimal-diff`, `native-addon-boundary`, `spec-maintenance`, `test-maintenance`, `user-facing-docs`, `json-config-only`, `no-confirmation-prompts`, `apify-production`.
- `.claude/skills/apify-schemas/SKILL.md` — the dataset/output/KVS schema shapes and display formats.
- Source files: `packages/schema/src/source-of-truth/output.ts`, `…/input.ts`, `packages/schema/src/apify/to-apify-schema.ts`, `packages/schema/src/index.ts`, `tools/gen-input-schema/src/main.ts`, `apps/apify-actor/src/sinks.ts`, `apps/apify-actor/src/run.ts`, `apps/standalone/src/sinks.ts`, `packages/extraction/src/metadata.ts`, `packages/crawler/src/sinks/types.ts`, and `packages/crawler/src/createCrawler.ts` (for the exact `onFailedRequest`/`onSkippedUrl` info field types and nullability).
- The four files in `apps/apify-actor/.actor/`.
- Apify dataset schema spec: `https://docs.apify.com/platform/actors/development/actor-definition/dataset-schema`. Output schema spec: `https://docs.apify.com/platform/actors/development/actor-definition/output-schema`.
- Confirm the zod emit shapes before coding:

  ```bash
  cd packages/schema && node --input-type=module -e '
  import { z } from "zod";
  const U = z.discriminatedUnion("status", [
    z.object({ status: z.literal("success"), url: z.string() }),
    z.object({ status: z.literal("failed"),  url: z.string(), retryCount: z.number().int() }),
  ]);
  console.log(JSON.stringify(z.toJSONSchema(U, { target:"draft-07", unrepresentable:"any", reused:"inline" }), null, 2));
  '
  ```

## File-by-file changes

### `packages/schema/src/source-of-truth/output.ts` — discriminated union

Replace the single `z.object` with a discriminated union. Preserve the rs-trafilatura naming-convention header comment (extend it to note the three shapes). Keep `.describe()` on every field. Order success fields to match the runtime write order in `sinks.ts` (`url, loadedUrl, status, loadedAt, metadata, httpStatus, originalHash, crawl`, then content, then hashes) so the generated `fields` map and dataset preview read naturally.

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

const ContentRef = z.object({
  hash: z.string().describe('MD5 hex digest of the content'),
  length: z.number().int().describe('Byte length of the content'),
  key: z.string().optional().describe('Key-value store key'),
  url: z.string().optional().describe('Public URL to the key-value store item'),
});

const ContentField = z.union([
  ContentRef,
  z.string().describe('Inline string content when saveDestination includes "dataset"'),
]);

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
  originalHash: z.string().describe('MD5 hex digest of the raw page HTML'),
  crawl: Crawl,
  original: ContentField.optional().describe(
    'Raw page HTML captured before extraction. Present when "original" is in save.',
  ),
  txt: ContentField.optional().describe('Extracted plain text. Present when "txt" is in save.'),
  markdown: ContentField.optional().describe('Extracted Markdown. Present when "markdown" is in save.'),
  json: ContentField.optional().describe('Extracted structured JSON. Present when "json" is in save.'),
  html: ContentField.optional().describe('Cleaned extracted HTML. Present when "html" is in save.'),
  txtHash: z.string().optional().describe('MD5 hex of inline txt. Present when saveDestination includes "dataset".'),
  markdownHash: z.string().optional().describe('MD5 hex of inline markdown. Present when saveDestination includes "dataset".'),
  jsonHash: z.string().optional().describe('MD5 hex of inline json. Present when saveDestination includes "dataset".'),
  htmlHash: z.string().optional().describe('MD5 hex of inline html. Present when saveDestination includes "dataset".'),
});

const FailedRecord = z.object({
  url: z.string().describe('The original request URL'),
  loadedUrl: z.string().describe('The URL that was loaded before failure (post-redirect)'),
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

**Verify nullability before finalizing:** confirm the real types of `info.loadedUrl`, `info.errorMessages`, `info.retryCount` on `onFailedRequest`, and the `skipReason` union, against `packages/crawler/src/createCrawler.ts`. If `loadedUrl` can be `null`/absent on a failed record, make it `.nullable()` / `.optional()` accordingly — the schema must match what `run.ts` actually writes.

`packages/schema/src/index.ts` already does `export type ContextractorOutputType = z.infer<typeof ContextractorOutput>` — it becomes a 3-member union automatically. No other change needed there (no runtime consumer of the type exists).

### `packages/schema/src/apify/output-views.ts` (new) — presentation config

The single home for Apify presentation facts. The `overview` view name is defined once and reused by both the dataset views and the output schema.

```ts
/**
 * Apify presentation config for the dataset/output schemas. These are
 * UI concerns NOT derivable from the Zod data schema (column choice,
 * display formats, output link templates). The dataset/output schema
 * generators consume this alongside `ContextractorOutput`.
 */
export const OutputViews = {
  title: 'Output schema',
  views: {
    overview: {
      title: 'Overview',
      transformation: {
        fields: ['loadedUrl', 'httpStatus', 'metadata.title', 'metadata.lang'],
      },
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
    overview: {
      type: 'string',
      title: 'Overview',
      template: '{{links.apiDefaultDatasetUrl}}/items?view=overview',
    },
  },
} as const;
```

### `packages/schema/src/apify/to-dataset-schema.ts` (new) — the transformer

Pure functions, no I/O except the thin `write*` wrapper (matches `to-apify-schema.ts`). Merge the `oneOf` branches into one flat `fields` map; recurse into nested `properties`; collapse nullable `anyOf` to its non-null branch; represent the `ContentField` union as the `ContentRef` object (the richer KVS shape — Apify dataset `fields` accept nested `properties` under `type:'object'`). The only cross-branch key conflict in this schema is `status` (differing `const`s) → collapse to `{type:'string', enum:[…]}`.

```ts
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { OutputViews } from './output-views.js';

type JsonNode = Record<string, unknown>;
type Field = Record<string, unknown>;

export function toDatasetSchema(schema: z.ZodTypeAny, views = OutputViews) {
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

export function writeDatasetSchema(schema: z.ZodTypeAny, outPath: string): void {
  writeFileSync(outPath, `${JSON.stringify(toDatasetSchema(schema), null, 2)}\n`, 'utf8');
}

/** Merge every discriminated-union branch's properties into one flat map. */
function mergeBranchProperties(jsonSchema: JsonNode): Record<string, JsonNode> {
  const branches = Array.isArray(jsonSchema.oneOf)
    ? (jsonSchema.oneOf as JsonNode[])
    : [jsonSchema];
  const out: Record<string, JsonNode> = {};
  for (const branch of branches) {
    const props = (branch.properties as Record<string, JsonNode>) ?? {};
    for (const [name, node] of Object.entries(props)) {
      out[name] = name in out ? mergeNode(out[name], node) : node;
    }
  }
  return out;
}

/** The only real conflict is the `status` discriminator: collapse consts → enum. */
function mergeNode(a: JsonNode, b: JsonNode): JsonNode {
  if (a.const !== undefined && b.const !== undefined) {
    const values = [...new Set([a.const, b.const])];
    return { type: 'string', enum: values, description: a.description ?? b.description };
  }
  return a;
}

/**
 * Convert one JSON-Schema node into an Apify dataset field descriptor.
 * Recurses into object `properties`, collapses nullable `anyOf:[X,null]`
 * to X, and represents the ContentField union (`anyOf:[ContentRef, string]`)
 * as the richer ContentRef object. Leaf types: string, integer, number,
 * boolean, array, object, null.
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
  return {
    actorOutputSchemaVersion: 1,
    title: views.title,
    properties: views.output,
  };
}

export function writeOutputSchema(outPath: string): void {
  writeFileSync(outPath, `${JSON.stringify(toOutputSchema(), null, 2)}\n`, 'utf8');
}
```

### `packages/schema/src/index.ts`

Export the new functions and config alongside the existing ones:
`toDatasetSchema`, `writeDatasetSchema`, `toOutputSchema`, `writeOutputSchema`, `OutputViews`.

### `tools/gen-input-schema/src/main.ts` — slim to orchestration

Delete the local `writeDatasetSchema` (moved into the package). Import the writers from `@contextractor/schema` and call all three, each followed by the existing Biome-format step. Keep the repo-root resolution comment and the `process.argv[2]` override behavior for the input path.

```ts
import { ContextractorInput, ContextractorOutput, writeApifyInputSchema,
         writeDatasetSchema, writeOutputSchema } from '@contextractor/schema';
// …resolve repoRoot as today…
const actorDir = resolve(repoRoot, 'apps/apify-actor/.actor');
writeApifyInputSchema(ContextractorInput, resolve(actorDir, 'input_schema.json'), { title: 'Contextractor' });
writeDatasetSchema(ContextractorOutput, resolve(actorDir, 'dataset_schema.json'));
writeOutputSchema(resolve(actorDir, 'output_schema.json'));
// …biome format --write each output…
```

### `apps/standalone/src/sinks.ts` — match the Actor's dataset record

In the `toDataset` block (lines 55-72), nest `metadata` instead of spreading it, and add `loadedAt` + `httpStatus` so CLI and Actor records agree:

```ts
const record: Record<string, unknown> = {
  url: result.url,
  loadedUrl: result.loadedUrl,
  status: 'success',
  loadedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  metadata: result.metadata,
  httpStatus: 200,
  originalHash: result.rawHtmlHash,
  crawl: { depth: result.crawlDepth, referrerUrl: result.referrerUrl },
};
```

The per-format `record[fmt]` / `record[`${fmt}Hash`]` loop stays. This is a **breaking change** to the CLI dataset record (top-level `title`/`author`/… move under `metadata.`). Confirm acceptable, then update `apps/standalone/SPEC.md` accordingly (see Docs).

## Flagged findings — do NOT fix in this change

- **`httpStatus` hardcoded `200`** in both sinks. `ExtractionResult` (`packages/crawler/src/sinks/types.ts`) has no status field; the Playwright/adaptive handlers build results from `page.content()` and never read the navigation response. A real fix means adding `httpStatus` to `ExtractionResult`, sourcing it per crawler type at the three sink-call sites in `packages/crawler/src/handler.ts`, and updating both sinks — a separate, cross-package change. Keep `200`, document `httpStatus` as "currently always 200," and note it in the PR.
- **`crawledAt` vs `loadedAt`**: keep them distinct. Success records "loaded" (`loadedAt`); failed records never loaded (`crawledAt` = abandonment time). The dataset schema lists both as separate fields — correct. Do not rename.

## Optional stretch — `key_value_store_schema.json`

Only if explicitly desired. The Actor writes content blobs to KVS with hash-prefixed keys (`{hash}.txt`, `{hash}-original.html`, …). Apify KVS collections group by `keyPrefix` or `contentTypes`; the hash prefix means `keyPrefix` grouping does not fit. If added, group by `contentTypes` (e.g. `text/markdown`, `text/html`) and wire it into `actor.json` `storages.keyValueStore`. Otherwise skip and note it as future work.

## Tests

Add/update tests in the **same change** as the source (`.claude/rules/test-maintenance.md`). Use `ts-pro` for implementation and `apify-schemas` for schema conventions.

### Local — library (`packages/schema`, `packages/extraction`)

- **New `packages/schema/test/output.test.ts`** — `ContextractorOutput.parse(...)`:
  - a success record with **KVS-style** content refs (`{hash,length,key,url}`) parses;
  - a success record with **inline-string** content + the `*Hash` fields parses (exercises both `ContentField` union arms);
  - `metadata` with a mix of strings and `null`s, `crawl:{depth:0, referrerUrl:null}` parses;
  - a **failed** record (`status:'failed'`, `errorMessages`, `retryCount`, `crawledAt`) parses;
  - a **skipped** record (`status:'skipped'`, valid `skipReason`) parses; an invalid `skipReason` is rejected;
  - a record with an unknown `status` is rejected.
- **New `packages/schema/test/to-dataset-schema.test.ts`** — assert `toDatasetSchema(ContextractorOutput)` deep-equals the on-disk `apps/apify-actor/.actor/dataset_schema.json` (snapshot, mirroring `to-apify-schema.test.ts`), plus invariants: `fields.metadata.properties.title.type === 'string'` (nullable collapsed), `fields.metadata.properties.lang`, `fields.crawl.properties.depth.type === 'integer'`, `fields.txt.properties.hash.type === 'string'` (ContentRef chosen over string), `fields.status.enum` contains all three values, `fields.skipReason.type === 'string'`, `fields.errorMessages.type === 'array'`, and `views.overview.transformation.fields` unchanged. Add a `toOutputSchema()` deep-equal against `output_schema.json`. Assert determinism (two calls byte-identical) and a single trailing newline from the `write*` wrappers.
- **`packages/extraction`** — no API change; confirm the existing fixture tests in `packages/extraction/test/` and `projectMetadata` behavior still pass untouched.

### Local — standalone CLI + library API (`apps/standalone`)

- Update **`apps/standalone/src/sinks.test.ts`**: the metadata assertion must read `item.metadata.title` (was top-level `item.title`); add assertions for `item.loadedAt` (matches `/Z$/`) and `item.httpStatus === 200`. Keep the `crawl`, `url`, `loadedUrl`, `originalHash`, `{fmt}Hash` assertions.
- `apps/standalone/src/cli.test.ts` and `exitCode.test.ts` must stay green.
- **End-to-end CLI**: `pnpm -F @contextractor/standalone build` then `node apps/standalone/dist/cli.js https://example.com --max-pages 1 --save markdown --save-destination dataset` — confirm a dataset record with nested `metadata` and the new fields. (`@contextractor/standalone` is a CLI **and** a library — `exports['.']` is the programmatic API; a minimal `import { … } from '@contextractor/standalone'` smoke is enough since the sink is shared.)

### Local — Apify Actor (`apps/apify-actor`)

- Update **`apps/apify-actor/src/sinks.test.ts`** for any shape assertions touched by the schema (the sink object itself is unchanged; this is mostly confirming the success record still matches `SuccessRecord`).
- **Regenerate + diff**: run the generator (`pnpm -F @contextractor/gen-input-schema start`), then `git diff apps/apify-actor/.actor/` — the diff to `dataset_schema.json` (nested members, new fields) and `output_schema.json` (now generated) must be intentional and match the snapshot tests. The first run is the new committed baseline.
- **Full local gate** (also what the Apify build runs): `pnpm build`, `pnpm lint`, `pnpm test`, `cargo build --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`. All green.
- **Actor smoke**: `apify run` (or `mcpc @apify` call locally) with a tiny input (`{"startUrls":[{"url":"https://en.wikipedia.org/wiki/Web_scraping"}],"maxPagesPerCrawl":1,"save":["markdown"]}`); inspect the dataset item shape and confirm it validates against the new schema.

### Apify platform

Use `/platform:deploy-and-test` (deploys to the **test** actor `glueo/contextractor-test` by default; **never** production unless explicitly asked — `.claude/rules/apify-production.md`). It validates locally, `git push origin HEAD:dev`, waits for the Git-connected build, and runs a test crawl. Then verify on the platform:

- Build is `SUCCEEDED` — in particular **no `Invalid dataset schema` / `Invalid output schema`** build error (see the error table in `.claude/commands/platform/deploy-and-test.md`); these are the failure modes the new generated files could introduce.
- Apify Console → the run's **Storage/Output** tab renders the **Overview** view with the `metadata.title` and `metadata.lang` columns populated, and the generated `output_schema.json` "Overview" link resolves to `…/items?view=overview`.
- A sample dataset item carries the full success shape (`url`, `status:'success'`, `loadedAt`, nested `metadata`, `httpStatus`, `originalHash`, `crawl`, content + hashes).
- Optionally trigger a failed/skipped record (e.g. a 404 start URL, or `storeSkippedUrls:true` with a robots-blocked URL) and confirm those records and their fields appear.
- Report the build and run URLs.

## Verification — run from repo root, in order

- `pnpm install`
- `pnpm -F @contextractor/gen-input-schema start` → regenerates all three `.actor` JSON files; `git diff apps/apify-actor/.actor/` is intentional (commit as the new baseline).
- `pnpm build` · `pnpm lint` · `pnpm test` — all green; the new snapshot tests guard drift.
- `cargo build --workspace` · `cargo clippy --workspace --all-targets -- -D warnings` — green (unchanged).
- `apify run` smoke — produces a dataset item matching the schema.
- `/platform:deploy-and-test` — build `SUCCEEDED` on `glueo/contextractor-test`, test crawl produces ≥1 item, Output tab renders.

## Acceptance criteria

- `packages/schema` is the **only** place output fields and record shapes are declared; all three `.actor` schema JSON files are generated, none hand-edited (except `actor.json`, which stays hand-written).
- `dataset_schema.json` exposes nested `properties` for `metadata`, `crawl`, and the content `ContentRef`s, and enumerates every field across success/failed/skipped (incl. `url`, `status` enum, `originalHash`, per-format `*Hash`, `errorMessages`, `retryCount`, `crawledAt`, `skipReason`). The `views.overview` block is preserved.
- `output_schema.json` is generated from `OutputViews`; the `overview` name is defined once.
- The Apify presentation config lives in a typed `.ts` file, not hardcoded in the generator.
- Standalone CLI and Actor dataset success records have the same shape (nested `metadata`, `loadedAt`, `httpStatus`).
- All local tests/lints/builds pass; the platform build on `glueo/contextractor-test` is `SUCCEEDED` and the Output tab renders.
- `httpStatus`-real-status and any KVS schema remain explicitly flagged as out of scope.

## Constraints

- `.claude/rules/minimal-diff.md` — Edit, not Write, on existing files; no reformatting untouched files. The first generator run reflows/rewrites the two generated JSON files — commit that as the baseline; thereafter the snapshot tests keep the diff empty.
- `.claude/rules/spec-maintenance.md` + `.claude/rules/test-maintenance.md` — update SPECs and tests in the same change.
- `.claude/rules/native-addon-boundary.md` — no Rust/napi changes; `txt` stays `txt`.
- `.claude/rules/json-config-only.md`, `.claude/rules/no-confirmation-prompts.md`, `.claude/rules/user-facing-docs.md` (no deploy/internal notes in the public Actor README), `.claude/rules/apify-production.md` (test actor only).

## Docs to sync

- `packages/schema/SPEC.md` — output section: document the discriminated union and the three record shapes; revise the "additional envelope fields not declared in this schema" note (those fields are now declared).
- `apps/apify-actor/SPEC.md` — lines 28-34 already accurate; add a line that `dataset_schema.json`/`output_schema.json` are generated from `ContextractorOutput` + `OutputViews`.
- `apps/standalone/SPEC.md` — update the success-record description to nested `metadata` + `loadedUrl` + `loadedAt` + `httpStatus`.
- Root `SPEC.md` — output section: reflect the generated output schema and the standalone record change.
- `tools/gen-input-schema/README.md` (if present) — note it now emits all three `.actor` schema files.

## Suggested sequence

- Expand `output.ts` (discriminated union) → add `output-views.ts` → add `to-dataset-schema.ts` + `to-output-schema.ts` → export from `index.ts` → slim `main.ts`.
- Regenerate the `.actor` files; commit as baseline.
- Standalone sink + its test updates.
- New lib tests (`output.test.ts`, `to-dataset-schema.test.ts`).
- Docs/SPEC sync.
- Local gate → `apify run` smoke → `/platform:deploy-and-test`.
- Run `code-reviewer` over the diff before finishing.
