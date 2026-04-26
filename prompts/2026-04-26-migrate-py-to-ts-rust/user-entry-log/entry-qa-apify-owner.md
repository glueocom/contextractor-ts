# QA — Apify owner

## Question

The raw prompt names `glueo/contextractor-test` as the Apify test actor, but `contextractor-ts/CLAUDE.md` and the `apify-ops` skill reference `shortc/contextractor-test`. Which owner should be canonical for this repo?

## Answer

**`glueo` (raw prompt) is canonical.**

## Implication

- Update `CLAUDE.md` to reference `glueo/contextractor-test` (default) and `glueo/contextractor` (production with `--production`).
- Update `apps/contextractor-apify/.actor/actor.json` and `.actor/input_schema.json` defaults if they hard-code an owner.
- Audit `.claude/skills/apify-*/SKILL.md`, `.claude/commands/platform/*.md`, and `.claude/commands/git/release.md` — replace every `shortc` mention with `glueo`.
- Audit READMEs and `apps/*/README.md` for owner mentions in deployment sections.
