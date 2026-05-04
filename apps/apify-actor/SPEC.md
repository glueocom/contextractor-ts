# `@contextractor/apify` — Apify Actor

Contextractor Apify Actor. Crawls URLs with `@contextractor/crawler`, extracts content with `@contextractor/extraction`, and saves results to the Apify platform Key-Value Store and Dataset.

## Deployment

- **Test**: `glueo/contextractor-test` — watches the `dev` branch
- **Production**: `glueo/contextractor` — watches the `main` branch

Deployed via Git-connected build in Apify Console (not `apify push`) — `dockerContextDir: "../../.."` in `.actor/actor.json` requires the full monorepo context.

## Input

Full Apify input UI driven by `.actor/input_schema.json` (generated from `@contextractor/schema` — never hand-edit this file). Validated at runtime by `ContextractorInput.parse(await Actor.getInput())`.

## Output

### Dataset

One entry per crawled page:

- `loadedUrl` — final URL after redirects
- `rawHtml` — `{ hash, length }` always; `{ key, url }` only if `saveRawHtmlToKeyValueStore` enabled
- `extractedMarkdown` / `extractedText` / `extractedJson` — `{ key, url, hash, length }` per enabled save flag
- `metadata` — `{ title, author, publishedAt, description, siteName, lang }`
- `loadedAt` — ISO 8601 timestamp
- `httpStatus` — HTTP response code

### Key-Value Store

Content files keyed by `MD5(url).slice(0, 16)`:

- `{hash}-raw.html` — original HTML
- `{hash}.md`, `{hash}.txt`, `{hash}.json` — extracted content per enabled save flag

## Key Files

- `src/main.ts` — entry: `Actor.init()` → `runActor()` → `Actor.exit()`
- `src/run.ts` — wires `ContextractorInput` → `createContextractorCrawler` → `createApifySink`
- `src/config.ts` — maps `ContextractorInputType` to `ContextractorCrawlerOptions`
- `src/sinks.ts` — writes to KVS + Dataset; defines `ApifySink`
- `src/extraction.ts` — format extraction helpers

## Dependencies

- `apify ^3`
- `@contextractor/extraction`, `@contextractor/crawler`, `@contextractor/schema` (workspace)
