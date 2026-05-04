Merge functional and tech specs into root SPEC.md plus sub specs for each project

Merge `/Users/miroslavsekera/r/contextractor-ts/docs/spec/functional-spec.md` and `/Users/miroslavsekera/r/contextractor-ts/docs/spec/tech-spec.md` into one `/Users/miroslavsekera/r/contextractor-ts/SPEC.md`.

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
