# Remove Docker Distribution

> **TLDR**: Contextractor ships as an Apify Actor and an npm package (CLI + library). The Docker distribution is discontinued. Remove every Docker artifact — Dockerfile, docker-compose, Docker examples, Docker-mode serve logic, and all Docker references in specs and docs.

## Context

Contextractor has two shipping targets:

- **Apify Actor** (`apps/apify-actor/`) — cloud execution, unchanged.
- **npm package** (`apps/standalone/`) — CLI binary + Node.js library, unchanged.

The Docker image and `docker-compose.yml` are removed. The `serve` subcommand is removed entirely — it will not be part of the npm package.

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
rm -rf apps/standalone/src/serve/
```

Verify each removal with `git rm` so the deletion is tracked.

## Step SIMPLIFY: Remove Serve from CLI

### `apps/standalone/src/cliProgram.ts`

Remove the `serve` subcommand and all associated imports (`isRunningInDocker`, any serve-related helpers). The `serve` feature is not part of the npm package.

## Step STRIP: Remove Docker from Specs and Docs

### `apps/standalone/README.md`

Remove all Docker sections: Dockerfile usage, `docker run`, `docker-compose`, `--log-driver=none`, UID safety notes, `CONTEXTRACTOR_DOCKER=1`, `CONTEXTRACTOR_API_TOKEN` mandatory requirement. Keep the npm CLI section. Keep the optional-token auth note.

### `apps/standalone/SPEC.md`

Remove the Docker distribution section. Remove serve-specific content from the Security section. Remove `CONTEXTRACTOR_DOCKER=1` from the env var table.

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
- [ ] `apps/standalone/src/serve/` does not exist.
- [ ] `examples/cli-docker/`, `examples/docker-compose/`, `examples/docker-api-ts/` do not exist.
- [ ] `grep -r 'isRunningInDocker\|CONTEXTRACTOR_DOCKER\|--insecure\|buildServeApp' apps/standalone/src/` — no matches.
- [ ] `grep -r 'Dockerfile\|docker-compose\|docker run\|docker buildx' apps/standalone/README.md apps/standalone/SPEC.md SPEC.md` — no matches.
- [ ] `pnpm build && pnpm lint && pnpm test` — all pass.

## Commit

Single commit: `feat: remove Docker distribution and serve subcommand`
