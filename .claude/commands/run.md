---
allowed-tools: Bash(apify:*), Bash(cargo:*)
description: Run Actor locally for testing
model: haiku
---

Run the Actor locally with optional input.

## Steps

- Check input exists at `/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/storage/key_value_stores/default/INPUT.json`
- From `/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/`, run `apify run`
- Monitor stdout for errors
- Check results in `apps/apify-actor/storage/datasets/default/`

## With custom input

Create or update `apps/apify-actor/storage/key_value_stores/default/INPUT.json` before running. Example:

```json
{"startUrls":[{"url":"https://en.wikipedia.org/wiki/Web_scraping"}],"maxRequestsPerCrawl":1,"outputFormat":"markdown"}
```
