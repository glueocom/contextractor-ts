# Contextractor — Functional Specification

## Overview

Contextractor crawls websites and extracts clean, readable main-content text.
Built on **`rs-trafilatura`** (Rust port of Trafilatura, accessed via a napi-rs
binding) and **[Crawlee](https://crawlee.dev/)** (TypeScript crawler driving
Playwright).

Available as:

- **Apify Actor** — `glueo/contextractor` on the Apify platform; output saved
  to the run's Key-Value Store + Dataset.
- **Standalone CLI** (`@contextractor/standalone`) — local TypeScript CLI;
  output written to disk as one file per page.
- **TypeScript engine** (`@contextractor/extraction`) — embedded library used by
  both surfaces above; exposes `ContentExtractor`, `extractMetadata`, and
  `extractAllFormats`.

Supported output formats: **`txt | markdown | json | html`**. XML and XML-TEI
are temporarily unsupported pending upstream `rs-trafilatura` work — the
Python source supported them via Trafilatura.

## Standalone CLI

### Usage

```bash
contextractor [OPTIONS] [URLS...]
```

```bash
contextractor https://example.com
contextractor https://example.com --precision --save json -o ./results
contextractor --config config.json --max-pages 10
```

The full flag list is in
[`apps/standalone/README.md`](../../apps/standalone/README.md#usage)
— the table there is generated from the Commander program in
`apps/standalone/src/cli.ts` by `@contextractor/gen-md-regions`,
so it is always in sync with the binary.

### Config file (optional, JSON)

The standalone CLI accepts a JSON config file with the same camelCase shape
as the
[Apify input schema](../../apps/apify-actor/README.md#input). The
file is validated against the Zod 4 schema in `@contextractor/schema`;
unknown keys are stripped by `parse()`. CLI-only orchestration flags
(`--output-dir`, `--save`, `--proxy-urls`) are not accepted in the config
file — pass them on the command line.

Config merge order: `config file → CLI args → ContextractorInput.parse()`.
Defaults come from the Zod schema's `.default(...)` calls.

YAML config files are accepted silently for backward compatibility; new
documentation references JSON only.

### Output

One file per crawled page, named from a URL slug
(e.g. `example-com-page.md`). When metadata is available, a header (title,
author, date, URL) is prepended to text-format outputs.

## Apify Actor

### Input

The full input surface is the Zod 4 schema in `@contextractor/schema`; it is
generated from that schema at build time by `@contextractor/gen-input-schema`
into `apps/apify-actor/.actor/input_schema.json`. The
[`apps/apify-actor/README.md`](../../apps/apify-actor/README.md#input)
table is auto-rebuilt from the same schema by `@contextractor/gen-md-regions`
and is the canonical reference.

### `trafilaturaConfig`

| Field             | Type    | Default | Description                              |
| ----------------- | ------- | ------- | ---------------------------------------- |
| fast              | boolean | `false` | Fast mode (less thorough)                |
| favorPrecision    | boolean | `false` | High precision, less noise               |
| favorRecall       | boolean | `false` | High recall, more content                |
| includeComments   | boolean | `true`  | Include comments                         |
| includeTables     | boolean | `true`  | Include tables                           |
| includeImages     | boolean | `false` | Include images                           |
| includeFormatting | boolean | `true`  | Preserve formatting                      |
| includeLinks      | boolean | `true`  | Include links                            |
| deduplicate       | boolean | `false` | Deduplicate content                      |
| targetLanguage    | string  | `null`  | Target language code                     |
| withMetadata      | boolean | `true`  | Forward-compat — always extracted        |
| onlyWithMetadata  | boolean | `false` | Only return if metadata found            |
| teiValidation     | boolean | `false` | Forward-compat — accepted but ignored    |

Backward compatibility:

- `{}` or omitted = balanced default
- `{"favorPrecision": true}` = high precision mode
- `{"favorRecall": true}` = high recall mode

Keys accept both camelCase (JSON convention) and snake_case (Python
convention); snake_case is converted internally.

### Output

#### Dataset entry

```json
{
  "loadedUrl": "https://example.com/page",
  "rawHtml": {
    "hash": "...",
    "length": 89898,
    "key": "abc123-raw.html",
    "url": "https://api.apify.com/v2/key-value-stores/{id}/records/abc123-raw.html"
  },
  "extractedMarkdown": {
    "key": "abc123.md",
    "url": "...",
    "hash": "...",
    "length": 6887
  },
  "loadedAt": "2026-04-27T18:58:36Z",
  "metadata": {
    "title": "Page Title",
    "author": null,
    "publishedAt": "2024-01-15",
    "description": "Meta description",
    "siteName": "Example Site",
    "lang": "en"
  },
  "httpStatus": 200
}
```

Rules:

- `rawHtml`: always has `hash` + `length`; adds `key` + `url` only if raw HTML
  is saved.
- `extractedMarkdown`, `extractedText`, `extractedJson`: each present only when
  the matching input flag is enabled.
- `metadata`: extracted via the napi-rs binding from `rs-trafilatura`.

#### Key-Value Store

Files stored with MD5-based keys derived from the URL:

- `{hash}-raw.html` — raw HTML
- `{hash}.txt` — plain text
- `{hash}.json` — JSON with metadata
- `{hash}.md` — Markdown
