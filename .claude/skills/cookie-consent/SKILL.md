---
name: cookie-consent
description: Handling cookie consent dialogs on apple.com using @ghostery/adblocker-playwright. Use when implementing or debugging cookie banner dismissal in the Apple Maps actor.
allowed-tools: Read, Write, Edit
---

# Cookie Consent via Ghostery Adblocker

## Package

`@ghostery/adblocker-playwright` — successor to the unmaintained `@cliqz/adblocker-playwright`.
Uses EasyList "Annoyances" filter lists. Blocks consent framework network requests AND
hides DOM elements. Active community maintenance via EasyList.

## Installation

```bash
npm install @ghostery/adblocker-playwright cross-fetch
```

## Setup with disk caching (use this pattern)

Cache the prebuilt engine to disk to avoid re-downloading filter lists on every run:

```typescript
// src/cookies.ts
import { PlaywrightBlocker } from '@ghostery/adblocker-playwright';
import fetch from 'cross-fetch';
import { promises as fs } from 'node:fs';
import type { Page } from 'playwright';

let blocker: PlaywrightBlocker | null = null;

export async function blockAdsAndConsent(page: Page): Promise<void> {
    if (!blocker) {
        blocker = await PlaywrightBlocker.fromPrebuiltFull(fetch, {
            path: './engine.bin',
            read: (p) => fs.readFile(p),
            write: (p, d) => fs.writeFile(p, d),
        });
    }
    blocker.enableBlockingInPage(page);
}
```

Call it in `preNavigationHooks`:

```typescript
preNavigationHooks: [async ({ page }) => {
    await blockAdsAndConsent(page);
}],
```

## Mode comparison

| Method | Covers |
|--------|--------|
| `fromPrebuiltAdsOnly` | Ads only |
| `fromPrebuiltAdsAndTracking` | Ads + trackers |
| `fromPrebuiltFull` | Ads + trackers + annoyances/cookie dialogs ← USE THIS |
| `fromLists(fetch, urls)` | Custom EasyList URLs |

## Fallback click (if banner still appears)

apple.com rarely shows consent banners in headless mode, but if testing shows one:

```typescript
try {
    await page.click('[aria-label*="Accept"], button:has-text("Accept All")', {
        timeout: 3_000,
    });
} catch { /* no banner, continue */ }
```

## Do not use closeCookieModals()

Crawlee's built-in `closeCookieModals()` uses `idcac-playwright` (I Don't Care About
Cookies extension), which has not been maintained since November 2023. It misses many
modern Consent Management Platforms. Use Ghostery instead.
