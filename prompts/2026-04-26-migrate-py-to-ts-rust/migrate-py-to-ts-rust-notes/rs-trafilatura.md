# `rs-trafilatura` integration notes

- Crate: <https://crates.io/crates/rs-trafilatura> (current v0.1.1, March 2026). Repo: <https://github.com/Murrough-Foley/rs-trafilatura>.
- API surface (per repo README):
  - `extract(html: &str)` — basic extraction with defaults.
  - `extract_with_options(html: &str, options: &Options)` — full options (28 fields incl. `include_comments`, `include_tables`, `include_images`, `include_links`, `favor_precision`, `output_markdown`, `page_type`, URL context).
  - `extract_bytes(html_bytes: &[u8])` — auto encoding.
- Output formats from rs-trafilatura: plain text, HTML, GitHub-flavored Markdown, rich metadata struct (title, author, date, description, categories, tags, license), images with alt + captions, comments.
- **No XML / XML-TEI output** at v0.1.1 — see `../user-entry-log/entry-qa-xml-formats.md` for the resulting drop decision.
- Ships an `extract_stdin` binary (HTML stdin → JSON stdout) and an optional `spider` feature flag for crawling. We use neither at runtime — the napi-rs binding calls library functions directly.

## Integration mechanism (chosen: napi-rs)

Per `../user-entry-log/entry-qa-rust-bridge.md`:

- New crate `packages/contextractor-engine/native/` (or `crates/contextractor-engine-native/`) with `crate-type = ["cdylib"]` and `napi`, `napi-derive` deps. Exposes a small surface mirroring the TS API: `extract(html, options) -> Result`, `extractMetadata(html, url) -> Metadata`, `extractAllFormats(html, options) -> Record<format, Result>`.
- Build via `@napi-rs/cli`: `napi build --platform --release`. Outputs `*.node` plus a thin TS wrapper.
- Per-platform prebuilds (`darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu`) shipped via npm-style `optionalDependencies`. The Apify Dockerfile installs the matching prebuild for its base image arch (Node + Playwright base, linux-x64 or linux-arm64).
- Local dev: `pnpm -F @contextractor/engine build` invokes `napi build` then `tsc`. CI builds for all platforms via `napi build` matrix.

## API mapping from Python `contextractor_engine` to TS

| Python                              | TypeScript                              |
|-------------------------------------|-----------------------------------------|
| `TrafilaturaConfig(**fields)`       | `interface TrafilaturaConfig { ... }`   |
| `ContentExtractor(config)`          | `class ContentExtractor`                |
| `.extract(html, url, output_format)`| `.extract(html, { url, format })`       |
| `.extract_metadata(html, url)`      | `.extractMetadata(html, url)`           |
| `.extract_all_formats(html, ...)`   | `.extractAllFormats(html, ...)`         |
| Result `.content / .title / ...`    | Same field names, camelCase             |

Field naming: snake_case in Python → camelCase in TS (and in Apify input schema).

## Open questions deferred

- `categories` / `tags` / `license` rich-metadata fields don't exist in the Python `ContentExtractor.extract_metadata()` return — the TS engine should expose them (rs-trafilatura provides them) but the request-handler may continue to project only the legacy field set so the dataset schema stays stable.
