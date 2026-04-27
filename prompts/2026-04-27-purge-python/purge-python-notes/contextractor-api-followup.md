# `tools/apps/contextractor-api/` — purpose decision pending

The Python extraction sidecar at `apps/contextractor-api/python/server.py` and its surrounding plumbing have been removed. The Next.js side of the app still exists, but its purpose without the Python backend is unclear: does it still serve a function (proxy, dashboard, landing page) or should the entire `apps/contextractor-api/` directory plus its workflow and Azure app be retired? **Decision needed from the API owner.**

## Files touched by the deprovision

- `apps/contextractor-api/Dockerfile` — dropped python3 / build-essential / python3-pip / python3-venv apt installs, the `/app/venv` virtualenv, the `pip install -r requirements.txt` step, the `COPY apps/contextractor-api/python/` line, and the related comment about the legacy wheel
- `apps/contextractor-api/supervisord.conf` — dropped the `[program:contextractor]` block (uvicorn). `[program:nodejs]` is the only remaining program, so supervisord is now managing exactly one process; consider whether `start.sh` could `exec node server.js` directly and `supervisord` + `supervisor` apt install could come out
- `apps/contextractor-api/python/` — entire directory deleted (server.py, requirements.txt, .venv, __pycache__)
- `apps/contextractor-api/start.sh` — left as-is (still execs supervisord)
- `apps/contextractor-api/package.json` — no Python scripts found, untouched
- `.github/workflows/contextractor-api.yml` — no Python references, untouched

## Open questions for the owner

- Does the Next.js side of `apps/contextractor-api/` still provide value (any non-sidecar routes, UI, or proxy logic)?
- If not, retire the whole app: delete `apps/contextractor-api/`, `.github/workflows/contextractor-api.yml`, the `prod-contextractor-api-tools` Azure Web App, and the `regtools.azurecr.io/contextractor-api` ACR repository
- If yes, simplify the runner: drop `supervisor`, fold `start.sh` into the Dockerfile `CMD`, and let Node be the container entrypoint
