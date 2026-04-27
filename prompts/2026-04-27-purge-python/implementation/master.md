# Purge Python — implementation master

## TLDR

Delete every remaining Python source file in `contextractor-ts` and `/Users/miroslavsekera/r/tools/`, retire the PyPi distribution and its help page, and clean docs that imply current Python use. **Preserve** historical lineage notes that document the port from Python `trafilatura` / `contextractor_engine`. Touch only one prompt file in `contextractor-ts/prompts/`.

## Skills and Agents

- `ts-pro` — Dockerfile / supervisord / sitemap-JSON edits, skill-creator SKILL.md trim
- `apify-actor-development` skill — referenced for `apps/contextractor-api/` Docker + supervisord pattern context
- `code-reviewer` — runs after every step; the surface is small and docs-heavy, perfect for surgical review
- `test-runner` — `pnpm -r build && pnpm -r test && pnpm -r lint` in both repos after the destructive steps

## Shared context

- Two repos in scope: `/Users/miroslavsekera/r/contextractor-ts/` and `/Users/miroslavsekera/r/tools/`. Run repo-local commands from each repo's root
- `prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md` is the **only** prompt file in scope across `contextractor-ts/prompts/`
- `tools/.claude/commands/projects/contextractor/sync-{docs,gui}.md` are owned by the zod-schema-unification prompt — leave alone here
- `../user-entry-log/entry-initial-prompt.md` — the user's original six-line prompt
- `../user-entry-log/entry-qa-tools-scope.md`, `entry-qa-pypi-page.md`, `entry-qa-skill-creator.md`, `entry-qa-historical-refs.md` — the four scope decisions captured up front
- `../purge-python-notes/contextractor-ts-python-inventory.md` — every Python touchpoint in this repo, classified
- `../purge-python-notes/tools-repo-python-inventory.md` — Python sources, build/CI hooks, PyPi-page side-effects in tools
- `../purge-python-notes/update-markdown-prompt-edits.md` — exact surgical edits to the zod prompt

## Steps in execution order

- [step-edit-zod-prompt](step-edit-zod-prompt.md) — surgical edit to remove unnecessary Python mentions from `update-markdown-prompt.md`
- [step-purge-contextractor-ts-python](step-purge-contextractor-ts-python.md) — delete `.claude/skills/skill-creator/scripts/*.py` and trim the skill's `SKILL.md`
- [step-purge-tools-python-source](step-purge-tools-python-source.md) — delete Python source files in tools repo (skill scripts, distributed wheel residue, contextractor-api `python/`)
- [step-deprovision-contextractor-api](step-deprovision-contextractor-api.md) — strip the Python process from `apps/contextractor-api/` Dockerfile, `supervisord.conf`, `start.sh`, and `package.json`; leave a follow-up note
- [step-delete-pypi-page](step-delete-pypi-page.md) — delete `apps/contextractor-site/content/automatic/help/pypi/`, unlink it from the help index, drop it from the sitemap, and add a `/help/pypi` → `/help/npm` 301 redirect
- [step-update-tools-docs](step-update-tools-docs.md) — update `tools/CLAUDE.md` and `tools/docs/contextractor.md` to drop "Python extraction engine" framing while preserving port-lineage facts

## Do not

- Touch any prompt file except `prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md`
- Edit `tools/.claude/commands/projects/contextractor/sync-{docs,gui}.md` (owned by zod-schema-unification)
- Strip Python sections from `apify-actor-development` / `apify-actorization` / `apify-ops` skills — Python is generic Apify-SDK reference there, not contextractor Python
- Strip the `'python'` editor-enum literal in `packages/contextractor-schema/src/apify-meta.ts` — that is part of Apify's own input-schema spec
- Hand-edit any `dist/`, `dist-content/`, or `.next/` build output — regenerate from source instead
- Retire the Next.js side of `apps/contextractor-api/` — only remove the Python process; flag the rest as a follow-up
- Touch `apps/pythonescaper-redir/` — different product, unrelated to contextractor
- Remove any port-lineage statement ("Python source", "mirrors the Python", "ports Python `trafilatura`")

## Style

- Minimal-diff per `.claude/rules/minimal-diff.md`; JSON examples only per `.claude/rules/json-config-only.md`; no confirmation prompts per `.claude/rules/no-confirmation-prompts.md`
- Match each file's existing voice — `tools/` site articles are public-facing; READMEs are developer-facing

## Verify (final gate)

- No `.py` files remain under `/Users/miroslavsekera/r/contextractor-ts/` outside `node_modules/`
- No `.py` files remain under `/Users/miroslavsekera/r/tools/` outside `node_modules/`, `.venv/`, or `pythonescaper-redir/`
- `pnpm -r build && pnpm -r test && pnpm -r lint` succeed in both repos
- `apps/contextractor-api/` Docker image builds without Python
- `pnpm -F contextractor-site build` succeeds in tools, and the produced sitemap does not include `/help/pypi`
- `redirects.json` returns 301 from `/help/pypi` → `/help/npm`
- `git diff` against `update-markdown-prompt.md` shows only the two intended edits
- All lineage references that were present before remain present after
