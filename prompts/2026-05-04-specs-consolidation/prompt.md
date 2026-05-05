Merge functional and tech specs into root SPEC.md plus sub specs for each project

Merge `/Users/miroslavsekera/r/contextractor-ts/docs/spec/functional-spec.md` and `/Users/miroslavsekera/r/contextractor-ts/docs/spec/tech-spec.md` into one `/Users/miroslavsekera/r/contextractor-ts/SPEC.md`, then delete `/Users/miroslavsekera/r/contextractor-ts/docs/spec/functional-spec.md` and `/Users/miroslavsekera/r/contextractor-ts/docs/spec/tech-spec.md`.

The project is Python-free — migrated from Python but now entirely TypeScript (all app logic) + Rust (only [`rs-trafilatura`](https://github.com/Murrough-Foley/rs-trafilatura) called via a napi-rs binding). Any Python skills, configs, or references found during the work must be removed.

Add concise `SPEC.md` to each:
- `/Users/miroslavsekera/r/contextractor-ts/packages/crawler`
- `/Users/miroslavsekera/r/contextractor-ts/packages/extraction`
- `/Users/miroslavsekera/r/contextractor-ts/packages/schema`
- `/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor`
- `/Users/miroslavsekera/r/contextractor-ts/apps/standalone`

Create rules referenced in CLAUDE.md stating specs must be automatically maintained. Create a skill if required.

Do not touch opencode setup — it will be handled in a separate prompt.

When writing specs, consider these latest prompts:
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-04-schema-refactor`
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-29-engine-rearchitecture`
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-27-zod-schema-unification`
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-27-purge-python`
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-26-migrate-py-to-ts-rust-v2`
- `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-25-migrate-to-mcpc`

## Claude Code config consolidation

Greenfield restructure — no backward compatibility required. `.claude/skills/` is the only home for custom extensions in May 2026; `.claude/commands/` is legacy.

- **Update all related references.** Search and update path references and prose in: `CLAUDE.md` (root and nested), `.claude/agents/*.md`, `.claude/settings.json`, `.claude/settings.local.json`, `.mcp.json`, `README.md`, `CONTRIBUTING.md`, `docs/**/*.md`, and any `prompts/**/prompt.md` or `_run-all.md` orchestrators that reference the old `.claude/commands/` paths. Slash invocations (`/foo`) stay as-is. Collapse any "commands vs skills" prose to just "skills".

- **Entirely ignore anything related to opencode** — no edits to `opencode.json`, `.opencode/`, or OpenCode references in docs. Will be resolved in another prompt.
