# napi-rs prebuild distribution within the monorepo

Pattern picked in `entry-qa-prebuild-distribution.md`: workspace packages with committed `.node` files. No external publishing.

## Layout

```
packages/contextractor-engine/
├── package.json                # @contextractor/engine (TS)
├── src/                        # TypeScript engine
└── native/
    ├── Cargo.toml              # crate-type = ["cdylib"]
    ├── build.rs                # napi_build::setup()
    ├── src/lib.rs              # #[napi] fns wrapping rs-trafilatura
    ├── package.json            # @contextractor/engine-native — declares optionalDependencies on each platform
    ├── index.js                # generated loader (committed)
    ├── index.d.ts              # generated types (committed)
    └── npm/
        ├── darwin-arm64/
        │   ├── package.json    # @contextractor/engine-native-darwin-arm64; os: ["darwin"], cpu: ["arm64"]
        │   └── contextractor-engine-native.darwin-arm64.node
        ├── darwin-x64/
        ├── linux-x64-gnu/
        └── linux-arm64-gnu/
```

## Key points

- The platform packages are workspace members listed in `pnpm-workspace.yaml` (e.g. `packages/contextractor-engine/native/npm/*`).
- Main native `package.json` declares each platform package in `optionalDependencies` with `"workspace:*"`. pnpm picks the matching one via `os` + `cpu` fields.
- `napi build --platform --release` outputs a `.node` file at the package root and the matching `index.js` + `index.d.ts` loader. CI commits these into the appropriate `npm/<platform>/` directory.
- The `.node` files **are committed to git** so Apify's Git-connected build resolves them without running Rust.
- The TS engine resolves the prebuild via `require('@contextractor/engine-native')`, which dispatches to the right platform package via the loader emitted by `@napi-rs/cli`.

## Apify Dockerfile path

The actor's image runs `pnpm --filter @contextractor/apify --prod deploy /deploy`. pnpm deploy materializes a self-contained `node_modules` (no symlinks, per `pnpm.io/cli/deploy`) including the platform-matching prebuild. The runtime stage copies `/deploy` and runs the actor.

`actor.json` sets `"dockerContextDir": "../../.."` so the Docker build context is the repo root — the Dockerfile sees `packages/contextractor-engine/`. Pattern follows `github.com/apify/actor-monorepo-example` (which uses npm; we substitute pnpm + `pnpm deploy`).

## Pitfall: napi-rs `Result` type alias

`#[napi]` macros read return-type tokens literally. Using `use napi::bindgen_prelude::Result as MyResult` produces broken `.d.ts` (the alias name leaks). Use the bare `Result<T>` from `napi::bindgen_prelude::Result` everywhere a `#[napi]` fn returns one.

## Pitfall: `tsconfig.json` `exactOptionalPropertyTypes`

`exactOptionalPropertyTypes: true` is incompatible with napi-rs-generated optional fields — the binding emits `field?: T`, not `field?: T | undefined`. Leave it `false` in the root tsconfig (or build option-objects conditionally).

## Pitfall: empty Cargo workspace `members`

A virtual workspace with `members = []` fails `cargo metadata`. The `step-prepare-workspace` step must already create `packages/contextractor-engine/native/` with at least a stub `Cargo.toml` so the workspace parses on day one.

## Pitfall: `vitest run` exit code with zero tests

`vitest run` exits 1 when a package has no `*.test.ts`. Apps without tests (e.g. `apps/contextractor-apify`) need `vitest run --passWithNoTests` in their `test` script, or recursive `pnpm -r test` fails the whole tree.

## Pitfall: Biome's default scope

Biome scans the whole tree by default. Explicitly ignore in `biome.json`:

- `.claude/**`, `prompts/**`
- `**/fixtures/**`, `**/test-suites/**`, `**/test-suites-output/**`
- `**/*.node`
- `packages/contextractor-engine/native/index.{js,d.ts}` (napi-rs-generated)
- `packages/contextractor-engine/native/npm/**` (committed binaries + thin package.jsons)
