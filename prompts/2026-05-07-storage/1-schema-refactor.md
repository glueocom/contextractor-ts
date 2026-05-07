# Schema Refactor: Unified `save` and `saveDestination` Fields

## Context

Replace the four boolean save fields in the Actor input with a single `save` enum array (matching the CLI `--save` style) and a new Actor-only `saveDestination` field. As part of this, rename the `txt` format identifier to `text` across the full stack (Rust → TypeScript → CLI → Actor) and add `original` as a new saveable format for raw page HTML. Source of truth: `packages/schema/src/input.ts`.

The npm package (`@contextractor/standalone`) is both a CLI tool and a Node.js library — it exports a programmatic API in addition to the binary.

No backward compatibility is required. Break any existing API, CLI flags, Actor input, or Docker interface without hesitation — this is a clean cut.

Fields to remove:

- `saveRawHtmlToKeyValueStore`
- `saveExtractedTextToKeyValueStore`
- `saveExtractedJsonToKeyValueStore`
- `saveExtractedMarkdownToKeyValueStore`

## Format Rename: `txt` → `text`; Add `original` Format

Rename the `txt` format identifier to `text` across the full stack. Add `original` as a saveable format that writes raw Playwright-captured HTML (bypasses Trafilatura). No backward compatibility — `txt` is removed entirely.

**Scope**: Rust output string (`lib.rs`), TypeScript `OutputFormat` type, `SaveFormat` in CLI, all sinks, CLI help text, tests, Actor schema, Apify sinks.

## Parameter and Naming Review

Before finalizing any schema field, CLI flag, or dataset property, audit every name against May 2026 industry standards and API design best practices:

- Are names consistent across the input schema, CLI flags, and dataset output?
- Do names follow the dominant convention for the context (camelCase for JSON/TS, kebab-case for CLI flags)?
- Are names unambiguous, self-documenting, and free of abbreviations that have clearer alternatives?
- Are enum values lowercase and hyphen-separated where appropriate?
- Are boolean field names framed as positive assertions (avoid `disableX` — prefer `skipX` or restructure)?
- Are grouped concepts named with a consistent prefix or suffix?

Rename any field that fails this review. No backward compatibility is required.

## Format Rename: File-by-File

### `packages/extraction/src/index.ts`

Do not modify the Rust wrapper — it follows `rs-trafilatura` naming and keeps `"txt"` as the format string. Translate at the TypeScript boundary, immediately after the native call returns, before the value propagates to any other layer.

- Where the native result contains `format: "txt"`, remap it to `"text"`.
- `OutputFormat = 'txt' | 'markdown' | 'json' | 'html'` → `'text' | 'markdown' | 'json' | 'html'`
- `DEFAULT_FORMATS = ['txt', ...]` → `['text', ...]`
- `opts.format ?? 'txt'` → `?? 'text'`; when passing the format down to the native call, map `'text'` back to `'txt'` so the wrapper receives a value it recognises.
- `isOutputFormat(value.format) ? value.format : 'txt'` → `: 'text'`
- `createEmptyResultMap()`: `txt: { content: '', format: 'txt' }` → `text: { content: '', format: 'text' }`

### `packages/extraction/src/index.test.ts`
- `['txt', 'markdown', 'json', 'html']` → `['text', 'markdown', 'json', 'html']` (assertions)
- `Object.keys(result).sort()` expected values: replace `'txt'` with `'text'`

### `packages/crawler/src/sinks/file.ts`
- `FORMAT_EXTENSIONS: { txt: '.txt', ... }` → `{ text: '.txt', ... }` (file extension stays `.txt`)

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
const formats: OutputFormat[] = input.save.filter((f) => f !== 'original') as OutputFormat[];
if (formats.length === 0) formats.push('markdown');
```

### `apps/apify-actor/src/sinks.ts`

Format rename and new entries:
- `{ format: 'txt', dataKey: 'extractedText', ... }` → `{ format: 'text', ... }`
- Add `html` to `FORMAT_SPECS`:
  ```ts
  { format: 'html', dataKey: 'extractedHtml', contentType: 'text/html; charset=utf-8', ext: 'html' },
  ```

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

Update `--save` help: `markdown,html,txt,json,jsonl,all` → `markdown,html,text,json,jsonl,original,all`

### `apps/standalone/src/config.ts`

Rename `'txt'` → `'text'` throughout to match the schema enum:

- `SaveFormat` type: add `'original'`; replace `'txt'` with `'text'`
- `SORTED_SAVE_FORMATS`: add `'original'`; replace `'txt'` with `'text'`
- `isSaveFormat`: `case 'txt':` → `case 'text':`; add `case 'original':`
- `validateSaveFormats`: remove any alias handling — `'txt'` is no longer accepted
- Update error messages to list current valid formats

### `apps/standalone/src/sinks.ts`

Rename and extend format handling:

- `result.formats.markdown ?? result.formats.txt` → `result.formats.markdown ?? result.formats.text`
- Add `original` handling in `createCliSink`: when `'original'` is in formats, add a sink that writes the raw page HTML captured before Trafilatura (not `result.formats.html`, which is cleaned extracted HTML) to `${slug}-raw.html` in `outDir` (no metadata header, raw bytes)

### `apps/standalone/src/cli.test.ts`

- Format-list expectations: `'txt'` → `'text'` throughout
- `validateSaveFormats(['text'])` → expect `['text']`
- Update: `validateSaveFormats(['txt'])` should throw an error (no alias)
- `FORMAT_EXTENSIONS` keys: `'txt'` → `'text'`
- Expand `all` expansion test: include `'text'` and `'original'`

