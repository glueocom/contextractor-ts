# Schema Refactor: Unified `save` and `saveDestination` Fields

## Context

Replace the four boolean save fields in the Actor input with a single `save` enum array (matching the CLI `--save` style) and a new Actor-only `saveDestination` field. Source of truth: `packages/schema/src/input.ts`.

The npm package (`@contextractor/standalone`) is both a CLI tool and a Node.js library — it exports a programmatic API in addition to the binary.

No backward compatibility is required. Break any existing API, CLI flags, Actor input, or Docker interface without hesitation — this is a clean cut.

Fields to remove:

- `saveRawHtmlToKeyValueStore`
- `saveExtractedTextToKeyValueStore`
- `saveExtractedJsonToKeyValueStore`
- `saveExtractedMarkdownToKeyValueStore`

## Parameter and Naming Review

Before finalizing any schema field, CLI flag, or dataset property, audit every name against May 2026 industry standards and API design best practices:

- Are names consistent across the input schema, CLI flags, and dataset output?
- Do names follow the dominant convention for the context (camelCase for JSON/TS, kebab-case for CLI flags)?
- Are names unambiguous, self-documenting, and free of abbreviations that have clearer alternatives?
- Are enum values lowercase and hyphen-separated where appropriate?
- Are boolean field names framed as positive assertions (avoid `disableX` — prefer `skipX` or restructure)?
- Are grouped concepts named with a consistent prefix or suffix?

Rename any field that fails this review. No backward compatibility is required.

## Skills and Agents

- `ts-pro` — TypeScript implementation
- `apify-schemas` — Schema conventions reference

## Files to Change

### `packages/schema/` — Folder Restructure

Reorganise `packages/schema/src/` as follows — `index.ts` stays at `src/` root; everything else moves into subfolders:

- `src/source-of-truth/` — all Zod source-of-truth definitions: `input.ts`, and the new output schema file (see below). These files are the canonical definitions that drive type inference and schema generation.
- `src/apify/` — Apify-specific utilities: `apify-meta.ts`, `to-apify-schema.ts`.

Update all import paths in the package and in consumers after the move.

### `packages/schema/src/source-of-truth/output.ts` (new)

Add a Zod source-of-truth for the Apify Actor dataset output schema. Each dataset item represents one extracted page. Field names must align with the naming conventions of the `rs-trafilatura` fork at https://github.com/Murrough-Foley/rs-trafilatura — read that repository's output structures before naming any field. Cross-check with the upstream Python trafilatura metadata fields (`title`, `author`, `url`, `hostname`, `description`, `sitename`, `date`, `categories`, `tags`, `fingerprint`, `id`, `license`, `text`, `comments`).

Also generate `apps/apify-actor/.actor/dataset_schema.json` from this Zod definition (add a gen step or extend the existing `gen-input-schema` tool).

### `packages/schema/src/input.ts`

Remove the four boolean save fields (lines 171–204). In their place add two fields under `sectionCaption: 'Output settings'`:

```ts
save: z
  .array(z.enum(['text', 'markdown', 'json', 'html', 'original']))
  .default(['markdown'])
  .describe(
    'Output formats to extract and save. "original" saves the raw page HTML before extraction.',
  )
  .meta({
    title: 'Save formats',
    ...apifyMeta({
      editor: 'select',
      enumTitles: [
        'Text — plain text, whitespace-normalized',
        'Markdown — human-readable markup, suitable for LLM consumption',
        'JSON — structured data with metadata',
        'HTML — cleaned extracted content',
        'Original — raw page HTML',
      ],
      sectionCaption: 'Output settings',
    }),
  }),

saveDestination: z
  .array(z.enum(['key-value-store', 'dataset']))
  .default(['key-value-store'])
  .describe(
    'Where to save extracted content. Actor-only — the CLI always saves to disk.',
  )
  .meta({
    title: 'Save to',
    ...apifyMeta({
      editor: 'select',
      enumTitles: ['Key-value store', 'Dataset'],
    }),
  }),
```

### `apps/apify-actor/src/config.ts`

Replace the four-boolean format derivation (lines 22–26) with:

```ts
const formats: OutputFormat[] = input.save
  .filter((f) => f !== 'original')
  .map((f) => (f === 'text' ? 'txt' : f) as OutputFormat);
if (formats.length === 0) formats.push('markdown');
```

The schema uses `'text'` (user-facing); the internal `OutputFormat` still uses `'txt'`. Map at the boundary.

### `apps/apify-actor/src/sinks.ts`

- Add `html` to `FORMAT_SPECS`:
  ```ts
  { format: 'html', dataKey: 'extractedHtml', contentType: 'text/html; charset=utf-8', ext: 'html' },
  ```
- Rename `ApifySinkOpts.saveHtml` → `saveOriginal`; update interface, destructure, and KVS key from `${keyBase}-raw.html` → `${keyBase}-original.html`.
- Add `saveDestination: string[]` to `ApifySinkOpts`.
- When `saveDestination` includes `'dataset'`: write content as string fields directly on `data` (the dataset item) instead of saving to KVS. Keep KVS save when `saveDestination` includes `'key-value-store'` (default behavior).

### `apps/apify-actor/src/run.ts`

Update the `createApifySink` call:

```ts
const sink = createApifySink({
  kvs,
  dataset,
  saveOriginal: input.save.includes('original'),
  saveDestination: input.saveDestination,
});
```

### `apps/standalone/src/cliProgram.ts`

Remove the redundant `--format` option (it is an alias of `--save`):

- Delete the `.option('--format <fmt>', ...)` line (~line 26)
- Delete the `opts.format` handling block (~lines 270–271)
- Delete the `format?: string` field from the options type (~line 313)

### `apps/standalone/src/config.ts`

Rename `'txt'` → `'text'` throughout to match the schema enum:

- `SaveFormat` type: `'txt'` → `'text'`
- `SORTED_SAVE_FORMATS`: replace `'txt'` with `'text'`
- `isSaveFormat`: `case 'txt':` → `case 'text':`
- `validateSaveFormats`: remove the `normalized === 'text' → 'txt'` alias line — `'text'` is now the canonical value, not a normalised alias

## Example Projects

Create the following examples under `examples/`. Each must be self-contained and runnable. The `saveDestination` field applies only to Apify Actor invocations — do not include it in npm, Docker, or library examples.

### `examples/library-ts/`

Node.js TypeScript project consuming `@contextractor/standalone` as a library (programmatic API, not the CLI binary). Include `package.json`, `tsconfig.json`, and `src/main.ts`. The example should extract content from a URL and print the result to stdout. No `saveDestination`.

### `examples/cli-npm/`

Folder containing `run.sh` — shell script invoking the `contextractor` CLI from the installed npm package. Show basic usage: one URL, `--save markdown`, `--output-dir ./out`. No `saveDestination`.

### `examples/cli-docker/`

Folder containing `run.sh` — shell script invoking Contextractor via the Docker CLI. Use `docker run` with the published image. Pass URL and save flags as Docker command arguments. No `saveDestination`.

### `examples/docker-api-ts/`

Node.js TypeScript project calling Contextractor via the Docker Engine API (no CLI). Use the Docker socket to start a container, pass input, and collect output. Include `package.json`, `tsconfig.json`, and `src/main.ts`. No `saveDestination`.

### `examples/apify-api-ts/`

Node.js TypeScript project calling the test Apify actor (`glueo/contextractor-test`) via the Apify API. Use the `apify-client` npm package. Start a run, wait for it to finish, and retrieve dataset results. Include `package.json`, `tsconfig.json`, and `src/main.ts`. Pass `saveDestination: ['dataset']` in the actor input to demonstrate dataset output.

### `examples/cli-apify/`

Folder containing `run.sh` — shell script calling `glueo/contextractor-test` via the Apify CLI (`apify call`). Pass actor input as JSON including `saveDestination`.

## After Implementation

- Regenerate `input_schema.json`:
  ```bash
  pnpm --filter @contextractor/gen-input-schema start
  ```
- Update schema snapshot:
  ```bash
  pnpm test -- --update-snapshots
  ```
  Snapshot test: `packages/schema/test/to-apify-schema.test.ts`
- Verify:
  ```bash
  pnpm build && pnpm lint && pnpm test
  ```
