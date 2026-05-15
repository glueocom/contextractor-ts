# Autonomous Proxy Rotation Testing

> **TLDR**: Build a mock proxy simulator (multi-port HTTP server) and a test harness that verifies proxy rotation across all three Contextractor entry points — Apify Actor (local), npm CLI, and npm library.

- test proxy rotation for
    - Apify Actor running locally
    - npm CLI running locally from a console
    - calling the Contextractor npm package from a TypeScript file

- create a proxy simulator tool under `tools/` in this repo. The tool will listen on multiple HTTP ports (around 10) and simulate proxy servers. Implement each mock proxy using `proxy-chain`'s `Server` with `customResponseFunction` — it handles the HTTP proxy protocol correctly with less boilerplate than a raw `http.createServer`. For each HTTP request it receives, it returns a simple HTML page containing just the port number to distinguish the proxy
- use `http://example.com` as the crawl target URL in all tests — the mock proxy intercepts and fabricates the response before the real host is ever contacted; avoid `https://` targets as they require CONNECT tunnel handling that a simple mock cannot intercept
- create a separate proxy rotation test project (or keep it within the simulator — decide what's better, probably splitting is better) that calls Contextractor as the Apify Actor running locally, the npm CLI running locally, and the npm library running locally; assert which proxy was used both via the page body content and via `proxyInfo.port` from Crawlee's `requestHandler` — Crawlee surfaces `ProxyInfo` (with `hostname`, `port`, `url`) in every handler, giving a direct assertion independent of what the mock returns
- set `PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1` when running the tests — without it, Chromium silently bypasses proxies for localhost and the mock proxies will never receive any traffic
- create a Claude Code slash command (`.claude/commands/`) that runs the full simulation end-to-end: starts the mock proxy simulator, runs all three proxy rotation tests (actor, CLI, lib), autofixes any failures, and exits with a clear pass/fail summary — the command must get everything working
- update all affected `SPEC.md` files, `CLAUDE.md`, and rules under `.claude/rules/` to document the new tools, their location, and how to run the proxy rotation tests