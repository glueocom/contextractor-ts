# Update Contextractor markdown across both repos

Sync prose, examples, and feature lists in all Contextractor-related markdown to the post-unification state of the codebase. **Markdown only — no code, schema, or `INPUT_SCHEMA.json` edits.**

## Read first, in this order

- Commit `f53a1c9c12fbab652b22f09682422d8f2851e596` — `git show f53a1c9c` in `/Users/miroslavsekera/r/contextractor-ts/`
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-27-zod-schema-unification/prompt.md` — implementation spec
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-27-zod-schema-unification/markdown-region-templating-research.md`
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-27-zod-schema-unification/stack-native-markdown-generation-research.md`

## Files in scope

In `/Users/miroslavsekera/r/contextractor-ts/`:

- `README.md`
- `apps/contextractor-apify/README.md`
- `apps/contextractor-standalone/README.md`
- `packages/contextractor-engine/README.md`
- `docs/spec/tech-spec.md`
- `docs/spec/functional-spec.md`
- `docs/troubleshooting/timeout/report.md` (only if it names removed helpers)
- `packages/contextractor-schema/README.md` — **new**: one-paragraph overview, install, exported names (`ContextractorInput`, `ContextractorInputType`, `apifyMeta`, `writeApifyInputSchema`), link to `prompts/2026-04-27-zod-schema-unification/prompt.md`
- `tools/gen-input-schema/README.md` — **new**: one paragraph; what it does and how the Apify build pipeline invokes it via `pnpm -F @contextractor/gen-input-schema start`

In `/Users/miroslavsekera/r/tools/`:

- `apps/contextractor-site/content/automatic/help/help.md`
- `apps/contextractor-site/content/automatic/help/apify/apify.md`
- `apps/contextractor-site/content/automatic/help/npm/npm.md`
- `apps/contextractor-site/content/automatic/help/docker/docker.md`
- `apps/contextractor-site/content/automatic/help/pypi/pypi.md`
- `apps/contextractor-site/content/automatic/help/web/web.md`
- `apps/contextractor-site/content/automatic/about/about.md`
- `apps/contextractor-site/content/automatic/formats/formats.md`, `cookie-consent-handling/`, `trafilatura/`, `extraction-vs-headless-browser/`, and any other `automatic/*/` article that names CLI flags, INPUT_SCHEMA fields, or "the Python version" defaults
- `docs/contextractor.md`

Skip `apps/contextractor-site/dist-content/**` — it is build output. Skip `*-blurb.md` files unless they name CLI flags or INPUT_SCHEMA fields. Skip `packages/internal-brands/content/contextractor/**` unless `grep` shows it is the source for `contextractor-site` content.

## What to change

- Replace any reference to a hand-edited `INPUT_SCHEMA.json` with "generated from `@contextractor/schema`'s Zod 4 schema at build time by `@contextractor/gen-input-schema`"
- Replace references to deleted helpers (`mergeOverrides`, `fromDict`, `normalizeKeys`, `defaultCrawlConfig`, the `ActorInput` interface) with "Zod 4 schema validation at the input boundary"
- Where an article describes how Contextractor receives input, add one sentence: the same Zod schema feeds the standalone CLI (Commander 12 → `parse()`) and the Apify Actor (`Actor.getInput()` → `parse()`)
- Update CLI flag listings and INPUT_SCHEMA field listings only where the visible surface changed in `f53a1c9c`. Cosmetic JSON re-flow of `input_schema.json` is not a content change — do not call it out
- Note the breaking change to `loadConfigFile` in `apps/contextractor-standalone/README.md` only: legacy snake_case config and nested `proxy: { urls, rotation }` are no longer accepted; use the Apify-input camelCase shape

## Do not

- Document `markdown-magic`, `mdast-zone`, or README region templating — deferred to a separate prompt
- Mention Phase-2/3 deferrals (`CrawlConfig` deduplication, MCP wiring, `zod-to-apify-input-schema` npm publish) — those belong in `prompt.md` only
- Touch any code, JSON schema, or `INPUT_SCHEMA.json`
- Reformat untouched paragraphs

## Style

- Match each file's existing voice — `tools/` site articles are public-facing; `contextractor-ts/` READMEs are developer-facing
- Minimal-diff per `.claude/rules/minimal-diff.md`; JSON examples only per `.claude/rules/json-config-only.md`; no confirmation prompts per `.claude/rules/no-confirmation-prompts.md`

## Verify

- `git diff` in both repos shows only Contextractor-related markdown changes
- `pnpm -r build` succeeds in `/Users/miroslavsekera/r/contextractor-ts/`
- The site build script succeeds in `/Users/miroslavsekera/r/tools/` (e.g. `pnpm -F contextractor-site build`)
- `cspell` passes if either repo runs it in CI
