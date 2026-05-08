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

`createApifySink({ kvs, dataset, saveOriginal, saveDestination })` saves:

- Raw page HTML to KVS as `{hash}-original.html` when `"original"` is in `save`
- Extracted `txt`, `json`, `markdown`, and `html` to KVS or inline in the dataset item based on `saveDestination`
- Metadata and content references as a dataset item per page

Keys use the first 16 hex characters of an MD5 over the URL.

## Input

`save` accepts `["txt", "markdown", "json", "html", "original"]`. `"original"` saves raw page HTML before extraction and is filtered before calling the extraction layer. `saveDestination` accepts `["key-value-store", "dataset"]`.

## Config

`buildCrawlerOpts(input, sink, proxyConfig, requestQueue)` maps `ContextractorInputType` → `ContextractorCrawlerOptions`.

## Entry point

`apps/apify-actor/src/main.ts` → `runActor()` in `src/run.ts`. Actor initializes with `Actor.init()` and exits with `Actor.exit()`. Input validation failure exits with code 1.

## Deploy

Production deploys go through a Git-connected build in Apify Console (`glueo/contextractor`). `actor.json` sets `"dockerContextDir": "../../.."` so the Dockerfile sees all workspace packages. Test deploys target `glueo/contextractor-test` via `/platform:deploy-and-test`.
