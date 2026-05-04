# `@contextractor/standalone` — Standalone CLI

Standalone CLI and Node.js library for running Contextractor locally. Crawls URLs with `@contextractor/crawler`, extracts content, and saves results to disk.

## Usage

```bash
contextractor [OPTIONS] [URLS...]
contextractor https://example.com
contextractor https://example.com --precision --save json -o ./results
contextractor --config config.json --max-pages 10
```

The full flag list is auto-generated in `apps/standalone/README.md` from `src/cliProgram.ts` by `@contextractor/gen-md-regions`.

## Config File

JSON config file with the same camelCase shape as the Apify input schema. Validated by `ContextractorInput.parse()`. Unknown keys stripped. YAML is silently accepted for backward compatibility but documented as JSON only.

Config merge order: `config file → CLI args → ContextractorInput.parse()`. Defaults from Zod `.default(...)` calls.

## Output

One file per crawled page, named from a URL slug (e.g. `example-com-page.md`). A metadata header (title, author, date, URL) is prepended to text-format outputs when metadata is available.

## Programmatic API

Also usable as a Node.js library:

```ts
import { buildProgram } from '@contextractor/standalone';
const program = buildProgram();
await program.parseAsync(argv);
```

## Key Files

- `src/cliProgram.ts` — Commander program; owns all `program.option(...)` definitions; consumed by `@contextractor/gen-md-regions` for README generation
- `src/cli.ts` — entry point; re-exports `buildProgram()` for the generator
- `src/config.ts` — `loadConfigFile()`, `CrawlConfig`, `SaveFormat`
- `src/sinks.ts` — writes output files to disk

## Dependencies

- `commander ^12`
- `@contextractor/extraction`, `@contextractor/crawler`, `@contextractor/schema` (workspace)
