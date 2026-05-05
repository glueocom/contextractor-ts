# @contextractor/extraction — Specification

TypeScript content-extraction engine wrapping `rs-trafilatura` via the napi-rs binding in `@contextractor/extraction-native`.

## Public API

### `ContentExtractor`

Accepts an optional `Partial<TrafilaturaConfig>` and merges it with `DEFAULT_CONFIG` (balanced defaults).

```ts
const extractor = new ContentExtractor({ favorPrecision: true });

extractor.extract(html, { url?, format? })              // ExtractionResult | null
extractor.extractMetadata(html, url?)                   // Metadata (never throws)
extractor.extractAllFormats(html, { url?, formats? })   // Record<OutputFormat, ExtractionResult>
extractor.getConfig()                                   // Readonly<TrafilaturaConfig>
```

### `OutputFormat`

`'txt' | 'markdown' | 'json' | 'html'`

XML and XML-TEI are not currently supported by `rs-trafilatura`.

### `TrafilaturaConfig`

See root `SPEC.md` for the full field table. Defaults match `rs-trafilatura`'s balanced preset.

### `Metadata`

All fields nullable: `title`, `author`, `date` (ISO 8601), `description`, `sitename`, `language`, `hostname`, `url`, `categories`, `tags`, `license`, `image`, `pageType`.

### Other exports

- `normalizeConfigKeys(input)` — accepts camelCase or snake_case keys; merges over `DEFAULT_CONFIG`; drops unknown and `null`/`undefined` values
- `DEFAULT_CONFIG` — frozen balanced-defaults object
- `getDefaultConfig()` — returns a mutable copy of `DEFAULT_CONFIG`

## Native binding

`@contextractor/extraction-native` is loaded at runtime. pnpm resolves the platform-matching optional package (`@contextractor/extraction-native-darwin-arm64`, etc.) via `os` + `cpu` selectors at install time.

## Error handling

- `extract()` returns `null` on any native error
- `extractMetadata()` returns an all-`null` `Metadata` on failure
- `extractAllFormats()` returns empty-content entries for failed formats; never throws
