**Q:** mcpc replaces *remote* MCP/API operations but cannot do local dev tasks (`apify run`, `apify push`, `apify login`, `apify info`). What is the intended scope of replacement?

**A:** Remote ops only.

Keep `apify` CLI for local dev (run / push / login / info) and Docker. Replace all remote calls — `mcp__apify__*`, `apify call`, `apify builds`, `apify runs`, `apify datasets`, `apify key-value-stores`, raw API curl, and `apify-client` SDK in Node scripts — with `mcpc`.
