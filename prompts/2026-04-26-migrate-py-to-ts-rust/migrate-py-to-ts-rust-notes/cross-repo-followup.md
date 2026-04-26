# Follow-up prompt for `/Users/miroslavsekera/r/tools/`

This migration's last step generates a separate prompt file at `/Users/miroslavsekera/r/tools/prompts/<date>-propagate-contextractor-rewrite.md` — it is **not** executed in this run.

## Inventory of `r/tools/` surfaces touching contextractor

Confirmed present 2026-04-26:

- `apps/contextractor-site/` — Next.js marketing/help site (contains `/help/pypi/` route).
- `apps/contextractor-api/` — Next.js API.
- `distributed-packages/contextractor-engine/` — currently bundled Python wheel `contextractor_engine-0.3.12-py3-none-any.whl` plus extracted package. Will need replacement by the new TS engine + napi-rs prebuilds, distributed differently.
- `.claude/commands/projects/contextractor/{sync-all.md, sync-docs.md, sync-gui.md}` — orchestrator commands.

## What the follow-up prompt must cover

- Update `apps/contextractor-site` content: replace PyPI/npm install instructions with Apify-actor-only messaging; **modify** (do not delete) `/help/pypi/` route to mark the PyPI package as no longer maintained; remove links to `/help/pypi/` from other docs and `.md` files.
- Update `apps/contextractor-api` schemas / fixtures to match new input/output schemas from `apps/contextractor-apify/.actor/`.
- Replace `distributed-packages/contextractor-engine` with the new TS engine artifact set (TS `dist/` + napi-rs prebuilt `.node` files), or remove if no longer distributed from this monorepo.
- Update `.claude/commands/projects/contextractor/{sync-docs.md, sync-gui.md}` source-of-truth paths to match the new TS-engine + napi-rs reality.
- The follow-up prompt must conclude by running `/Users/miroslavsekera/r/tools/.claude/commands/projects/contextractor/sync-all.md`.

## Out of scope for this prompt

- Anything inside `r/tools/` is not touched in this run — only the follow-up prompt file is created.
- Production deploys for `contextractor-site` / `contextractor-api` are out of scope.
