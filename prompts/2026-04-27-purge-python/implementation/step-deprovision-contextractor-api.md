# Step DEPROVISION_API: Strip Python from `apps/contextractor-api/` infrastructure

## TLDR

The Python source under `apps/contextractor-api/python/` was deleted in the previous step. Now strip the Python process from the surrounding infrastructure: Dockerfile, supervisord, start script, package.json. Leave the Next.js app's purpose decision as a follow-up note — out of scope here.

## Skills

- `apify-actor-development` skill — context for the supervisord + Dockerfile pattern, even though this is not an Actor
- `ts-pro` — Dockerfile / shell / JSON edits via Edit tool

## Files to update

Each edit uses the Edit tool — surgical, minimal-diff. Inspect the file first to find the Python-specific blocks.

### `apps/contextractor-api/Dockerfile`

Drop every line that installs Python or copies `python/`:

- `apt-get install` lines that name `python3`, `python3-pip`, `python3-venv`, `build-essential` (only if it was added for Python builds)
- `RUN pip install`, `COPY requirements*.txt`, `COPY python/`
- `ENV PYTHONUNBUFFERED`, `ENV PATH=...:/path/to/.venv/bin`, virtualenv setup
- Any `EXPOSE` for the Python server's port if no Node process uses the same port

Keep every line that the Next.js side needs (Node base image, `npm`/`pnpm` install, `next build`, `EXPOSE 3000` or whichever port Next.js uses, etc.).

### `apps/contextractor-api/supervisord.conf`

Delete the `[program:python]` block (or whatever the Python program is named — likely `[program:contextractor]` or `[program:server]`). Keep the Next.js / Node program block. If supervisord is now managing exactly one program, consider whether supervisord is still needed at all — flag in the follow-up note rather than removing it here, because removing supervisord changes the Dockerfile entrypoint contract.

### `apps/contextractor-api/start.sh`

Drop any `python` / `pip` / `venv` invocations. If the script's only job was to bootstrap Python and then `exec supervisord`, simplify to a one-line `exec` of the Node entrypoint and update the Dockerfile `CMD` to call it (or just inline the `CMD` and delete `start.sh`).

### `apps/contextractor-api/package.json`

Remove any scripts that invoke `python`, `pip`, or `venv`. Remove any `dependencies` / `devDependencies` that exist solely for the Python toolchain (`python-shell`, etc.).

### `pnpm-workspace.yaml`

Leave `apps/contextractor-api` in the workspace — the Next.js side still belongs there.

### `.github/workflows/contextractor-api.yml`

Verify the workflow still passes after the Dockerfile slimming. The workflow does not need new edits unless it explicitly references Python (`pip cache`, `setup-python` action, etc.) — if it does, drop those steps.

## Follow-up note

Create `../purge-python-notes/contextractor-api-followup.md` with two short paragraphs:

- Without the Python extractor, the API's purpose is unclear — does the Next.js side still serve a function (proxy? dashboard? landing page?) or should the entire `apps/contextractor-api/` directory be retired and the workflow / Azure app deleted? Decision needed from the API owner.
- Names of every infrastructure file the deprovision touched, so the follow-up has a starting point for the retirement decision.

This note is for the maintainer, not for execution in this prompt.

## Verify

- `docker build apps/contextractor-api` succeeds locally (or at least, the Dockerfile parses with `docker buildx build --check` if Docker is unavailable)
- The built image does not contain `/usr/bin/python3` or any `pip` cache (verify with `docker run --rm <image> which python3 || echo missing`)
- `pnpm -r build && pnpm -r test && pnpm -r lint` from the tools repo root still pass
- `git -C /Users/miroslavsekera/r/tools diff -- apps/contextractor-api/` shows only the listed edits
