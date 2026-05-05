# apps/standalone — Specification

Standalone TypeScript CLI for local content extraction. Also exports a programmatic API.

## Usage

```bash
contextractor [OPTIONS] [URLS...]
contextractor https://example.com
contextractor --config config.json --max-pages 10
contextractor https://example.com --save json -o ./results
```

Full flag reference: auto-generated table in `apps/standalone/README.md`.

## Config merge order

`defaults (Zod schema) → config file (JSON) → CLI args`

Config file: optional JSON file with the same camelCase shape as the Apify input schema. CLI-only flags (`--output-dir`, `--save`) are not accepted in the config file. Unknown keys are stripped by `ContextractorInput.parse()`.

## Output

One file per crawled page in the output directory, named from a URL slug (e.g. `example-com-page.md`). When metadata is available, a header (title, author, date, URL) is prepended. Supported save formats: `txt`, `markdown`, `json`, `html`.

## Programmatic API

`@contextractor/standalone` exports `buildProgram()` for use as a Node.js library without the CLI binary.

## Sink

Uses `fileSink(outputDir, formats)` from `@contextractor/crawler` — writes one file per page per requested format.
