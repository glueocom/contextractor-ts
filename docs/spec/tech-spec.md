# Contextractor - Technical Specification

## Stack

- Python 3.12+
- uv workspace monorepo with hatchling build system
- Crawlee for Python with PlaywrightCrawler
- Apify SDK
- contextractor-engine library (Trafilatura wrapper)

## Architecture

Two-package monorepo:
- `packages/contextractor_engine/` - Library package, depends on trafilatura only
- `apps/contextractor/` - Actor application, depends on engine + apify + crawlee

```
Input URLs → PlaywrightCrawler → ContentExtractor → KVS (blobs) + Dataset (metadata)
```

## Key Implementation Details

### Handler Pattern

Handler must be defined inside `async with Actor:` context. Config passed via `Request.user_data`:

```python
async with Actor:
    kvs = await Actor.open_key_value_store(name='content')
    crawler = PlaywrightCrawler(...)

    @crawler.router.default_handler
    async def handler(ctx: PlaywrightCrawlingContext) -> None:
        config = ctx.request.user_data.get('config', {})
        trafilatura_config_raw = config.get('trafilatura_config_raw', {})

        # Build TrafilaturaConfig from raw dict (JSON-serializable in user_data)
        if trafilatura_config_raw:
            normalized = normalize_config_keys(trafilatura_config_raw)
            filtered = {k: v for k, v in normalized.items() if v is not None}
            trafilatura_config = TrafilaturaConfig(**filtered)
        else:
            trafilatura_config = TrafilaturaConfig.balanced()

        extractor = ContentExtractor(config=trafilatura_config)
        html = await ctx.page.content()
        # extract and save...

    requests = [Request.from_url(url, user_data={'config': config}) for url in start_urls]
    await crawler.run(requests)
```

### Content-Type Headers

All content-type headers must include charset: `text/html; charset=utf-8`

### Public URLs

Use `await kvs.get_public_url(key)` to get download URLs.

### TrafilaturaConfig

Replaces the old `extractionMode` enum. Dataclass mapping to trafilatura.extract() parameters:

```python
from contextractor_engine import ContentExtractor, TrafilaturaConfig

# Factory methods for common configurations
config = TrafilaturaConfig.balanced()   # Default balanced extraction
config = TrafilaturaConfig.precision()  # favor_precision=True
config = TrafilaturaConfig.recall()     # favor_recall=True

# Or customize directly
config = TrafilaturaConfig(
    favor_precision=True,
    include_links=False,
    target_language="en",
)

extractor = ContentExtractor(config=config)
result = extractor.extract(html, url=url, output_format="markdown")
metadata = extractor.extract_metadata(html, url=url)
```

Formats: `txt`, `json`, `markdown`, `xml`, `xmltei`

### Key Generation

MD5 hash of URL, first 16 characters: `hashlib.md5(url.encode()).hexdigest()[:16]`

### Browser Context Options

Custom headers and cookies are passed to the PlaywrightCrawler via `browser_new_context_options`:

```python
options = {}
if initial_cookies:
    options['storage_state'] = {'cookies': initial_cookies}
if custom_headers:
    options['extra_http_headers'] = custom_headers
```

This applies headers to all HTTP requests and pre-sets cookies on all browser contexts.

## Dependencies

Engine package (`packages/contextractor_engine/`):
```
trafilatura>=2.0.0
```

Actor package (`apps/contextractor/`):
```
apify>=2.0.0,<4.0.0
crawlee[playwright]>=0.4.0
contextractor-engine (workspace)
browserforge<1.2.4
```

## Build

Build engine wheel for distribution:
```bash
./scripts/build-engine.sh
# or
uv build --package contextractor-engine --out-dir dist/
```

## Docker

uv-based install with frozen lockfile:
```dockerfile
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
COPY packages/contextractor_engine/ ./packages/contextractor_engine/
COPY apps/contextractor/ ./apps/contextractor/
RUN uv sync --frozen --no-dev --directory apps/contextractor
```
