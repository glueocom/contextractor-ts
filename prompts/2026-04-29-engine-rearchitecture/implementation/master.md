# Engine Rearchitecture — Implementation Master

## TLDR

Splits `packages/contextractor-engine` into `@contextractor/extraction` (pure) and `@contextractor/crawler` (Crawlee + Playwright). Replaces bespoke `COOKIE_DISMISS_SCRIPT` with `@ghostery/adblocker-playwright`. Renames both apps and schema package. Adds `@duckduckgo/autoconsent` fallback. Sweeps all docs. Single feature branch; each step is a commit checkpoint.

See [`../engine-rearchitecture.md`](../engine-rearchitecture.md) for the full prompt.

## Skills and Agents

**Implementation**: `ts-pro` (TypeScript packages, imports, Biome), `rust-pro` (Cargo.toml, native rename)
**Review**: `code-reviewer`
**Testing**: `test-runner`
**Skills**: `apify-actor-development`, `apify-schemas`, `rust-packaging`

## Steps (execute in order)

- [`step-create-extraction.md`](./step-create-extraction.md) — Rename engine package to `@contextractor/extraction`; rename native binding; move `computeContentInfo` + `projectMetadata`
- [`step-create-crawler.md`](./step-create-crawler.md) — Create `@contextractor/crawler`; wire Ghostery; replace scroll loop; shrink app entry points to ≤30/≤40 LOC
- [`step-rename-apps.md`](./step-rename-apps.md) — Rename apps and schema package; update all internal references
- [`step-autoconsent.md`](./step-autoconsent.md) — Add `@duckduckgo/autoconsent` lazy fallback to the crawler package
- [`step-docs-sweep.md`](./step-docs-sweep.md) — Sweep all READMEs, `.actor/` specs, and `CLAUDE.md`

## Shared Context

- **Branch**: single feature branch off `dev`; commit after each step
- **Workspace globs**: `apps/*` and `packages/*` in `pnpm-workspace.yaml` need no change
- **Cargo workspace**: `Cargo.toml` member path changes in step CREATE-EXTRACTION
- **Apify Console**: git path update is a **manual** step during RENAME-APPS (document in the commit message)
- **Node requirement**: Node 22+ — use `globalThis.fetch`, no `cross-fetch` or `node-fetch`
- **License guard**: never add `idcac-playwright` (GPL-3.0) or `@cliqz/adblocker-playwright` (deprecated)
