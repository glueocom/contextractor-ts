# Python residue in `/Users/miroslavsekera/r/tools/`

User answered Q1 with "Docs + delete dead Python code" — drop Python source and supporting build/CI plumbing, no TS replacement stub.

## Python source to delete

- `apps/contextractor-api/python/server.py` (and the entire `python/` subdirectory)
- `distributed-packages/contextractor-engine/contextractor_engine/{__init__,extractor,models,utils}.py` — leftover Python wheel sources. The npm-engine import script (`tools/package.json` `import:contextractor-engine`) `rm -rf`s and rewrites this directory with TS dist anyway, so the Python files are stale residue from before the migration.

`/Users/miroslavsekera/r/tools/.claude/skills/skill-creator/scripts/*.py` exists too. The user's answer (Q3) was "keep skill, drop only Python scripts" — apply the same handling here as in contextractor-ts.

## `apps/contextractor-api/` — split-status

The app is a Next.js wrapper that runs a Python extraction server alongside it via `supervisord.conf` + `start.sh`. Files implicated:

- `apps/contextractor-api/Dockerfile` — installs Python, copies `python/`
- `apps/contextractor-api/supervisord.conf` — manages the Python `server.py` process
- `apps/contextractor-api/start.sh` — entrypoint that runs supervisord
- `apps/contextractor-api/package.json` — may list Python install/build steps
- `apps/contextractor-api/python/server.py` — the Python extraction server itself
- `pnpm-workspace.yaml` — includes `apps/contextractor-api`
- `.github/workflows/contextractor-api.yml` — builds and deploys the Docker image to `regtools.azurecr.io/contextractor-api`, app name `prod-contextractor-api-tools`

The Next.js side may or may not still serve a purpose without the Python backend. **Out of scope for this prompt**: do not retire the Next.js app; only remove the Python process from the Docker image, supervisord config, start script, and package.json. Leave a follow-up note in a `purge-python-notes/contextractor-api-followup.md` flagging that the API's purpose without the Python extractor needs an owner decision.

## Build/CI references to clean

- `tools/package.json` `import:contextractor-engine` script — already TS-only (it `rm -rf`s and rewrites the distributed dir). No edit needed; the stale `contextractor_engine/*.py` files just need deletion at the filesystem level so they do not reappear if someone runs the script before noticing.
- `tools/CLAUDE.md:7,40` — references "API service wrapping Python extraction engine" (line 64 of `docs/contextractor.md` too) and a "When working on Python code" section. Update to TS-only.
- `apps/contextractor-api/Dockerfile` — drop Python `apt-get`, `pip install`, and `COPY python/`
- `apps/contextractor-api/supervisord.conf` — drop the Python program block
- `apps/contextractor-api/start.sh` — drop Python startup
- `apps/contextractor-api/package.json` — drop any Python build/lint scripts

## PyPi help page

`apps/contextractor-site/content/automatic/help/pypi/pypi.md` — entire page deleted per Q2.

Side effects to verify:

- `apps/contextractor-site/content/automatic/help/help.md` — help index linking to `pypi/`
- `apps/contextractor-site/dist-content/automatic/help/pypi/` — build output mirror; safe to ignore (regenerated from `content/`) but verify it disappears after next build
- `apps/contextractor-site/redirects.json` — add `/help/pypi` → `/help/npm` (301)
- `apps/contextractor-site/additional-sitemap.json` and any `app/sitemap.ts` — drop the `/help/pypi` URL
- `apps/contextractor-site/see-also-placement.json` and `external-services-placement.json` — search for `pypi`/`/help/pypi` references and remove
- `.next/` build output (`prerender-manifest.json`, server-rendered HTML/`.rsc` shards) is regenerated; do not hand-edit, just verify the next build lacks `/help/pypi`

## Public-facing content articles — KEEP unchanged

These mention Python in the context of describing third-party libraries (Trafilatura, readability-lxml, Newspaper4k, html2text), not contextractor's distribution. Public reference content; leave alone:

- `apps/contextractor-site/content/automatic/trafilatura/trafilatura.md`
- `apps/contextractor-site/content/automatic/trafilatura-vs-readability-vs-newspaper/trafilatura-vs-readability-vs-newspaper.md`
- `apps/contextractor-site/content/automatic/trafilatura-vs-jina-readerlm/trafilatura-vs-jina-readerlm.md`
- `apps/contextractor-site/content/automatic/markdown/markdown.md`
- Any other `automatic/*/` article that names third-party Python libraries

## Sync-command updates — defer to zod-schema-unification

`/Users/miroslavsekera/r/tools/.claude/commands/projects/contextractor/sync-{docs,gui}.md` reference Python paths (e.g. `contextractor_cli/main.py`, `models.py`). These files are already in scope of `prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md`. **Do not edit them in this prompt** — the zod-schema-unification work will repoint them to the canonical Zod schema sources. Avoiding edits keeps the two prompts orthogonal.

## `pythonescaper-redir` — out of scope

`/Users/miroslavsekera/r/tools/apps/pythonescaper-redir/` is a redirect site for an unrelated product (Python-string-escaper tool). Different product, leave alone.
