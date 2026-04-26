# Contextractor - Functional Specification

## Overview

Contextractor crawls websites and extracts clean, readable content using `rs-trafilatura` (the Rust port of Trafilatura). Available as:

- **Standalone CLI** — local TypeScript tool, content saved as files to disk
- **Apify Actor** — cloud platform, content stored in Key-Value Store + Dataset
- **Web Playground** ([contextractor.com](https://contextractor.com)) — configure extraction settings, preview results, and generate CLI/Apify commands

---

## Standalone CLI

### Installation

The CLI ships from this monorepo via `pnpm`. After `pnpm install` from the repo root:

```bash
pnpm -F @contextractor/standalone build
node apps/contextractor-standalone/dist/cli.js https://example.com
```

### CLI Usage

```bash
contextractor [OPTIONS] [URLS...]
```

Works with zero config — just pass URLs directly:

```bash
contextractor https://example.com
contextractor https://example.com --precision --save json -o ./results
contextractor --config config.json --max-pages 10
```

| Option | Description |
|--------|-------------|
| `--config`, `-c` | Path to JSON config file (optional) |
| `--output-dir`, `-o` | Output directory |
| `--max-pages` | Max pages to crawl (0 = unlimited) |
| `--crawl-depth` | Max link depth from start URLs (0 = start only) |
| `--headless` / `--no-headless` | Browser headless mode (default: headless) |
| `--save` | Output formats, comma-separated: markdown, html, text, json, jsonl, all (default: markdown) |
| `--precision` | High precision mode (less noise) |
| `--recall` | High recall mode (more content) |
| `--fast` | Fast extraction mode (less thorough) |
| `--no-links` | Exclude links from output |
| `--no-comments` | Exclude comments from output |
| `--include-tables` / `--no-tables` | Include tables (default: include) |
| `--include-images` | Include image descriptions |
| `--include-formatting` / `--no-formatting` | Preserve formatting (default: preserve) |
| `--deduplicate` | Deduplicate extracted content |
| `--target-language` | Filter by language (e.g. "en") |
| `--with-metadata` / `--no-metadata` | Extract metadata (default: with) |
| `--verbose`, `-v` | Enable verbose logging |

### Config File (optional, JSON)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| urls | array | [] | URLs to extract content from |
| maxPages | integer | 0 | Max pages to crawl (0 = unlimited) |
| outputDir | string | "./output" | Directory for extracted content |
| crawlDepth | integer | 0 | How deep to follow links (0 = start URLs only) |
| headless | boolean | true | Browser headless mode |
| save | array | ["markdown"] | Output formats: markdown, html, text, json, jsonl, all |
| trafilaturaConfig | object | {} | TrafilaturaConfig options (see below) |

Config merge order: `defaults → config file (if provided) → CLI args`

### Output

One file per crawled page, named from URL slug (e.g. `example-com-page.md`). Metadata header (title, author, date, URL) included when available.

---

## Apify Actor

### Input

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| startUrls | array | required | URLs to extract content from |
| linkSelector | string | "" | CSS selector for links to enqueue |
| globs | array | [] | Glob patterns to match enqueued links |
| excludes | array | [] | Glob patterns to exclude |
| maxPagesPerCrawl | integer | 0 | Max pages (0 = unlimited) |
| saveRawHtmlToKeyValueStore | boolean | false | Save raw HTML |
| saveExtractedTextToKeyValueStore | boolean | false | Extract plain text |
| saveExtractedJsonToKeyValueStore | boolean | false | Extract JSON with metadata |
| saveExtractedMarkdownToKeyValueStore | boolean | true | Extract Markdown |
| trafilaturaConfig | object | {} | rs-trafilatura extraction options (see below) |
| initialCookies | array | [] | Pre-set cookies for authentication (encrypted) |
| customHttpHeaders | object | {} | Custom HTTP headers for all requests |

### trafilaturaConfig

Extraction options used by both the Apify Actor and standalone CLI (`trafilaturaConfig` key in config file). When empty `{}` or omitted, uses balanced defaults.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| fast | boolean | false | Fast mode (less thorough) |
| favorPrecision | boolean | false | High precision, less noise |
| favorRecall | boolean | false | High recall, more content |
| includeComments | boolean | true | Include comments |
| includeTables | boolean | true | Include tables |
| includeImages | boolean | false | Include images |
| includeFormatting | boolean | true | Preserve formatting |
| includeLinks | boolean | true | Include links |
| deduplicate | boolean | false | Deduplicate content |
| targetLanguage | string | null | Target language code |
| withMetadata | boolean | true | Extract metadata |
| onlyWithMetadata | boolean | false | Only return if metadata found |
| urlBlacklist | array | null | URL patterns to skip |
| authorBlacklist | array | null | Author names to filter out |

**Note on supported formats:** `txt`, `markdown`, `json`, `html`. `xml` and `xml-tei` are temporarily unsupported pending upstream `rs-trafilatura` work.

### Output

#### Dataset Entry

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
  "loadedAt": "2026-01-28T18:58:36.534Z",
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

**Rules:**
- `rawHtml`: always has `hash` + `length`; adds `key` + `url` only if `saveRawHtmlToKeyValueStore` enabled
- `extractedMarkdown`, `extractedText`, etc.: entire object only present if that save flag is enabled
- `metadata`: extracted from rs-trafilatura

#### Key-Value Store

Named `content`. Files stored with MD5-based keys:
- `{hash}-raw.html` - Raw HTML
- `{hash}.txt` - Plain text
- `{hash}.json` - JSON with metadata
- `{hash}.md` - Markdown
