# `@contextractor/standalone`

TypeScript CLI for Contextractor.

Built on [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura)
(extraction) and [Crawlee](https://crawlee.dev/) (TypeScript crawler driving
Playwright).

## Supported output formats

`txt`, `markdown`, `json`, `html`. XML and XML-TEI are temporarily unsupported
pending upstream `rs-trafilatura` work — the Python source supported them via
Trafilatura.

## Usage

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
| `--precision`                       | High precision mode                                            |
| `--recall`                          | High recall mode                                               |
| `--fast`                            | Fast extraction mode                                           |
| `--no-links`                        | Exclude links                                                  |
| `--no-comments`                     | Exclude comments                                               |
| `--include-tables` / `--no-tables`  | Include tables (default: include)                              |
| `--include-images`                  | Include image descriptions                                     |
| `--include-formatting` / `--no-formatting` | Preserve formatting (default: preserve)                |
| `--deduplicate`                     | Deduplicate extracted content                                  |
| `--target-language`                 | Filter by language (e.g. `en`)                                 |
| `--with-metadata` / `--no-metadata` | Extract metadata along with content                            |
| `--verbose`, `-v`                   | Enable verbose logging                                         |

## JSON config

Pass `--config path/to/config.json`. Example:

```json
{
  "urls": ["https://example.com"],
  "outputDir": "./output",
  "save": ["markdown", "json"],
  "headless": true,
  "trafilaturaConfig": {
    "favorPrecision": true,
    "includeImages": false
  }
}
```

| Field             | Type    | Default        | Description                                |
| ----------------- | ------- | -------------- | ------------------------------------------ |
| urls              | array   | `[]`           | URLs to extract content from               |
| maxPages          | integer | `0`            | Max pages to crawl (0 = unlimited)         |
| outputDir         | string  | `./output`     | Directory for extracted content            |
| crawlDepth        | integer | `0`            | How deep to follow links                   |
| headless          | boolean | `true`         | Browser headless mode                      |
| save              | array   | `["markdown"]` | Output formats list                        |
| trafilaturaConfig | object  | `{}`           | Extraction options                         |

Config merge order: `defaults → config file → CLI args`.

## Local prerequisites

- **Rust toolchain** via `rustup` (cargo + rustc on PATH for napi build).
- **Node 22+**, **pnpm 10+**.

## Local development

```bash
pnpm install
pnpm -F @contextractor/standalone build
node apps/contextractor-standalone/dist/cli.js https://example.com -o /tmp/contextractor
```
