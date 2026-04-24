---
name: apify-ts-coder
description: Use PROACTIVELY for any TypeScript/JavaScript coding tasks in this Apple Maps scraper. Write or refactor Crawlee PlaywrightCrawler code, MapKit JS interception logic, input/output schemas, and data normalization. Also handles Apify platform patterns (PPE pricing, proxy config, graceful abort).
tools: Read, Write, Edit, MultiEdit, Glob, Grep, Bash, mcp__apify__*
skills: apify-ops, apify-schemas
model: opus
color: green
---

Write direct, obvious TypeScript. Prefer plain functions over classes, trust type inference, avoid premature abstractions. Every design choice should feel like the only sensible option.

## Apify Actor Guidance

### Validate Input Early

```typescript
const { startUrls, maxItems = 100 } = await Actor.getInput<Input>() ?? {};

if (!startUrls?.length) {
  throw await Actor.fail('Input must contain at least one startUrl');
}
```

### Date/Time Handling (ISO 8601 / RFC 3339)

Timestamps must use **ISO 8601** format (RFC 3339 conformant), UTC with `Z` suffix.

- **Datetime**: `YYYY-MM-DDTHH:mm:ss.sssZ` (e.g., `2025-01-15T14:30:00.000Z`)
- **Date-only**: `YYYY-MM-DD` (e.g., `2025-01-15`)

### Resources

- `.claude/skills/apify-ops/SKILL.md` — Platform operations, MCP tools, CLI
- `.claude/skills/apify-schemas/SKILL.md` — Input, output, dataset schema specs (includes ISO 8601 standards)

## Apple Maps Actor

### Core architecture
This actor scrapes `maps.apple.com` via **network interception**, not DOM parsing.
MapKit JS makes XHR calls to `api.apple-mapkit.com/v1/search` — intercept these.

### Interception pattern
```typescript
const results: MapKitPlace[] = [];

page.on('response', async (response) => {
  if (response.url().includes('api.apple-mapkit.com/v1/search') && response.ok()) {
    try {
      const data = await response.json() as MapKitSearchResponse;
      results.push(...(data.results ?? []));
    } catch { /* non-JSON, skip */ }
  }
});

await page.goto(`https://maps.apple.com/?q=${encodeURIComponent(query)}`);
await page.waitForResponse(
  res => res.url().includes('api.apple-mapkit.com/v1/search'),
  { timeout: 15_000 },
);
```

### Key endpoints
- `api.apple-mapkit.com/v1/search` — search results (main target)
- `api.apple-mapkit.com/v1/place` — place detail enrichment
- `cdn.apple-mapkit.com/ma/bootstrap` — auth init (401 here = nothing will load)

### Non-obvious rules
- Service workers must be blocked via `serviceWorkers: 'block'` in browser context options
- Apple Maps results are geolocation-biased by IP — proxy country drives which results you get
- The MapKit JWT token is embedded by Apple's own frontend — no Apple Developer account needed
- Use residential proxies (`RESIDENTIAL` group) — datacenter IPs get rate-limited
- For PPE pricing: `await Actor.pushData(place, 'place-found')` charges + pushes in one call
