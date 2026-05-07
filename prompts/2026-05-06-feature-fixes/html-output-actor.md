# Add `html` output format to the Apify Actor

## Context

The extraction engine and standalone CLI both support `html` as an `OutputFormat`, but the Apify Actor has no `saveExtractedHtmlToKeyValueStore` schema field and never requests html extraction. The audit (`autonomous-task-output/todo/sync-gui/prompts/sync-gui-prompt.md` Issue 3) flagged this.

This prompt implements Option A: add extracted-html output on the Actor side with full parity to the existing `txt`, `json`, and `markdown` flows. The new field is independent of `saveRawHtmlToKeyValueStore` — that flag saves the entire un-extracted page HTML, while this flag saves the trafilatura-extracted HTML content.

## Skills and Agents

- `ts-pro` — TypeScript implementation

## Files to Change

### `packages/schema/src/input.ts`

Add `saveExtractedHtmlToKeyValueStore` after `saveExtractedMarkdownToKeyValueStore`. Pattern is identical to the adjacent fields; no `sectionCaption` needed (inherits `'Output settings'` from `saveRawHtmlToKeyValueStore` above):

```ts
saveExtractedHtmlToKeyValueStore: z
  .boolean()
  .default(false)
  .describe(
    'If enabled, the crawler extracts HTML from all pages, saves it to the key-value store, and includes the URL link in the dataset output.',
  )
  .meta({ title: 'Save extracted HTML to key-value store' }),
```

### `apps/apify-actor/src/config.ts`

In the `formats` building block inside `buildCrawlerOpts`, add the html push after the markdown check and before the fallback:

```ts
if (input.saveExtractedTextToKeyValueStore) formats.push('txt');
if (input.saveExtractedJsonToKeyValueStore) formats.push('json');
if (input.saveExtractedMarkdownToKeyValueStore) formats.push('markdown');
if (input.saveExtractedHtmlToKeyValueStore) formats.push('html');
if (formats.length === 0) formats.push('markdown');
```

### `apps/apify-actor/src/sinks.ts`

Add the `html` entry to `FORMAT_SPECS` after the `markdown` entry:

```ts
{
  format: 'html',
  dataKey: 'extractedHtml',
  contentType: 'text/html; charset=utf-8',
  ext: 'html',
},
```

`run.ts` does not need to change — the sink already iterates `FORMAT_SPECS` and saves any format whose content is present in `ExtractionResult.formats`.

### `apps/apify-actor/.actor/dataset_schema.json`

Add `extractedHtml` after `extractedJson`:

```json
"extractedHtml": {
  "type": "object",
  "title": "Extracted HTML",
  "description": "Info about extracted HTML content"
},
```

## After Implementation

Regenerate the Apify input schema (the schema test compares generated output to the on-disk file, so this must run before `pnpm test` passes):

```bash
pnpm --filter @contextractor/gen-input-schema start
```

Build, lint, and test:

```bash
pnpm build && pnpm lint && pnpm test
```

## Out of Scope

- Adding a `--save-html` or `--extracted-html` flag to the standalone CLI. The standalone already supports `--save html` via the existing `validateSaveFormats` path; no code changes needed there.
- Changing the `saveRawHtmlToKeyValueStore` / `saveHtml` behavior. That flag and the `extractedHtml` flag are independent.
