# Schema Refactor: Unified `save` and `saveDestination` Fields

> **TLDR**: Replaces five individual boolean save fields with a unified `save` enum array and a new `saveDestination` field. Adds `original` as a saveable format, restructures `packages/schema/src/` into subdirectories, and generates an output Zod schema.

## Context

Replace the five boolean save fields in the Actor input with a single `save` enum array (matching the CLI `--save` style) and a new Actor-only `saveDestination` field. Add `original` as a new saveable format for raw page HTML. The `txt` format identifier is NOT renamed — `txt` is the canonical plain-text format name across all layers. Source of truth: `packages/schema/src/input.ts`.

The npm package (`@contextractor/standalone`) is both a CLI tool and a Node.js library — it exports a programmatic API in addition to the binary.

No backward compatibility is required. Break any existing API, CLI flags, Actor input, or Docker interface without hesitation — this is a clean cut.

Fields to remove:

- `saveRawHtmlToKeyValueStore`
- `saveExtractedTextToKeyValueStore`
- `saveExtractedJsonToKeyValueStore`
- `saveExtractedMarkdownToKeyValueStore`
- `saveExtractedHtmlToKeyValueStore`

## Add `original` Format

Add `original` as a saveable format that writes raw Playwright-captured HTML (bypasses Trafilatura). The `txt` identifier is not renamed — it remains the canonical plain-text format name.

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

Remove the five boolean save fields (lines 171–212). In their place add two fields under `sectionCaption: 'Output settings'`:

```ts
save: z
  .array(z.enum(['txt', 'markdown', 'json', 'html', 'original']))
  .default(['markdown'])
  .describe(
    'Output formats to extract and save. "original" saves the raw page HTML before extraction.',
  )
  .meta({
    title: 'Save formats',
    ...apifyMeta({
      editor: 'select',
      enumTitles: [
        'Txt — plain text, whitespace-normalized',
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
const formats: OutputFormat[] = input.save.filter((f) => f !== 'original') as OutputFormat[];
if (formats.length === 0) formats.push('markdown');
```

### `apps/apify-actor/src/sinks.ts`

No rename needed — `txt` stays.

Original and destination handling:
- Rename `ApifySinkOpts.saveHtml` → `saveOriginal`; update interface, destructure, and KVS key from `${keyBase}-raw.html` → `${keyBase}-original.html`.
- Add `saveDestination: string[]` to `ApifySinkOpts`.
- When `saveDestination` includes `'dataset'`: write content as string fields directly on `data` (the dataset item) instead of saving to KVS.
- When `saveDestination` includes `'key-value-store'` (default): keep existing KVS behavior.

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

Update `--save` help: `markdown,html,txt,json,jsonl,all` → `markdown,html,txt,json,jsonl,original,all`

### `apps/standalone/src/config.ts`

`'txt'` is the canonical plain-text format — do not rename it. Add `'original'`:

- `SaveFormat` type: add `'original'`
- `SORTED_SAVE_FORMATS`: add `'original'`
- `isSaveFormat`: add `case 'original':`
- Remove the existing `'text'`→`'txt'` alias (`if (normalized === 'text') normalized = 'txt'`) — `'text'` is not a valid format name
- Update error messages to list current valid formats including `'original'`

### `apps/standalone/src/sinks.ts`

Add `original` handling — no rename needed, `result.formats.txt` stays as is:

- Add `original` handling in `createCliSink`: when `'original'` is in formats, add a sink that writes the raw page HTML captured before Trafilatura (not `result.formats.html`, which is cleaned extracted HTML) to `${slug}-raw.html` in `outDir` (no metadata header, raw bytes)

### `apps/standalone/src/cli.test.ts`

- `validateSaveFormats(['txt'])` → expect `['txt']` (valid)
- `validateSaveFormats(['text'])` → expect it to throw (`'text'` is not a valid format; alias removed)
- Expand `all` expansion test: include `'txt'` and `'original'`

