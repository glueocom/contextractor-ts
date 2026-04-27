# Q&A — Tools repo scope

## Question

In `/Users/miroslavsekera/r/tools/`, what is the scope: docs only, or also delete the residual Python source?

## Options offered

- Docs only — leave code alone
- Docs + delete dead Python code
- Docs + delete + replace (TS stub for the API server)

## User answer

**Docs + delete dead Python code.** Drop `distributed-packages/contextractor-engine/` Python residue and `apps/contextractor-api/python/server.py`, plus the package.json scripts / CI references that build, publish, or install them. Do **not** stub a TS replacement.

## Implications for implementation

- `step-purge-tools-python-source` deletes the Python source files
- `step-deprovision-contextractor-api` strips the Python process from Dockerfile / supervisord / start.sh / package.json
- The Next.js side of `apps/contextractor-api/` survives; a follow-up note in `purge-python-notes/contextractor-api-followup.md` captures the open decision about the API's purpose without the Python extractor
