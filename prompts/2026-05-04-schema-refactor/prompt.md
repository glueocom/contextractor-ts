# Schema Refactor: Unified `save` and `saveDestination` Fields

## Context

Replace the four boolean save fields in the Actor input with a single `save` enum array (matching the CLI `--save` style) and a new Actor-only `saveDestination` field. Source of truth: `packages/schema/src/input.ts`.

Fields to remove:

- `saveRawHtmlToKeyValueStore`
- `saveExtractedTextToKeyValueStore`
- `saveExtractedJsonToKeyValueStore`
- `saveExtractedMarkdownToKeyValueStore`

## Skills and Agents

- `ts-pro` — TypeScript implementation
- `apify-schemas` — Schema conventions reference

## Files to Change

### `packages/schema/src/input.ts`

Remove the four boolean save fields (lines 171–204). In their place add two fields under `sectionCaption: 'Output settings'`:

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
        'TXT — plain text, whitespace-normalized',
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
  .map((f) => f as OutputFormat);
if (formats.length === 0) formats.push('markdown');
```

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

### `apps/standalone/src/config.ts`

No changes needed. The CLI resolves formats through `CliOnlyOverrides.save` and `validateSaveFormats` (which also handles `jsonl` and `all`). The shared schema `save` field applies when a JSON config file is used.

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
