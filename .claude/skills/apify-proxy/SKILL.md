---
name: apify-proxy
description: Configuring Apify proxy for the Apple Maps scraper. Use when setting up proxy rotation, session management, or geo-targeting for location-biased search results.
allowed-tools: Read, Write, Edit
---

# Proxy Configuration for Apple Maps

## Why residential proxies

Apple Maps returns **geolocation-biased results** based on the requesting IP address.
- Searching "pizza" from a US IP → US pizza places
- Searching "pizza" from a Czech IP → Czech pizza places
- Datacenter IPs are often rate-limited or blocked entirely by apple.com

Always use `RESIDENTIAL` group. Set `countryCode` to match the target geography.

## Standard setup

```typescript
// src/main.ts
const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: ['RESIDENTIAL'],
    countryCode: input.countryCode ?? 'US',
});

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    useSessionPool: true,
    sessionPoolOptions: {
        sessionOptions: {
            maxUsageCount: 5,       // Rotate proxy after 5 requests per session
            maxErrorScore: 1,       // Retire session after first error
        },
    },
});
```

## Input schema entry

```json
{
  "proxyConfiguration": {
    "sectionCaption": "Proxy and browser",
    "title": "Proxy configuration",
    "type": "object",
    "description": "Residential proxies strongly recommended. The proxy country determines which geographic area Apple Maps returns results for.",
    "editor": "proxy",
    "prefill": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] },
    "default": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
  },
  "countryCode": {
    "sectionCaption": "Proxy and browser",
    "title": "Country code",
    "type": "string",
    "description": "ISO 3166-1 alpha-2 country code for proxy geo-targeting (e.g. US, GB, DE). Drives which geographic results Apple Maps returns.",
    "default": "US",
    "editor": "textfield"
  }
}
```

## Three mutually exclusive proxy modes (Crawlee)

```typescript
// Mode 1: Static list
proxyUrls: ['http://user:pass@proxy1.example.com:8000']

// Mode 2: Dynamic per-request function
newUrlFunction: async (sessionId) => `http://${sessionId}@proxy.example.com:8000`

// Mode 3: Tiered fallback (try cheap proxies first, fall back to residential)
tieredProxyUrls: [
    ['http://datacenter1:8000'],      // tier 1 — cheap
    ['http://residential1:8000'],     // tier 2 — fallback
]
```

Only one of these can be set at a time. `proxyConfiguration` from
`Actor.createProxyConfiguration()` uses `newUrlFunction` internally — do not also
set `proxyUrls` or `tieredProxyUrls` in the same crawler config.
