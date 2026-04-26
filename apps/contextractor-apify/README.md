# Contextractor — Apify Actor (TypeScript)

Crawls websites with Crawlee `PlaywrightCrawler` and extracts main-content text via [`@contextractor/engine`](../../packages/contextractor-engine), which wraps [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura) — the Rust port of Trafilatura — through napi-rs.

## Features

- **Multiple output formats** — Markdown, plain text, JSON, raw HTML
- **JavaScript rendering** — Crawlee `PlaywrightCrawler` (Chromium / Firefox / WebKit)
- **Link crawling** — Follow links across a site with glob filtering and depth limits
- **Metadata extraction** — Title, author, date, description, site name, language
- **Configurable precision/recall** — Tune extraction via `trafilaturaConfig`

## Run locally

```bash
pnpm install
pnpm -F @contextractor/engine-native build
pnpm -F @contextractor/engine build
pnpm -F @contextractor/apify build
cd apps/contextractor-apify && apify run
```

## Push to the platform

Test target (default):

```bash
cd apps/contextractor-apify && apify push   # → glueo/contextractor-test
```

Production deploys are gated by `/platform:push-and-get-working --production`.

## Input

| Parameter | Description | Default |
|-----------|-------------|---------|
| `startUrls` (required) | URLs to extract content from | — |
| `linkSelector` | CSS selector for links to enqueue | `""` |
| `globs` / `excludes` | Glob filters for enqueued links | `[]` |
| `maxPagesPerCrawl` | Limit total pages crawled (0 = unlimited) | `0` |
| `maxResultsPerCrawl` | Limit results saved (0 = unlimited) | `0` |
| `maxCrawlingDepth` | Limit link depth from start URLs | `0` |
| `trafilaturaConfig` | Extraction options (camelCase) | `{}` (balanced) |
| `saveExtractedMarkdownToKeyValueStore` | Save Markdown | `true` |
| `saveExtractedTextToKeyValueStore` | Save plain text | `false` |
| `saveExtractedJsonToKeyValueStore` | Save JSON envelope | `false` |
| `saveRawHtmlToKeyValueStore` | Save raw HTML | `false` |
| `proxyConfiguration` | Apify proxy config | — |
| `launcher` | `chromium` \| `firefox` \| `webkit` | `chromium` |
| `headless` | Run headless | `true` |

See `.actor/input_schema.json` for the complete list and per-field descriptions.

## Output

Each crawled page produces a dataset item:

```json
{
  "loadedUrl": "https://example.com/article",
  "httpStatus": 200,
  "loadedAt": "2026-04-26T12:00:00.000Z",
  "metadata": {
    "title": "Article Title",
    "author": "John Doe",
    "publishedAt": "2025-01-15",
    "description": "Article description",
    "siteName": "Example Blog",
    "lang": "en"
  },
  "rawHtml": {
    "hash": "f8e6bd335e04d03e1be6798c2c72349c",
    "length": 45000
  },
  "extractedMarkdown": {
    "key": "a1b2c3d4e5f67890.md",
    "url": "https://api.apify.com/v2/key-value-stores/.../records/a1b2c3d4e5f67890.md",
    "hash": "43f204bfbee5dbe6862cb38620f257b5",
    "length": 5000
  }
}
```

Extracted content is saved to the key-value store. The `extractedMarkdown` field (and the equivalents for other formats) contains a `url` you can use to download the content directly.

## Supported output formats

`txt`, `markdown`, `json`, `html`. `xml` and `xml-tei` are temporarily unsupported pending upstream `rs-trafilatura` work.

## Example input

Extract all blog posts from a site:

```json
{
  "startUrls": [{ "url": "https://example.com/blog" }],
  "globs": [{ "glob": "https://example.com/blog/**" }],
  "linkSelector": "a",
  "maxPagesPerCrawl": 100,
  "trafilaturaConfig": {},
  "saveExtractedMarkdownToKeyValueStore": true
}
```

## Dockerfile

`apps/contextractor-apify/Dockerfile` extends `apify/actor-node-playwright-chrome:22`. The image installs `pnpm`, restores workspace dependencies, builds the napi-rs binding (Rust toolchain fetched at build time then removed), then builds the TS sources.
