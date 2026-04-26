# Follow-up prompt for `/Users/miroslavsekera/r/tools/`

This migration's last step **emits** a separate prompt file at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite/`. It is **not** executed in this run.

## Inventory of `r/tools/` surfaces touching contextractor

Confirmed present 2026-04-26 (read-only checks during this prompt; no writes outside the `r/tools/prompts/` follow-up):

- `apps/contextractor-site/` — Next.js marketing/help site. Contains the `/help/pypi/` route.
- `apps/contextractor-api/` — Next.js API.
- `distributed-packages/contextractor-engine/` — currently a bundled Python wheel (`contextractor_engine-0.3.12-py3-none-any.whl`) plus extracted package. Replace with the TS engine artifact set + napi-rs prebuilds, or remove if no longer distributed from this monorepo.
- `.claude/commands/projects/contextractor/{sync-all.md, sync-docs.md, sync-gui.md}` — orchestrator commands.

## What the follow-up prompt must cover

- Update `apps/contextractor-site` content: replace PyPI / npm install instructions with Apify-actor-only messaging. **Modify** (do not delete) the `/help/pypi/` route to mark the PyPI package as no longer maintained. Remove links to `/help/pypi/` from other docs and `.md` files.
- Apply the "built on rs-trafilatura **and** [Crawlee](https://crawlee.dev/)" wording rule across `apps/contextractor-site` copy and meta tags, `apps/contextractor-api` README, and `distributed-packages/contextractor-engine/README`.
- Update `apps/contextractor-api` schemas / fixtures to match the new `apps/contextractor-apify/.actor/` schemas (XML / XML-TEI removed, `pruneXpath` / `dateExtractionParams` removed from the `trafilaturaConfig` description).
- Replace `distributed-packages/contextractor-engine/` with the new TS engine artifact set (TS `dist/` + napi-rs prebuilt `.node` files), or remove the directory if no longer distributed from this monorepo.
- Update `.claude/commands/projects/contextractor/{sync-docs.md, sync-gui.md}` source-of-truth paths to match the TS-engine + napi-rs reality.
- Conclude by running `/Users/miroslavsekera/r/tools/.claude/commands/projects/contextractor/sync-all.md`.

## Out of scope for this prompt

- Anything inside `r/tools/` is not touched in this run — only the follow-up prompt file is created in `r/tools/prompts/`.
- Production deploys for `contextractor-site` / `contextractor-api` are out of scope.
- Production Apify deploy of `glueo/contextractor` is out of scope (test actor only: `glueo/contextractor-test`).
