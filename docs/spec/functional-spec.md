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
- **TypeScript engine** (`@contextractor/engine`) — embedded library used by
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

| Option                              | Description                                                    |
| ----------------------------------- | -------------------------------------------------------------- |
| `--config`, `-c`                    | Path to JSON config file (optional)                            |
| `--output-dir`, `-o`                | Output directory                                               |
| `--max-pages`                       | Max pages to crawl (0 = unlimited)                             |
| `--crawl-depth`                     | Max link depth from start URLs (0 = start only)                |
| `--headless` / `--no-headless`      | Browser headless mode (default: headless)                      |
| `--save`                            | Output formats: `markdown,html,text,json,jsonl,all`            |
| `--precision`                       | High precision mode (less noise)                               |
| `--recall`                          | High recall mode (more content)                                |
| `--fast`                            | Fast extraction mode (less thorough)                           |
| `--no-links`                        | Exclude links from output                                      |
| `--no-comments`                     | Exclude comments from output                                   |
| `--include-tables` / `--no-tables`  | Include tables (default: include)                              |
| `--include-images`                  | Include image descriptions                                     |
| `--include-formatting` / `--no-formatting` | Preserve formatting (default: preserve)                |
| `--deduplicate`                     | Deduplicate extracted content                                  |
| `--target-language`                 | Filter by language (e.g. `en`)                                 |
| `--with-metadata` / `--no-metadata` | Extract metadata along with content                            |
| `--verbose`, `-v`                   | Enable verbose logging                                         |

### Config file (optional, JSON)

| Field             | Type    | Default        | Description                                |
| ----------------- | ------- | -------------- | ------------------------------------------ |
| urls              | array   | `[]`           | URLs to extract content from               |
| maxPages          | integer | `0`            | Max pages to crawl (0 = unlimited)         |
| outputDir         | string  | `./output`     | Directory for extracted content            |
| crawlDepth        | integer | `0`            | How deep to follow links (0 = start only)  |
| headless          | boolean | `true`         | Browser headless mode                      |
| save              | array   | `["markdown"]` | Output formats list                        |
| trafilaturaConfig | object  | `{}`           | Extraction options (see below)             |

Config merge order: `defaults → config file (if provided) → CLI args`.

YAML config files are accepted silently for backward compatibility; new
documentation references JSON only.

### Output

One file per crawled page, named from a URL slug
(e.g. `example-com-page.md`). When metadata is available, a header (title,
author, date, URL) is prepended to text-format outputs.

## Apify Actor

### Input

| Field                                 | Type    | Default    | Description                                |
| ------------------------------------- | ------- | ---------- | ------------------------------------------ |
| startUrls                             | array   | required   | URLs to extract content from               |
| linkSelector                          | string  | `""`       | CSS selector for links to enqueue          |
| globs                                 | array   | `[]`       | Glob patterns to include                   |
| excludes                              | array   | `[]`       | Glob patterns to exclude                   |
| maxPagesPerCrawl                      | integer | `0`        | Max pages (0 = unlimited)                  |
| saveRawHtmlToKeyValueStore            | boolean | `false`    | Save raw HTML to KV store                  |
| saveExtractedTextToKeyValueStore      | boolean | `false`    | Save plain text                            |
| saveExtractedJsonToKeyValueStore      | boolean | `false`    | Save JSON with metadata                    |
| saveExtractedMarkdownToKeyValueStore  | boolean | `true`     | Save Markdown                              |
| trafilaturaConfig                     | object  | `{}`       | Extraction options (see below)             |
| initialCookies                        | array   | `[]`       | Pre-set cookies (encrypted)                |
| customHttpHeaders                     | object  | `{}`       | Custom HTTP headers                        |

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
