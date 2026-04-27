# Update Contextractor markdown across both repos

Update all Contextractor-related markdown in `/Users/miroslavsekera/r/contextractor-ts/` and `/Users/miroslavsekera/r/tools/` so prose, examples, and feature lists match the post-unification state of the codebase.

## Required reading — in this order, before editing anything

- Commit `f53a1c9c12fbab652b22f09682422d8f2851e596` (run `git show f53a1c9c` in `/Users/miroslavsekera/r/contextractor-ts/`) — the actual code change being documented
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-27-zod-schema-unification/prompt.md` — implementation spec (Zod 4 + Commander 12 unification, INPUT_SCHEMA generator)
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-27-zod-schema-unification/markdown-region-templating-research.md` — third-party tooling option
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-27-zod-schema-unification/stack-native-markdown-generation-research.md` — verdict: ~60-line DIY beats `markdown-magic`; oclif-style markers; deferred to a later prompt

## Scope — markdown to update

In `/Users/miroslavsekera/r/contextractor-ts/`:

- `README.md` (root)
- `apps/contextractor-apify/README.md`
- `apps/contextractor-standalone/README.md`
- `packages/contextractor-engine/README.md`
- `packages/contextractor-schema/README.md` (new — write from scratch; one-paragraph package overview, install, the four exports `ContextractorInput`, `ContextractorInputType`, `apifyMeta`, `writeApifyInputSchema`, link to `prompt.md`)
- `tools/gen-input-schema/README.md` (new — one paragraph, what it does, how the Apify build pipeline invokes it)
- Anything else under `docs/` that mentions input handling, `ActorInput`, `INPUT_SCHEMA.json` editing, or hand-rolled coercion

In `/Users/miroslavsekera/r/tools/`:

- `apps/contextractor-site/content/automatic/help/help.md` and `help-blurb.md`
- `apps/contextractor-site/content/automatic/help/apify/apify.md`
- `apps/contextractor-site/content/automatic/help/npm/npm.md` and any `docker/` / `pypi/` / `web/` siblings
- `apps/contextractor-site/content/automatic/about/`, `formats/`, `cookie-consent-handling/`, `trafilatura/`, `extraction-vs-headless-browser/` and any other `automatic/*/` article that references CLI flags, INPUT_SCHEMA fields, or "the Python version" defaults
- `apps/contextractor-api/` markdown if any
- `user-docs/` and root `docs/` entries that mention Contextractor

## What to change

- Replace any reference to a hand-edited `INPUT_SCHEMA.json` with "generated from `@contextractor/schema`'s Zod schema at build time"
- Replace any reference to the deleted helpers (`mergeOverrides`, `fromDict`, `normalizeKeys`, `defaultCrawlConfig`, the `ActorInput` interface) with "Zod 4 schema validation at the input boundary"
- Update CLI flag listings and INPUT_SCHEMA field listings only if the visible surface changed in commit `f53a1c9c`. Cosmetic JSON re-flow of `input_schema.json` is not a content change — do not call it out
- For any feature-comparison or "how Contextractor works" article in `tools/apps/contextractor-site/content/`, add a sentence that the same Zod schema feeds the CLI and the Apify Actor input
- Do not document `markdown-magic`, `mdast-zone`, or the README region-templating idea — those are deferred to a separate prompt and not yet implemented
- Do not mention Phase-2/3 deferrals (`CrawlConfig` deduplication, MCP wiring, `zod-to-apify-input-schema` npm publish) in user-facing docs; those belong in `prompt.md` only

## Style

- Match the existing voice of each file — `tools/` site articles are public-facing prose, `contextractor-ts/` READMEs are developer-facing
- Minimal-diff per `.claude/rules/minimal-diff.md`; no reformatting of untouched paragraphs
- JSON examples only per `.claude/rules/json-config-only.md`; no YAML
- No confirmation prompts per `.claude/rules/no-confirmation-prompts.md`

## Verification

- `git diff` in both repos shows only Contextractor-related markdown changes
- `pnpm -F contextractor-site build` (or the existing site build script) succeeds in `/Users/miroslavsekera/r/tools/`
- `cspell` passes if either repo runs it in CI
- No code, schema, or `INPUT_SCHEMA.json` changes in this prompt — markdown only

## Out of scope

- README region templating (separate follow-up prompt; see `stack-native-markdown-generation-research.md` § "Implications for `prompt.md`")
- Any code change in either repo
- New articles or major restructuring of the contextractor-site
