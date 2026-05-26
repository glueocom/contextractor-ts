# User-Facing Documentation

`apps/apify-actor/README.md` is the Actor's public-facing page in the Apify Store. It is read by users who run the Actor from the Apify Console — not by developers deploying or maintaining it.

## Never include in user-facing docs

- Deploy instructions (Git-connected builds, `apify push`, Dockerfile details)
- Internal actor IDs or branch-to-actor mappings (`dev` → `contextractor-test`)
- References to internal CLI commands (`.claude/commands/…`)
- Rename or migration notes for past repo restructuring
- Anything that only makes sense to someone with repo access

## Where deploy and maintenance docs belong

- `CLAUDE.md` — project-wide developer context
- `apps/apify-actor/SPEC.md` — Actor architecture and data flow
- `.claude/rules/apify-production.md` — deploy protection rules
- `.claude/commands/platform/deploy-and-test.md` — deploy workflow
