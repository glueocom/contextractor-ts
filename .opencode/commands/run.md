---
description: Run Actor locally for testing
---

Run the Actor locally with optional input.

## Steps

1. Check input exists at `/Users/miroslavsekera/r/contextractor-ts/apps/contextractor-apify/storage/key_value_stores/default/INPUT.json`
2. From `/Users/miroslavsekera/r/contextractor-ts/apps/contextractor-apify/`, run `apify run`
3. Monitor stdout for errors
4. Check results in `apps/contextractor-apify/storage/datasets/default/`

## With custom input

Create or update `apps/contextractor-apify/storage/key_value_stores/default/INPUT.json` before running. Example:

```json
{"startUrls":[{"url":"https://en.wikipedia.org/wiki/Web_scraping"}],"maxRequestsPerCrawl":1,"outputFormat":"markdown"}
```
