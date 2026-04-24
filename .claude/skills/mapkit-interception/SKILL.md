---
name: mapkit-interception
description: Patterns for intercepting MapKit JS API responses from maps.apple.com. Use when implementing or debugging network interception for Apple Maps search results.
allowed-tools: Read, Write, Edit, Grep, Glob
---

# MapKit JS Network Interception

## Target endpoints

| Endpoint | Trigger | Data |
|----------|---------|------|
| `cdn.apple-mapkit.com/ma/bootstrap` | Page load | Auth JWT — 401 here = fatal |
| `api.apple-mapkit.com/v1/search` | URL `?q=` param | Array of place objects |
| `api.apple-mapkit.com/v1/place` | Place detail page | Single enriched place |
| `api.apple-mapkit.com/v1/searchAutocomplete` | Typing in search box | Suggestion strings |

## Passive interception (recommended pattern)

```typescript
// src/interceptor.ts
import type { Page } from 'playwright';
import type { MapKitSearchResponse, MapKitPlace } from './types.js';
import { log } from 'apify';

export function setupInterception(page: Page, results: MapKitPlace[]): void {
    page.on('response', async (response) => {
        const url = response.url();
        if (!url.includes('api.apple-mapkit.com/v1/search')) return;
        if (!response.ok()) return;

        try {
            const data = await response.json() as MapKitSearchResponse;
            const places = data.results ?? [];
            results.push(...places);
            log.debug(`Intercepted ${places.length} places`, { url });
        } catch (err) {
            log.warning('Failed to parse MapKit response', { url, err });
        }
    });
}
```

## Triggering a search

Navigate to `maps.apple.com/?q=<encoded>` — the `q` URL parameter triggers the
automatic search that fires the API call:

```typescript
await page.goto(`https://maps.apple.com/?q=${encodeURIComponent(query)}&lang=${locale}`);
await page.waitForResponse(
    (res) => res.url().includes('api.apple-mapkit.com/v1/search'),
    { timeout: 15_000 },
);
```

## Service workers — critical

apple.com registers service workers that intercept network requests BEFORE Playwright
sees them. You MUST block service workers or the API calls will be invisible:

```typescript
// In PlaywrightCrawler launchContext or preNavigationHooks
const context = await browser.newContext({ serviceWorkers: 'block' });
```

Or via launchContext in the crawler:
```typescript
new PlaywrightCrawler({
    launchContext: {
        userDataDir: undefined,
        launchOptions: { args: ['--disable-gpu'] },
    },
    browserPoolOptions: {
        preLaunchHooks: [(_id, launchContext) => {
            launchContext.launchOptions = {
                ...launchContext.launchOptions,
            };
        }],
    },
    preNavigationHooks: [async ({ page }) => {
        await page.context().route('**/*', (route) => route.continue());
        // Block SW registration
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'serviceWorker', { get: () => undefined });
        });
    }],
});
```

## Known response shape (search endpoint)

```typescript
// src/types.ts
export interface MapKitSearchResponse {
    results: MapKitPlace[];
    displayMapRegion?: { centerLat: number; centerLng: number };
}

export interface MapKitPlace {
    name: string;
    coordinate: { latitude: number; longitude: number };
    formattedAddress: string;
    country: string;
    countryCode: string;
    administrativeArea?: string;
    locality?: string;
    postCode?: string;
    thoroughfare?: string;
    subThoroughfare?: string;
    pointOfInterestCategory?: string;
    telephone?: string;
    urls?: string[];
    rating?: number;
    ratingCount?: number;
    openNowType?: string;
    // enriched via /v1/place:
    hours?: { closingTime: string; openingTime: string; dayOfWeek: number }[];
    photos?: { url: string }[];
}
```

## Auth token

The MapKit JWT is embedded by Apple's own page load — no Apple Developer account needed.
If `cdn.apple-mapkit.com/ma/bootstrap` returns 401, Apple has rotated their token
(rare). Just retry the page load; the token is auto-refreshed per session.
