# syntax=docker/dockerfile:1.7

FROM apify/actor-node-playwright-chrome:22 AS builder

USER root
ENV NODE_ENV=development
WORKDIR /repo

# Copy all workspace package.json files first so npm ci layer caches well.
COPY package.json package-lock.json ./
COPY packages/contextractor-schema/package.json packages/contextractor-schema/
COPY packages/contextractor-engine/native/npm/ packages/contextractor-engine/native/npm/
COPY packages/contextractor-engine/native/package.json packages/contextractor-engine/native/
COPY packages/contextractor-engine/package.json packages/contextractor-engine/
COPY apps/contextractor-standalone/package.json apps/contextractor-standalone/
COPY apps/contextractor-apify/package.json apps/contextractor-apify/
COPY tools/gen-input-schema/package.json tools/gen-input-schema/
COPY tools/gen-md-regions/package.json tools/gen-md-regions/
COPY tools/generated-unit-tests/package.json tools/generated-unit-tests/
COPY tools/opencode-sync/package.json tools/opencode-sync/
COPY tools/platform-test-runner/package.json tools/platform-test-runner/

RUN npm install --force

# Copy sources needed for the build.
COPY tsconfig.json ./
COPY packages/contextractor-schema/ packages/contextractor-schema/
COPY packages/contextractor-engine/ packages/contextractor-engine/
COPY apps/contextractor-standalone/ apps/contextractor-standalone/
COPY apps/contextractor-apify/ apps/contextractor-apify/
COPY tools/gen-input-schema/ tools/gen-input-schema/
COPY tools/gen-md-regions/ tools/gen-md-regions/

# Build packages in dependency order, then materialize a self-contained actor
# bundle with no workspace symlinks.
RUN npm run build -w @contextractor/schema \
    && npm run build -w @contextractor/engine \
    && npm run build -w @contextractor/standalone \
    && npm run build -w @contextractor/apify \
    && npm prune --omit=dev --force \
    && npm run deploy --prod -w @contextractor/apify -- /deploy

FROM apify/actor-node-playwright-chrome:22

WORKDIR /usr/src/app

COPY --from=builder /deploy ./

CMD ["node", "dist/main.js"]
