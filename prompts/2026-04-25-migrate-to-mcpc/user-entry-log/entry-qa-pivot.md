**Q:** The live `mcp.apify.com` server exposes only 8 tools. Many operations the original plan assumed (run-list, run-log, dataset-items, KV stores, builds, add-actor) are confirmed missing. How should I proceed?

**A:** Pivot — mcpc where possible, `apify` CLI elsewhere.

Migrate the 7 operations mcpc actually supports (`search-actors`, `fetch-actor-details`, `call-actor`, `get-actor-run`, `get-actor-output`, `search-apify-docs`, `fetch-apify-docs`). For unsupported operations (`apify runs ls/log`, `apify builds *`, `apify datasets ls/get-items`, `apify key-value-stores *`), keep `apify` CLI as the documented path. Still drop every `mcp__apify__*` reference per `entry-qa-direct-mcp.md`. Net effect: one path per operation, fewer surfaces, no fictional tools.

See `../migrate-to-mcpc-notes/live-tools-list.md` for the canonical operation → path mapping under this pivot.
