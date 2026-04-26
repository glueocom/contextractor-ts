# @contextractor/engine

TypeScript content-extraction engine wrapping [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura) (the Rust port of Trafilatura) via napi-rs.

## Usage

```ts
import { ContentExtractor, configFromJson } from '@contextractor/engine';

const extractor = new ContentExtractor({ favorPrecision: true, includeTables: true });

const result = extractor.extract(html, { url: 'https://example.com', format: 'markdown' });
console.log(result?.content);
```

### Metadata

```ts
const extractor = new ContentExtractor();
const meta = extractor.extractMetadata(html, 'https://example.com');
console.log(meta.title, meta.author, meta.date, meta.sitename, meta.language);
```

### Multiple formats at once

```ts
const results = extractor.extractAllFormats(html, { url: 'https://example.com' });
for (const [fmt, r] of Object.entries(results)) {
    console.log(`--- ${fmt} ---`);
    console.log(r.content.slice(0, 200));
}
```

Default formats: `txt`, `markdown`, `json`. Pass a custom list:

```ts
const results = extractor.extractAllFormats(html, { formats: ['markdown', 'json'] });
```

## Supported output formats

`txt`, `markdown`, `json`, `html`. `xml` and `xml-tei` are temporarily unsupported — `rs-trafilatura` 0.2.x does not produce them yet. When upstream gains support, the engine will re-export those formats.

## TrafilaturaConfig fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `fast` | boolean | `false` | Fast mode (less thorough) |
| `favorPrecision` | boolean | `false` | High precision, less noise |
| `favorRecall` | boolean | `false` | High recall, more content |
| `includeComments` | boolean | `true` | Include comments |
| `includeTables` | boolean | `true` | Include tables |
| `includeImages` | boolean | `false` | Include images |
| `includeFormatting` | boolean | `true` | Preserve formatting |
| `includeLinks` | boolean | `true` | Include links |
| `deduplicate` | boolean | `false` | Deduplicate content |
| `targetLanguage` | string \| null | `null` | Filter by language (e.g. `"en"`) |
| `withMetadata` | boolean | `true` | Extract metadata |
| `onlyWithMetadata` | boolean | `false` | Only return docs with metadata |
| `urlBlacklist` | string[] \| null | `null` | URL patterns to skip |
| `authorBlacklist` | string[] \| null | `null` | Author names to filter out |

`fast`, `withMetadata`, and `urlBlacklist` are accepted for API parity with the historic Python config but are no-ops downstream — `rs-trafilatura` 0.2.x has no direct counterpart.

Use `configFromJson(rawJson)` to accept user JSON (camelCase or snake_case keys; unknown keys are ignored). Use `getDefaultConfig()` for the canonical defaults object.

## Build

```bash
pnpm -F @contextractor/engine-native build   # napi-rs binding (per platform)
pnpm -F @contextractor/engine build          # tsc
```

## License

Apache-2.0
