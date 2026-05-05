# apps/apify-actor — Specification

Apify Actor wrapping the Contextractor extraction engine.

## Data flow

```
Actor.getInput() → ContextractorInput.safeParse() → createContextractorCrawler()
                                                      └── ContentExtractor per page
                                                            └── createApifySink()
                                                                  ├── KVS (content blobs)
                                                                  └── Dataset (metadata + references)
```

## Sinks

`createApifySink({ kvs, dataset, saveHtml })` saves:

- Raw HTML to KVS when `saveRawHtmlToKeyValueStore` is enabled (`{hash}-raw.html`)
- Extracted `txt`, `json`, and `markdown` to KVS based on the three boolean save flags
- Metadata and KVS references as a dataset item per page

Keys use the first 16 hex characters of an MD5 over the URL.

## Config

`buildCrawlerOpts(input, sink, proxyConfig, requestQueue)` maps `ContextractorInputType` → `ContextractorCrawlerOptions`.

## Entry point

`apps/apify-actor/src/main.ts` → `runActor()` in `src/run.ts`. Actor initializes with `Actor.init()` and exits with `Actor.exit()`. Input validation failure exits with code 1.

## Deploy

Production deploys go through a Git-connected build in Apify Console (`glueo/contextractor`). `actor.json` sets `"dockerContextDir": "../../.."` so the Dockerfile sees all workspace packages. Test deploys target `glueo/contextractor-test` via `/platform:deploy-and-test`.
