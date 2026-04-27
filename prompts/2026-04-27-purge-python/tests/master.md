# Purge Python — tests master

## TLDR

Per-step review + autofix, then a final user-intent gate. Every test step inspects `git diff` for the corresponding implementation step, runs build/lint/format, and **automatically fixes** any deviation it finds. The final user-intent step cross-checks the entire change set against `entry-initial-prompt.md`.

## Agents and skills

- `code-reviewer` — every per-step review (correctness, hygiene, surgical-diff discipline)
- `test-runner` — `pnpm -r build && pnpm -r test && pnpm -r lint` in both repos at the end of each destructive step
- `ts-pro` — autofix any TS/JSON/markdown lint failures the reviewer surfaces
- `apify-actor-development` skill — sanity-check the Dockerfile / supervisord trim in `apps/contextractor-api/`

## Shared context

- Read `../implementation/master.md` first; each test step references its peer implementation step and its diff scope
- Both repos in scope; run repo-local commands from each repo's root
- Lineage references (`Python source`, `mirrors the Python`, `ports Python \`trafilatura\``) are protected — any test that finds one *removed* by the implementation must autofix by reverting that specific change

## Steps in execution order

- [step-test-edit-zod-prompt](step-test-edit-zod-prompt.md) — verify exactly two hunks landed in `update-markdown-prompt.md`
- [step-test-purge-contextractor-ts-python](step-test-purge-contextractor-ts-python.md) — verify zero `.py` files remain in contextractor-ts and SKILL.md is internally consistent
- [step-test-purge-tools-python-source](step-test-purge-tools-python-source.md) — verify zero in-scope `.py` files remain in tools repo
- [step-test-deprovision-contextractor-api](step-test-deprovision-contextractor-api.md) — verify Docker image builds, no Python in supervisord/start.sh
- [step-test-delete-pypi-page](step-test-delete-pypi-page.md) — verify page gone, sitemap/help-index/redirects updated, site builds
- [step-test-update-tools-docs](step-test-update-tools-docs.md) — verify only Python-current framing was removed; lineage notes preserved
- [step-test-user-intent](step-test-user-intent.md) — final cross-check against `entry-initial-prompt.md`; autofix any gap or mismatch
