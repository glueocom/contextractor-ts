# Apify monorepo deploy pattern (Git-connected build)

Replaces the v1 `apps/contextractor-apify/vendor/{engine,engine-native}/` workaround. Reference: `github.com/apify/actor-monorepo-example`.

## actor.json

```jsonc
{
  "actorSpecification": 1,
  "name": "contextractor-test",       // production: "contextractor"
  "title": "Contextractor",
  "description": "Crawls websites and extracts main-content text. Built on rs-trafilatura and Crawlee.",
  "version": "0.1",
  "buildTag": "latest",
  "dockerContextDir": "../../..",     // resolved from .actor/ → repo root
  "dockerfile": "./Dockerfile",
  "input": "./input_schema.json",
  "output": "./output_schema.json",
  "storages": { "dataset": "./dataset_schema.json" }
}
```

`dockerContextDir` is resolved relative to the `actor.json` file itself. Three `..` segments take `apps/contextractor-apify/.actor/actor.json` to the repo root. The Dockerfile then sees `packages/`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, etc.

`apify push` does NOT honor `dockerContextDir` for contexts above the actor dir; the deploy must be a **Git-connected build** in the Apify Console (set Git URL + branch + folder = `apps/contextractor-apify`). `/platform:push-and-get-working --production` deploys via `apify push` and is therefore reserved for production after this migration adopts Git-connected builds.

## Dockerfile (multi-stage)

Pattern: builder stage runs `pnpm install` + `pnpm deploy --prod` to produce a self-contained `/deploy`; runtime stage copies `/deploy` and starts the actor.

```dockerfile
FROM apify/actor-node-playwright-chrome:22 AS builder
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/ ./packages/
COPY apps/contextractor-apify/ ./apps/contextractor-apify/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @contextractor/apify build
RUN pnpm --filter @contextractor/apify --prod deploy /deploy

FROM apify/actor-node-playwright-chrome:22
WORKDIR /usr/src/app
COPY --from=builder /deploy ./
CMD ["node", "dist/main.js"]
```

Notes:

- `pnpm deploy --prod` materializes a self-contained `node_modules` directory at `/deploy` (no symlinks, no workspace links). This is the canonical primitive — see <https://pnpm.io/cli/deploy>.
- The pnpm deploy includes the napi-rs platform package matching the image's arch (linux-x64-gnu or linux-arm64-gnu, depending on the base image).
- No Rust toolchain is installed in the image. The prebuilt `.node` is shipped through the workspace and copied by `pnpm deploy`.
- Apify base images: `apify/actor-node-playwright-chrome:22` is the standard Node 22 + Playwright + Chromium image as of 2026-04-26.

## What this replaces

v1 vendored the engine package and the napi-rs prebuild into `apps/contextractor-apify/vendor/` and used `apify push` (which uploads only the actor dir). v2:

- Deletes `apps/contextractor-apify/vendor/`.
- Restores `"@contextractor/engine": "workspace:*"` in `apps/contextractor-apify/package.json`.
- Switches the deploy mechanism from CLI `apify push` to Git-connected build in the Console.

## Apify CLI requirements

Apify CLI ≥ 1.4 is required. Older versions reject the modern `actor.json` with "Actor is of an unknown format". Document this in CLAUDE.md and the engine README.
