# syntax=docker/dockerfile:1.7

FROM apify/actor-node-playwright-chrome:22 AS builder

WORKDIR /repo

# Copy workspace + package manifests first so dependency install caches well.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY packages/contextractor-engine/package.json ./packages/contextractor-engine/
COPY packages/contextractor-engine/native/package.json ./packages/contextractor-engine/native/
COPY packages/contextractor-engine/native/npm/ ./packages/contextractor-engine/native/npm/
COPY apps/contextractor-apify/package.json ./apps/contextractor-apify/

RUN corepack enable \
    && corepack prepare pnpm@10 --activate \
    && pnpm install --frozen-lockfile

# Now copy the rest of the sources.
COPY tsconfig.json ./
COPY packages/contextractor-engine/ ./packages/contextractor-engine/
COPY apps/contextractor-apify/ ./apps/contextractor-apify/

RUN pnpm --filter @contextractor/engine build \
    && pnpm --filter @contextractor/apify build \
    && pnpm --filter @contextractor/apify --prod deploy /deploy

FROM apify/actor-node-playwright-chrome:22

WORKDIR /usr/src/app

COPY --from=builder /deploy ./

CMD ["node", "dist/main.js"]
