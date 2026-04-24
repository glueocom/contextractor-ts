---
paths:
  - "src/**/*.ts"
  - "src/**/*.js"
---

# Apify Code Patterns

## Logging

Always use `apify/log` instead of `console.log`:

```typescript
import { log } from 'apify';

log.info('Processing page', { url: request.url });
log.error('Failed to process', { error: error.message });
```

## Input Validation

Validate input immediately after Actor.init():

```typescript
await Actor.init();

const input = await Actor.getInput();
if (!input?.startUrls?.length) {
    throw new Error('startUrls is required');
}
```

## Error Handling

Use try-catch with proper logging:

```typescript
try {
    await processPage(page);
} catch (error) {
    log.error('Processing failed', {
        url: request.url,
        error: error.message
    });
    throw error; // Re-throw for retry
}
```

## Data Cleaning

Normalize and trim before pushing to dataset:

```typescript
const place = {
    name: name?.trim() || null,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    address: formatAddress(rawAddress),
    scrapedAt: new Date().toISOString(),
};

await Actor.pushData(place);
```
