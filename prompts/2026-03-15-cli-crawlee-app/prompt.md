Add a new app to `apps/` — a standalone CLI for web content extraction.

## What it does

CLI tool that crawls URLs and extracts content using crawlee + contextractor_engine.
Runs from the command line, takes a config file as a parameter.

## Prerequisites

- Rename `apps/contextractor/` → `apps/contextractor-apify/` to reflect it's the Apify actor
- Update any workspace references accordingly

## Requirements

- Add as `apps/contextractor-standalone/` in the UV workspace
- Reuse `contextractor-engine` workspace package for extraction (ContentExtractor, TrafilaturaConfig)
- Use `TrafilaturaConfig.from_json_dict()` to load the `extraction` section from the config file — it handles camelCase→snake_case conversion generically
- Use `crawlee[playwright]` for crawling (same as the Apify app)
- Playwright browsers must be installed (`playwright install`) — document in README
- No Apify SDK dependency — this is a standalone CLI
- Must run on Windows, Mac, Linux
- Python 3.12+

## CLI interface

- Accept a YAML/JSON config file path as argument
- Config file specifies: start URLs, crawl depth, output format, extraction options, output directory
- Sensible defaults when config values are omitted
- Use `typer`, `click`, or `argparse` for CLI parsing

## Config file structure

- `urls` — list of start URLs
- `maxPages` — max pages to crawl (0 = unlimited)
- `outputFormat` — txt, markdown, json, xml, xmltei (default: markdown)
- `outputDir` — directory for extracted content (default: ./output)
- `crawlDepth` — how deep to follow links (default: 0, start URLs only)
- `extraction` — TrafilaturaConfig options (see below)
- `headless` — browser headless mode (default: true)

### Extraction config (Trafilatura)

All TrafilaturaConfig options live under the `extraction` key in the config file. This is the single place to configure extraction — no separate trafilatura config file.

Available options (camelCase in config, maps to TrafilaturaConfig fields):
- `fast` — fast extraction mode (default: false)
- `favorPrecision` — high precision, less noise (default: false)
- `favorRecall` — high recall, more content (default: false)
- `includeComments` — extract comments (default: true)
- `includeTables` — extract tables (default: true)
- `includeImages` — extract images (default: false)
- `includeFormatting` — preserve formatting (default: true)
- `includeLinks` — preserve links (default: true)
- `deduplicate` — remove duplicate content (default: false)
- `targetLanguage` — filter by language, e.g. "en" (default: null)
- `withMetadata` — include metadata in output (default: true)
- `onlyWithMetadata` — skip pages without metadata (default: false)
- `pruneXpath` — XPath expression(s) to remove before extraction (default: null)
- `urlBlacklist` — URLs to skip (default: null)
- `authorBlacklist` — authors to skip (default: null)
- `dateExtractionParams` — custom date extraction params (default: null)

Example:
```yaml
urls:
  - https://example.com
outputFormat: markdown
outputDir: ./output
crawlDepth: 1

extraction:
  favorPrecision: true
  includeComments: false
  includeLinks: true
  includeTables: true
  deduplicate: true
  targetLanguage: en
```

### CLI shortcut flags

A few convenience flags override config file extraction settings. CLI flags always win.

Merge order: `defaults → config file → CLI flags`

- `--precision` — preset: sets `favorPrecision: true` (maps to `TrafilaturaConfig.precision()`)
- `--recall` — preset: sets `favorRecall: true` (maps to `TrafilaturaConfig.recall()`)
- `--no-links` — quick toggle: sets `includeLinks: false`
- `--no-comments` — quick toggle: sets `includeComments: false`

Do not expose all extraction options as CLI flags — the config file is the right place for fine-grained control.

## Distribution

Two distribution channels — same tool, consumer chooses:

### npm package
- Python core compiled to platform-specific binaries using PyInstaller
- npm package wraps binaries — single package with CLI (`bin`) and JS library API (`main`/`exports`)
- Post-install downloads the correct platform binary + runs `playwright install chromium`
- Build targets: linux-x64, linux-arm64, darwin-x64, darwin-arm64, win-x64

### Docker image
- Runs the Python app directly — no npm, no compiled binaries
- Self-contained — Python, Chromium, and all dependencies baked in
- No runtime dependencies on the host
- Two modes, CLI is default:
  - **CLI** (default): `docker run -v ./config.yaml:/config.yaml -v ./output:/output contextractor /config.yaml` — runs extraction, writes output, exits
  - **API** (`--serve`): `docker run -p 8080:8080 contextractor --serve` — starts HTTP server for programmatic access

## Output

- One file per crawled page, named from URL slug
- Metadata (title, author, date) included in output when available
