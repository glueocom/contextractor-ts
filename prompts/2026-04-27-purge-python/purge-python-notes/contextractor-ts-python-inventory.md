# Python references in `contextractor-ts`

Inventory of every Python touchpoint in this repo, classified by user-confirmed handling.

## Python source files (delete)

- `.claude/skills/skill-creator/scripts/init_skill.py`
- `.claude/skills/skill-creator/scripts/package_skill.py`
- `.claude/skills/skill-creator/scripts/quick_validate.py`

User answer: keep `skill-creator/SKILL.md`, drop only the `.py` scripts. `SKILL.md` still references these scripts (`scripts/init_skill.py`, `scripts/package_skill.py`, `scripts/quick_validate.py`); after script deletion, prune those references and any "Quick Validation" / "Bootstrap Script" sections from `SKILL.md`.

## Lineage references (KEEP — user explicitly confirmed)

The user wrote: *"Ok, of course, keep all the notes that ts-trafilatura is ported from Python package."* These document the port lineage and stay:

- `README.md:20`, `apps/contextractor-apify/README.md:12`, `apps/contextractor-standalone/README.md:12`, `packages/contextractor-engine/README.md:43` — "the Python source supported them via Trafilatura" (XML/XML-TEI deferred upstream)
- `CLAUDE.md:5` — same XML/XML-TEI lineage clause
- `docs/spec/tech-spec.md:106` — "TS engine API mirrors the Python source"
- `docs/spec/functional-spec.md:22,125` — Python source / snake_case (Python convention)
- `packages/contextractor-engine/README.md:73,89` — `rs-trafilatura` vs Python `trafilatura` heuristic differences, historical XML support
- `packages/contextractor-engine/native/index.d.ts:9`, `packages/contextractor-engine/src/index.ts:{9,29,53,79,82,119}`, `packages/contextractor-engine/native/src/lib.rs:19`, `packages/contextractor-engine/dist/{index.js,index.d.ts}` — JSDoc / Rustdoc explaining that the surface mirrors the original Python `contextractor_engine` package
- `.claude/agents/rust-pro.md:45` — metadata superset compared to "the Python port"

Do not touch these. They document an immutable historical fact about the port.

## Generic Apify cross-language skill references (KEEP)

These document Apify's *own* Python SDK as a cross-language reference inside repo-level Apify skills — not contextractor's Python:

- `.claude/skills/apify-actor-development/SKILL.md` and `references/{logging,dataset-schema,key-value-store-schema,standby-mode}.md` — Python SDK code blocks alongside JS/TS examples
- `.claude/skills/apify-actorization/SKILL.md` and `references/{python-actorization,cli-actorization,schemas-and-output}.md` — language identification step, Python install/runtime guidance
- `.claude/skills/apify-ops/references/cli-commands.md` — `python-empty` template name

Stripping these would damage the skills' general Apify usefulness for any future cross-language work. Out of scope for this prompt.

## Apify schema editor enum (KEEP)

The string literal `'python'` inside the Apify input-schema editor union — `packages/contextractor-schema/src/apify-meta.ts:26` and the test fixture `packages/contextractor-schema/test/fixtures/apify-input.schema.json` — is part of Apify's own schema spec (the `editor` field accepts `'python'` to render a Python script editor in the Apify UI). It is not contextractor Python. Leave alone.

## Tooling references in meta prompts (KEEP)

`.claude/commands/meta/write-prompt.md:126,128` and `.claude/commands/platform-tests/generate-unit-tests.md:95,150` mention Python as a generic example or as comparative context for `rs-trafilatura` heuristics. Generic. Leave alone.
