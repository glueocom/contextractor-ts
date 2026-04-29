# syntax=docker/dockerfile:1.7

FROM apify/actor-node-playwright-chrome:24 AS builder

USER root
ENV NODE_ENV=development
WORKDIR /repo

# Copy workspace package.json files for layer-cache efficiency.
# Only copy linux prebuilds — darwin/windows dirs are not needed and trigger
# EBADPLATFORM in npm when platform-specific file: optional deps are resolved.
COPY package.json ./
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

# Strip non-linux entries from native/package.json so npm install doesn't
# attempt to resolve darwin/windows file: optional deps (which fail EBADPLATFORM).
RUN node -e " \
  const f = 'packages/contextractor-engine/native/package.json'; \
  const p = JSON.parse(require('fs').readFileSync(f, 'utf8')); \
  p.optionalDependencies = Object.fromEntries( \
    Object.entries(p.optionalDependencies || {}).filter(([k]) => k.includes('linux')) \
  ); \
  require('fs').writeFileSync(f, JSON.stringify(p, null, 2)); \
"

RUN npm install

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
    && npm prune --omit=dev \
    && npm run deploy --prod -w @contextractor/apify -- /deploy

FROM apify/actor-node-playwright-chrome:24

WORKDIR /usr/src/app

COPY --from=builder /deploy ./

CMD ["node", "dist/main.js"]
