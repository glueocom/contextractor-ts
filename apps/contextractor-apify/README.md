# `@contextractor/apify`

Apify Actor that crawls websites and extracts main-content text.

Built on [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura)
(extraction) and [Crawlee](https://crawlee.dev/) (TypeScript crawler driving
Playwright).

## Supported output formats

`txt`, `markdown`, `json`, `html`. XML and XML-TEI are temporarily unsupported
pending upstream `rs-trafilatura` work — the Python source supported them via
Trafilatura.

## Local prerequisites

- **Rust toolchain** via `rustup` (cargo + rustc on PATH for napi build).
- **Apify CLI ≥ 1.4** (older versions reject the modern `actor.json` format).
- **Node 22+**, **pnpm 10+**.

## Local development

```bash
pnpm install
pnpm -F @contextractor/apify build
apify run            # from apps/contextractor-apify/
```

## Input

| Field                                 | Type    | Default    | Description                                |
| ------------------------------------- | ------- | ---------- | ------------------------------------------ |
| startUrls                             | array   | required   | URLs to extract content from               |
| linkSelector                          | string  | `""`       | CSS selector for links to enqueue          |
| globs                                 | array   | `[]`       | Glob patterns to include                   |
| excludes                              | array   | `[]`       | Glob patterns to exclude                   |
| maxPagesPerCrawl                      | integer | `0`        | Max pages (0 = unlimited)                  |
| saveRawHtmlToKeyValueStore            | boolean | `false`    | Save raw HTML                              |
| saveExtractedTextToKeyValueStore      | boolean | `false`    | Save plain text                            |
| saveExtractedJsonToKeyValueStore      | boolean | `false`    | Save JSON with metadata                    |
| saveExtractedMarkdownToKeyValueStore  | boolean | `true`     | Save Markdown                              |
| trafilaturaConfig                     | object  | `{}`       | Extraction options                         |
| initialCookies                        | array   | `[]`       | Pre-set cookies (encrypted)                |
| customHttpHeaders                     | object  | `{}`       | Custom HTTP headers                        |

`trafilaturaConfig` keys (all optional, balanced defaults when omitted):
`fast`, `favorPrecision`, `favorRecall`, `includeComments`, `includeTables`,
`includeImages`, `includeFormatting`, `includeLinks`, `deduplicate`,
`targetLanguage`, `withMetadata`, `onlyWithMetadata`, `teiValidation`.

## Output

Per-page dataset entry with `loadedUrl`, `loadedAt`, `httpStatus`, `metadata`
(title, author, publishedAt, description, siteName, lang), and one of
`extractedMarkdown` / `extractedText` / `extractedJson` / `rawHtml` per
enabled save flag. Each save flag also writes a file to the Key-Value Store.

## Deploy

Production deploys are a **Git-connected build** in the Apify Console (not
`apify push`) so `dockerContextDir: "../../.."` in `.actor/actor.json`
resolves to the repo root and the Dockerfile sees
`packages/contextractor-engine/`.

For test-only deploys to `glueo/contextractor-test`, see
`.claude/commands/platform/push-and-get-working.md`. Production
(`glueo/contextractor`) requires the explicit `--production` flag.
