# Target repo current state — `/Users/miroslavsekera/r/contextractor-ts/`

Snapshot 2026-04-26 (after v1 migration was reverted at commit `e04ecf4`).

The repo name has `-ts` but tracked source on disk is **still Python**. CLAUDE.md and `.claude/commands/` already describe the v2 TS+napi-rs target state; the source code has not yet been re-migrated.

## Tracked filesystem

- `apps/contextractor/` — Python Apify Actor (`pyproject.toml`, `src/{__main__.py, main.py, handler.py, extraction.py, config.py}`, `Dockerfile`). Mirrors the source repo's `apps/contextractor-apify/`.
- `apps/contextractor-apify/` — partial v1 leftover: `dist/`, `node_modules/`, `storage/`, plus a stray `apps/` subdirectory (no source files). Untracked working-tree clutter from the reverted v1 build.
- `apps/contextractor-standalone/` — partial v1 leftover: `dist/`, `node_modules/` only.
- `packages/contextractor_engine/` — Python lib (`pyproject.toml`, `src/`, `tests/`).
- `packages/contextractor-engine/` — **untracked** v1 leftover: `dist/`, `node_modules/`, `native/contextractor-engine-native.darwin-arm64.node`. No Cargo.toml, no source. (Visible in `git status --porcelain` as `?? packages/contextractor-engine/`.)
- `tools/platform-test-runner/` — already TypeScript (`apify-client`, tsx, tsc). Keep; only update tests/inputs.
- `tools/generated-unit-tests/` — currently Python (`conftest.py`, pytest, `fixtures/`). Rewrite as TS vitest package; keep `fixtures/` verbatim.
- `docs/{spec, troubleshooting, unit-test-cases, notes}` — present. Sync from source repo's docs (skip `pypi-trusted-publishing.md`).
- `CLAUDE.md` — already aligned to v2 (mentions napi-rs, Crawlee, packages/contextractor-engine, dockerContextDir, glueo/contextractor-test, prebuild matrix). The migration must keep it in sync.
- `.claude/commands/sync/{docs.md, gui.md}` — already aligned to v2 (canonical TS engine, drop xml/xmltei, drop `pruneXpath`/`dateExtractionParams`, "built on rs-trafilatura and Crawlee"). Migration must not regress.
- `.claude/commands/platform/push-and-get-working.md` — already enforces Step ACTOR_NAME_GUARD and `--production` flag. Migration must not regress.
- `.claude/commands/git/release.md` — already cuts versions across TS `package.json` files and napi-rs `Cargo.toml`. Migration must populate the manifests it expects.
- `.claude/settings.json` deny list — already contains `apify push glueo/contextractor` and `apify call glueo/contextractor` rules (with duplicates from the v1 sed-replace; harmless, leave alone).

## Untracked clutter to clean up at workspace-prep time

- `packages/contextractor-engine/{dist,node_modules,native}` (no tracked sources)
- `apps/contextractor-apify/{dist,node_modules,storage}` plus the stray `apps/` subdirectory
- `apps/contextractor-standalone/{dist,node_modules}`
- `target/` at the repo root (Cargo build output)
- `node_modules/` at the repo root

These are reverted-v1 build artifacts. The `step-prepare-workspace` step is the right place to remove them before scaffolding the new tree.

## PyPI / npm references in target

`grep -rni 'pypi\|/help/pypi' --include='*.md' --include='*.json' --include='*.toml'` shows hits **only inside `prompts/`** (historical user-entry logs). The migration must not introduce new PyPI / npm references; existing prompt-folder references are read-only history.

## Currently missing files the prompt will create

- `package.json` (workspace root)
- `workspaces` array in `package.json`
- `package-lock.json`
- `Cargo.toml` (workspace root with single member: the napi-rs crate)
- `biome.json`
- `tsconfig.json` (root)
- `.npmrc` (if needed for napi-rs prebuild fetch)
- `.github/workflows/build-napi.yml`
- `packages/contextractor-engine/native/` (Cargo crate, build.rs, src/lib.rs, package.json, npm/<platform>/...)
- `packages/contextractor-engine/{package.json, tsconfig.json, src/index.ts, src/index.test.ts, README.md}`
- `apps/contextractor-apify/{package.json, tsconfig.json, src/{main.ts, handler.ts, extraction.ts, config.ts}, Dockerfile, .actor/*, README.md}`
- `apps/contextractor-standalone/{package.json, tsconfig.json, src/{cli.ts, crawler.ts, config.ts}, README.md}`
- `tools/generated-unit-tests/{package.json, tsconfig.json, vitest.config.ts, *.test.ts, fixtures/}`
- `README.md` (repo root)
