# Spec Maintenance

Root `SPEC.md` and each package/app `SPEC.md` must be kept in sync with the code. Update the relevant spec immediately when making changes — don't defer to a follow-up.

## When to update specs

Update the relevant SPEC.md in the **same response** as the source change — never defer to a follow-up.

Update the affected `SPEC.md` when:
- A public API changes (new exports, renamed functions, changed signatures)
- Input or output schema fields change
- Data flow or architecture changes
- New packages are added or removed
- A new feature is added or an existing one removed

## Spec locations

- `SPEC.md` — system-level overview, architecture, stack, build, Docker, CI
- `packages/extraction/SPEC.md` — `@contextractor/extraction` public API and behavior
- `packages/crawler/SPEC.md` — `@contextractor/crawler` public API and sink pattern
- `packages/schema/SPEC.md` — input schema fields and generation pipeline
- `apps/apify-actor/SPEC.md` — Actor data flow, sinks, deploy
- `apps/standalone/SPEC.md` — CLI usage, config merge, output

## How to update

Read the changed source files, compare against the current spec, and update only the affected sections. Use the Edit tool for surgical changes. Do not rewrite unchanged sections.

SPEC.md is the only colocated documentation format — do not create prd.md or separate requirements files.
