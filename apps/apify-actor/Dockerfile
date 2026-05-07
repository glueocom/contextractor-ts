# syntax=docker/dockerfile:1.7

FROM apify/actor-node-playwright-chrome:24 AS builder

USER root
ENV NODE_ENV=development
WORKDIR /repo

# Copy workspace + package manifests for layer-cache efficiency.
# Only copy linux prebuilds — darwin/windows dirs are not needed.
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages/schema/package.json packages/schema/
COPY packages/extraction/native/npm/linux-x64-gnu/ packages/extraction/native/npm/linux-x64-gnu/
COPY packages/extraction/native/npm/linux-arm64-gnu/ packages/extraction/native/npm/linux-arm64-gnu/
COPY packages/extraction/native/package.json packages/extraction/native/
COPY packages/extraction/package.json packages/extraction/
COPY packages/crawler/package.json packages/crawler/
COPY apps/standalone/package.json apps/standalone/
COPY apps/apify-actor/package.json apps/apify-actor/
COPY tools/gen-input-schema/package.json tools/gen-input-schema/
COPY tools/gen-md-regions/package.json tools/gen-md-regions/
COPY tools/opencode-sync/package.json tools/opencode-sync/
COPY tools/platform-test-runner/package.json tools/platform-test-runner/

RUN corepack enable && pnpm install

# Copy sources needed for the build.
COPY tsconfig.json ./
COPY packages/schema/ packages/schema/
COPY packages/extraction/ packages/extraction/
COPY packages/crawler/ packages/crawler/
COPY apps/standalone/ apps/standalone/
COPY apps/apify-actor/ apps/apify-actor/
COPY tools/gen-input-schema/ tools/gen-input-schema/
COPY tools/gen-md-regions/ tools/gen-md-regions/

# Build packages in dependency order, then deploy a self-contained bundle.
RUN pnpm --filter @contextractor/schema build \
    && pnpm --filter @contextractor/extraction build \
    && pnpm --filter @contextractor/crawler build \
    && pnpm --filter @contextractor/standalone build \
    && pnpm --filter @contextractor/apify build \
    && pnpm --filter @contextractor/apify --prod deploy /deploy

FROM apify/actor-node-playwright-chrome:24

WORKDIR /usr/src/app

COPY --from=builder /deploy ./

CMD ["node", "dist/main.js"]
