# Codified lessons from v1 migration pass

Aggregated from the v2 entry prompt's "Lessons from the v1 implementation pass" section plus what was already encoded into `CLAUDE.md` and the `.claude/commands/` after v1. Each lesson maps to a concrete check in the migration steps.

## Production-actor protection

- v1 left `apps/contextractor-apify/.actor/actor.json` `name = "contextractor"` and pushed build 0.3.5 to **production `glueo/contextractor`** by accident. v2 must:
  - Set `"name": "contextractor-test"` from `step-rename-and-port-apify-actor` onward.
  - Verify `.claude/settings.json` deny list still covers `apify push glueo/contextractor` and `apify call glueo/contextractor` (plus `*` and `--*` argument variants). The current target deny list already has these.
  - Do not regress `.claude/commands/platform/push-and-get-working.md` Step ACTOR_NAME_GUARD (the `jq`-based name check).
  - Do not push to `glueo/contextractor` (production) anywhere in this prompt.

## rs-trafilatura version

- v0.2.x (currently 0.2.2). Not 0.1.x. The `Options` struct has no `prune_xpath`, no `tei_validation`, no `with_metadata` flag (metadata is always extracted). `output_markdown` defaults to `false` — must be set per call to populate `content_markdown`. `content_html` is always populated.
- See `rs-trafilatura-0.2.md` for the full API surface.

## napi-rs gotchas

- `#[napi]` macros read return-type tokens literally — `use napi::bindgen_prelude::Result as MyResult` produces broken `.d.ts`. Use bare `Result<T>` from `napi::bindgen_prelude::Result` everywhere a `#[napi]` fn returns one.
- The `tsconfig.json` `exactOptionalPropertyTypes: true` setting is incompatible with napi-rs-generated optional fields (the binding emits `field?: T`, not `field?: T | undefined`). Leave it `false` in the root tsconfig.
- A virtual Cargo workspace with empty `members = []` fails `cargo metadata`. `step-prepare-workspace` must already create a stub `Cargo.toml` for the napi-rs crate.

## Strict Cargo lints

- The napi-rs crate keeps `expect_used`, `unwrap_used`, `missing_errors_doc` denied. Fix the code instead of allowing them. The `rust` skill already enumerates the lint set.

## TS / vitest / Biome

- `vitest run` exits 1 when a package has zero tests. Apps without tests (e.g. `apps/contextractor-apify`) need `vitest run --passWithNoTests` in their `test` script.
- Biome's default file scope is too broad. `biome.json` must explicitly ignore: `.claude/**`, `prompts/**`, `**/fixtures/**`, `**/test-suites/**`, `**/test-suites-output/**`, `**/*.node`, `packages/contextractor-engine/native/index.{js,d.ts}`, and `packages/contextractor-engine/native/npm/**`.

## Local prerequisites

- Rust toolchain via `rustup` (`cargo`, `rustc` on `PATH` for napi build).
- Apify CLI ≥ 1.4 (older versions reject the modern `actor.json` with "Actor is of an unknown format").
- Node 22+, pnpm 10+.
- Document these in CLAUDE.md and `packages/contextractor-engine/README.md`.

## Drop the v1 vendor pattern

- v1 vendored `apps/contextractor-apify/vendor/{engine,engine-native}/` to work around `apify push` not honoring contexts above the actor dir. v2 replaces this with:
  - Git-connected build in Apify Console (honors `dockerContextDir: "../../.."`).
  - Multi-stage Dockerfile with `pnpm --filter @contextractor/apify --prod deploy /deploy`.
  - Workspace-package prebuilds (committed `.node` files; CI matrix per `napi-rs/package-template-pnpm`).
- See `apify-monorepo-deploy.md` and `napi-rs-monorepo-prebuilds.md`.

## "Built on" wording rule

- Every README, every Apify Actor description, every `docs/spec/*.md`, and CLAUDE.md must say Contextractor is built on **rs-trafilatura** (extraction) **and** [Crawlee](https://crawlee.dev/) (TypeScript crawler driving Playwright). The `/sync/docs` and `/sync/gui` commands already enforce this; do not regress.
