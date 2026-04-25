**Q:** How should the resulting prompt handle the mcpc connection model — pre-establish the `@apify` session in setup, or have every Bash call connect inline?

**A:** Pre-connect once.

Document a one-time `mcpc login mcp.apify.com` + `mcpc connect mcp.apify.com @apify` setup. All skill/agent examples use the short `mcpc @apify ...` form. Header-auth fallback is not the documented default.
