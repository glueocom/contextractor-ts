# Contextractor — Standalone CLI (TypeScript)

Local crawler + extractor. Reads URLs from CLI args or a JSON config file, crawls with Crawlee `PlaywrightCrawler`, extracts main content via [`@contextractor/engine`](../../packages/contextractor-engine), and writes one file per page.

## Install (within this monorepo)

```bash
pnpm install
pnpm -F @contextractor/engine-native build
pnpm -F @contextractor/engine build
pnpm -F @contextractor/standalone build
```

## Usage

```bash
node apps/contextractor-standalone/dist/cli.js https://example.com
node apps/contextractor-standalone/dist/cli.js https://example.com --precision --save json -o ./results
node apps/contextractor-standalone/dist/cli.js --config config.json --max-pages 10
```

## CLI options

```
contextractor [OPTIONS] [URLS...]

Config:
  -c, --config <path>          Path to JSON config file (optional)
  -o, --output-dir <path>      Output directory
  --max-pages <n>              Max pages (0 = unlimited)
  --crawl-depth <n>            Max link depth from start URLs
  --headless / --no-headless   Browser headless mode (default: headless)
  --max-concurrency <n>        Max parallel requests
  --max-retries <n>            Max request retries
  --max-results <n>            Max results per crawl

Proxy:
  --proxy-urls <csv>           Comma-separated proxy URLs
  --proxy-rotation <mode>      recommended | per_request | until_failure

Browser:
  --launcher <browser>         chromium | firefox | webkit
  --wait-until <event>         load | domcontentloaded | networkidle
  --page-load-timeout <secs>   Page load timeout
  --ignore-cors                Disable CORS/CSP restrictions
  --close-cookie-modals        Auto-dismiss cookie banners
  --max-scroll-height <px>     Max scroll in pixels
  --ignore-ssl-errors          Skip SSL verification
  --user-agent <ua>            Custom User-Agent

Filtering:
  --globs <csv>                Glob include patterns
  --excludes <csv>             Glob exclude patterns
  --link-selector <selector>   CSS selector for links to enqueue
  --keep-url-fragments
  --respect-robots-txt

Cookies / headers:
  --cookies <json>             JSON array of cookie objects
  --headers <json>             JSON object of custom HTTP headers

Output:
  --save <csv>                 markdown, html, text, json, jsonl, all (default: markdown)

Extraction:
  --precision                  High precision mode
  --recall                     High recall mode
  --fast                       Fast mode
  --no-links / --no-comments
  --include-tables / --no-tables
  --include-images
  --include-formatting / --no-formatting
  --deduplicate
  --target-language <lang>
  --with-metadata / --no-metadata
  -v, --verbose
```

## Config file (JSON)

Per repo policy, only JSON config is documented. Example:

```json
{
    "urls": ["https://example.com"],
    "outputDir": "./output",
    "save": ["markdown", "json"],
    "trafilaturaConfig": {
        "favorPrecision": true,
        "includeImages": true
    }
}
```

Config merge order: `defaults → config file (if provided) → CLI args` (CLI wins).

## Output

One file per crawled page, named from a URL slug (e.g. `example-com-page.md`). Markdown / text outputs prepend a `Title:`, `Author:`, `Date:`, `URL:` header when metadata is available.

Supported `--save` formats: `markdown`, `text`, `json`, `jsonl`, `html`. `xml` and `xml-tei` are temporarily unsupported pending upstream `rs-trafilatura` work.
