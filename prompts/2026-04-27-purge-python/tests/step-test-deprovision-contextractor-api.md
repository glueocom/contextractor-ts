# Test DEPROVISION_API

## TLDR

Verify `apps/contextractor-api/` no longer installs or runs Python, the Docker image still builds, and the follow-up note exists. Autofix any deviation.

## Inputs

- `../implementation/step-deprovision-contextractor-api.md`
- `../purge-python-notes/tools-repo-python-inventory.md`

## Checks

- `grep -inE 'python|pip|venv|requirements\.txt' /Users/miroslavsekera/r/tools/apps/contextractor-api/{Dockerfile,supervisord.conf,start.sh,package.json}` returns zero results (other than comments, if any)
- `apps/contextractor-api/Dockerfile` does not `COPY` a `python/` directory and does not run `apt-get install` for Python packages
- `apps/contextractor-api/supervisord.conf` has no `[program:*]` block whose command runs Python
- `apps/contextractor-api/start.sh` does not invoke Python
- `docker buildx build --check apps/contextractor-api` (or `docker build apps/contextractor-api` if a Docker daemon is available) succeeds
- The follow-up note `purge-python-notes/contextractor-api-followup.md` exists and is non-empty
- `pnpm -r build && pnpm -r test && pnpm -r lint` from `/Users/miroslavsekera/r/tools/` succeed
- `.github/workflows/contextractor-api.yml` parses (`yamllint` if available, or `gh workflow view contextractor-api` / a syntactic-only check)

## Autofix

- If a Python install line slipped through, Edit-tool the Dockerfile / supervisord / start.sh to remove it
- If the build fails because a Node program in supervisord depends on a Python helper that was removed, restore the Node program's standalone behavior (e.g. drop a `depends_on` directive) — do not re-add Python
- If the follow-up note is missing, write a two-paragraph note as described in the implementation step
- If the workflow file is broken, restore the previous version with `git checkout` and reapply only the necessary changes

## Done when

All checks pass; the Docker build succeeds without Python, the follow-up note exists, and `git diff -- apps/contextractor-api/` shows only intended infrastructure edits.
