# Remove Docker Distribution

> **TLDR**: Contextractor ships as an Apify Actor and an npm package (CLI + library). The Docker distribution is discontinued. Remove every Docker artifact — Dockerfile, docker-compose, Docker examples, Docker-mode serve logic, and all Docker references in specs and docs.

## Context

Contextractor has two shipping targets:

- **Apify Actor** (`apps/apify-actor/`) — cloud execution, unchanged.
- **npm package** (`apps/standalone/`) — CLI binary + Node.js library, unchanged.

The Docker image and `docker-compose.yml` are removed. The `serve` subcommand stays but is simplified: it is always localhost-only, the npm/Docker security split is gone, and the `--insecure` flag is removed.

No backward compatibility is required. Delete files, remove flags, strip doc sections without hesitation.

## Before you write any code: ground in the codebase

Read these before touching anything:

- `apps/standalone/src/serve/app.ts` — Hono server; has npm/Docker auth split middleware
- `apps/standalone/src/serve/docker.ts` — `isRunningInDocker()`, `isLoopback()`, `LOOPBACK_HOSTS`
- `apps/standalone/src/serve/serve.test.ts` — has Docker-mode test cases
- `apps/standalone/src/serve/docker.test.ts` — tests for `isRunningInDocker`, `isLoopback`
- `apps/standalone/src/cliProgram.ts` — `serve` subcommand; has `--insecure` flag and Docker-mode logic
- `apps/standalone/README.md` — has Docker sections to strip
- `apps/standalone/SPEC.md` — has Docker distribution section
- Root `SPEC.md` — has Docker configuration section

## Step DELETE: Remove Docker Artifacts

### Files to delete entirely

```bash
rm apps/standalone/Dockerfile
rm apps/standalone/docker-compose.yml
rm -rf examples/cli-docker/
rm -rf examples/docker-compose/
rm -rf examples/docker-api-ts/
rm apps/standalone/src/serve/docker.ts
rm apps/standalone/src/serve/docker.test.ts
```

Verify each removal with `git rm` so the deletion is tracked.

## Step SIMPLIFY: Serve Command — Remove npm/Docker Split

The `serve` command becomes npm-only. Its security model is now: **loopback-only, always**. No Docker mode, no `--insecure`, no mandatory token.

### `apps/standalone/src/serve/app.ts`

- Remove the import of `isRunningInDocker` from `docker.ts`.
- Move `LOOPBACK_HOSTS` and `isLoopback()` inline (or into a small `net.ts` helper) — these are still needed for the loopback enforcement.
- **Auth middleware**: simplify to a single rule. If `CONTEXTRACTOR_API_TOKEN` env var is set, require `Authorization: Bearer <token>` on all `/v2/*` requests (defence in depth, optional). If not set, no auth required. Remove the Docker-mode mandatory-token-on-non-loopback branch entirely.
- **Host validation**: keep the rejection of non-loopback hosts (previously the npm-mode rule). Remove the Docker-mode bypass. The error message should now read: `"contextractor serve only binds to localhost. Pass a custom --host at your own risk — non-loopback hosts are not officially supported."`
  - **Decision**: keep `--host` as a power-user escape hatch but always log a warning to stderr when a non-loopback host is used, instead of hard-rejecting. This avoids breaking CI pipelines that bind to `0.0.0.0` for local integration testing.
- Remove `insecure` from `ServeOptions` and `buildServeApp`.
- `/healthz` remains unauthenticated.

### `apps/standalone/src/cliProgram.ts`

- Remove `--insecure` option from the `serve` subcommand.
- Remove `isRunningInDocker()` import and call.
- Remove the `if (opts.insecure && isRunningInDocker())` warning block.
- Remove `insecure` from the `buildServeApp` call.
- Keep `--host`, `--port`, `--token`, `--storage-dir`.

### `apps/standalone/src/serve/serve.test.ts`

- Remove all Docker-mode test cases:
  - "npm mode, non-loopback host: `serve` startup rejects with the loopback-only error message" — **keep** (still true).
  - "Docker mode, non-loopback host, no `CONTEXTRACTOR_API_TOKEN`" — **remove**.
  - "Docker mode, non-loopback host, valid token: `GET /v2/datasets` without `Authorization` → HTTP 401" — **remove**.
- Add or update the optional-token test: when `CONTEXTRACTOR_API_TOKEN` is set, `/v2/datasets` requires `Authorization: Bearer <token>`; when not set, no auth is needed.

## Step STRIP: Remove Docker from Specs and Docs

### `apps/standalone/README.md`

Remove all Docker sections: Dockerfile usage, `docker run`, `docker-compose`, `--log-driver=none`, UID safety notes, `CONTEXTRACTOR_DOCKER=1`, `CONTEXTRACTOR_API_TOKEN` mandatory requirement. Keep the npm CLI and serve sections. Keep the optional-token auth note.

### `apps/standalone/SPEC.md`

Remove the Docker distribution section. Update the Security section to reflect the simplified serve model (loopback default, optional token). Remove `CONTEXTRACTOR_DOCKER=1` from the env var table.

### Root `SPEC.md`

Remove the "Docker configuration" section. Remove any mention of multi-arch build, `mcr.microsoft.com/playwright`, non-root user, `VOLUME /storage`, or `docker-compose`. Keep the Apify Actor and npm CLI descriptions.

### Other SPEC.md files

Check `apps/apify-actor/SPEC.md` and `packages/crawler/SPEC.md` for Docker references and strip them.

## Step TEST: Verify

```bash
pnpm build
pnpm lint
pnpm test
```

Fix every failure before finishing.

## Acceptance Criteria

- [ ] `apps/standalone/Dockerfile` does not exist.
- [ ] `apps/standalone/docker-compose.yml` does not exist.
- [ ] `apps/standalone/src/serve/docker.ts` does not exist.
- [ ] `apps/standalone/src/serve/docker.test.ts` does not exist.
- [ ] `examples/cli-docker/`, `examples/docker-compose/`, `examples/docker-api-ts/` do not exist.
- [ ] `grep -r 'isRunningInDocker\|CONTEXTRACTOR_DOCKER\|--insecure' apps/standalone/src/` — no matches.
- [ ] `grep -r 'Dockerfile\|docker-compose\|docker run\|docker buildx' apps/standalone/README.md apps/standalone/SPEC.md SPEC.md` — no matches.
- [ ] `serve` still starts and binds to `127.0.0.1` by default.
- [ ] `GET /healthz` still works without auth.
- [ ] Optional token auth: when `CONTEXTRACTOR_API_TOKEN=secret contextractor serve` is running, `GET /v2/datasets` without `Authorization` → HTTP 401; with `Authorization: Bearer secret` → HTTP 200.
- [ ] `pnpm build && pnpm lint && pnpm test` — all pass.

## Commit

Single commit: `feat: remove Docker distribution; serve is npm-only localhost`
