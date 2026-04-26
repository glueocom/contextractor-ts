# Contextractor

Extract clean, readable content from any website using [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura) — the Rust port of [Trafilatura](https://www.contextractor.com/trafilatura/) — wrapped in a TypeScript engine via napi-rs.

Try the [Playground](https://contextractor.com) to configure extraction settings and preview commands before running.

## Repository layout

```
apps/
├── contextractor-apify/        # Apify Actor (TypeScript + Crawlee + Playwright)
└── contextractor-standalone/   # Standalone TypeScript CLI
packages/
└── contextractor-engine/       # TypeScript engine
    └── native/                 # napi-rs Rust binding to rs-trafilatura
tools/
├── generated-unit-tests/       # vitest fixture-based regression tests
└── platform-test-runner/       # apify-client driver for end-to-end suites
docs/
└── spec/                       # functional + technical specifications
```

## Quick start

```bash
pnpm install
pnpm -F @contextractor/engine-native build   # one-time napi-rs build for your platform
pnpm -r build
```

Run the standalone CLI against any URL:

```bash
node apps/contextractor-standalone/dist/cli.js https://example.com -o /tmp/ctx
```

Run the Apify Actor locally:

```bash
cd apps/contextractor-apify && apify run
```

Push to the test actor:

```bash
cd apps/contextractor-apify && apify push   # default target: glueo/contextractor-test
```

## Supported output formats

`txt`, `markdown`, `json`, `html`. `xml` and `xml-tei` are temporarily unsupported pending upstream `rs-trafilatura` work.

## Tests

```bash
pnpm -r test                           # vitest across engine, apps, fixture suite
cargo test --workspace                 # napi-rs binding smoke
```

## Documentation

- [docs/spec/functional-spec.md](docs/spec/functional-spec.md) — Apify Actor + CLI surface
- [docs/spec/tech-spec.md](docs/spec/tech-spec.md) — architecture, dependencies, build, Docker
- [CLAUDE.md](CLAUDE.md) — project instructions for Claude Code

## License

Apache-2.0 (see [LICENSE](LICENSE)).
