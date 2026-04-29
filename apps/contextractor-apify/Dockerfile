# syntax=docker/dockerfile:1.7

FROM apify/actor-node-playwright-chrome:24 AS builder

USER root
ENV NODE_ENV=development
WORKDIR /repo

# Copy workspace + package manifests for layer-cache efficiency.
# Only copy linux prebuilds — darwin/windows dirs are not needed.
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages/contextractor-schema/package.json packages/contextractor-schema/
COPY packages/contextractor-engine/native/npm/linux-x64-gnu/ packages/contextractor-engine/native/npm/linux-x64-gnu/
COPY packages/contextractor-engine/native/npm/linux-arm64-gnu/ packages/contextractor-engine/native/npm/linux-arm64-gnu/
COPY packages/contextractor-engine/native/package.json packages/contextractor-engine/native/
COPY packages/contextractor-engine/package.json packages/contextractor-engine/
COPY apps/contextractor-standalone/package.json apps/contextractor-standalone/
COPY apps/contextractor-apify/package.json apps/contextractor-apify/
COPY tools/gen-input-schema/package.json tools/gen-input-schema/
COPY tools/gen-md-regions/package.json tools/gen-md-regions/
COPY tools/generated-unit-tests/package.json tools/generated-unit-tests/
COPY tools/opencode-sync/package.json tools/opencode-sync/
COPY tools/platform-test-runner/package.json tools/platform-test-runner/

RUN corepack enable && pnpm install

# Copy sources needed for the build.
COPY tsconfig.json ./
COPY packages/contextractor-schema/ packages/contextractor-schema/
COPY packages/contextractor-engine/ packages/contextractor-engine/
COPY apps/contextractor-standalone/ apps/contextractor-standalone/
COPY apps/contextractor-apify/ apps/contextractor-apify/
COPY tools/gen-input-schema/ tools/gen-input-schema/
COPY tools/gen-md-regions/ tools/gen-md-regions/

# Build packages in dependency order, then deploy a self-contained bundle.
RUN pnpm --filter @contextractor/schema build \
    && pnpm --filter @contextractor/engine build \
    && pnpm --filter @contextractor/standalone build \
    && pnpm --filter @contextractor/apify build \
    && pnpm --filter @contextractor/apify --prod deploy /deploy

FROM apify/actor-node-playwright-chrome:24

WORKDIR /usr/src/app

COPY --from=builder /deploy ./

CMD ["node", "dist/main.js"]
