# Autonomous Proxy Rotation Testing

> **TLDR**: Build a mock proxy simulator (multi-port HTTP server) and a test harness that verifies proxy rotation across all three Contextractor entry points — Apify actor (local), NPM CLI, and NPM library.

- we need to test proxy rotation for
    - Apify actor running locally
    - NPM CLI running locally from a console
    - calling the contextractor NPM from a typescript file

- create a tool for helping with proxy testing at a subfolder of `/Users/miroslavsekera/r/contextractor-ts/tools`. the new tool will HTTP listen to multiple ports (around 10) and will simulate proxy servers. Then the proxy server test tool will return for each HTTP request a simple html containing just the port number to distinguish the proxy
- create another project or projects (or keep it within the proxy rotation simulator, decide whats better, probably splitting is better) that will do the actual proxy rotation testing, that will call the Contextractor as the Apify actor running locally, the Contextractor as the NPM CLI running locally, the Contextractor as the NPM lib running locally
- set `PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1` when running the tests — without it, Chromium silently bypasses proxies for localhost and the mock proxies will never receive any traffic  