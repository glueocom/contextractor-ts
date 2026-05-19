Reference: `/Users/miroslavsekera/r/actor-scraper/packages/actor-scraper/playwright-scraper` (`INPUT_SCHEMA.json`) and https://apify.com/apify/playwright-scraper

Contextractor is the `contextractor-ts` repo at `/Users/miroslavsekera/r/contextractor-ts`. Its input schema source of truth is the Zod schema `packages/schema/src/source-of-truth/input.ts`, which generates `apps/apify-actor/.actor/input_schema.json`. The CLI lives in `apps/standalone/src/cli.ts` and `cliProgram.ts`.

- Compare the playwright-scraper proxy-related input fields (`proxyConfiguration`, `proxyRotation`, `sessionPoolName`) against the contextractor schema. Is anything missing in contextractor?
- Broadly investigate what else may be missing or fixable in contextractor's proxy rotation and configuration — look at Crawlee's full `ProxyConfiguration` API, session pool handling, and how the Website Content Crawler or other Apify scrapers handle proxy/session config. Identify gaps and improvement opportunities.
- Read the "Tiered proxies" section of https://crawlee.dev/js/docs/guides/proxy-management#tiered-proxies (Crawlee 3.16, `tieredProxyUrls` on `ProxyConfiguration`). Is it feasible to implement tiered proxies in contextractor? How would tiered proxies be passed as a CLI param (Investigate this on the internet how other tools passes tiered proxies or similar parameters to CLI)?
- Can the Tiered proxies be implemented into Apify input schema? it seems there is some standard settings all tools use, can thio be override, should this be overriden?

Create a TLDR at the top of the report

Write the full report to `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-19-contextractor-proxy-config/context/report.md`.
