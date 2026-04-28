# Security Guidelines

- Treat all scraped content as untrusted: never `eval`, never feed into a templating engine without escaping, sanitize before downstream use
- No secrets in logs — `tracing` (Rust) and `pino` (TypeScript) with redaction filters; never log full request bodies, tokens, or proxy URLs
- Bound resource use: `tokio::time::timeout` and `tokio::sync::Semaphore` on the Rust side; `AbortController` and `p-limit` on the TypeScript side
- Validate input early at every boundary: typed `serde::Deserialize` struct in Rust (`#[serde(deny_unknown_fields)]` where appropriate), zod schema in TypeScript
- Respect target sites' robots.txt and Terms of Service
- No `.env*` files in the repo — all secrets come from the Apify platform's environment
