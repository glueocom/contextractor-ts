# syntax=docker/dockerfile:1.7
# Multi-arch build:
#   docker buildx build --platform linux/amd64,linux/arm64 -t contextractor .

# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build
# node:22-slim is used for the build stage because the Playwright runtime image
# is the full Playwright base which already includes Node but requires a slim
# build layer for workspace resolution.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

ENV NODE_ENV=development
WORKDIR /repo

# Enable corepack before copying manifests so pnpm is available.
RUN corepack enable

# Copy workspace configuration first for layer-cache efficiency.
# Only linux prebuilds are needed — darwin/windows dirs are not.
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages/schema/package.json packages/schema/
COPY packages/extraction/native/npm/linux-x64-gnu/ packages/extraction/native/npm/linux-x64-gnu/
COPY packages/extraction/native/npm/linux-arm64-gnu/ packages/extraction/native/npm/linux-arm64-gnu/
COPY packages/extraction/native/package.json packages/extraction/native/
COPY packages/extraction/package.json packages/extraction/
COPY packages/crawler/package.json packages/crawler/
COPY apps/standalone/package.json apps/standalone/
COPY tools/gen-input-schema/package.json tools/gen-input-schema/
COPY tools/gen-md-regions/package.json tools/gen-md-regions/
COPY tools/opencode-sync/package.json tools/opencode-sync/
COPY tools/platform-test-runner/package.json tools/platform-test-runner/

RUN pnpm install

# Copy sources needed for the build.
COPY tsconfig.json ./
COPY packages/schema/ packages/schema/
COPY packages/extraction/ packages/extraction/
COPY packages/crawler/ packages/crawler/
COPY apps/standalone/ apps/standalone/
COPY tools/gen-input-schema/ tools/gen-input-schema/
COPY tools/gen-md-regions/ tools/gen-md-regions/

# Build packages in dependency order, then deploy a self-contained bundle.
RUN pnpm --filter @contextractor/schema build \
    && pnpm --filter @contextractor/extraction build \
    && pnpm --filter @contextractor/crawler build \
    && pnpm --filter @contextractor/standalone build \
    && pnpm --filter @contextractor/standalone --prod deploy /deploy

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 — Runtime
# mcr.microsoft.com/playwright:v1.59.1-noble includes Node 22 and all browser
# dependencies needed by Playwright/Chromium. The version must match the
# `playwright` dependency in packages/crawler/package.json.
# ──────────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.59.1-noble

LABEL org.opencontainers.image.title="contextractor"
LABEL org.opencontainers.image.description="Web content extraction CLI powered by rs-trafilatura and Crawlee"
LABEL org.opencontainers.image.source="https://github.com/glueo/contextractor"

# Non-root user with UID/GID 1000 (conventional single-user Linux desktop default).
RUN groupadd -g 1000 ctx && useradd -m -u 1000 -g ctx ctx

WORKDIR /app

# Copy the self-contained pnpm deployment bundle.
COPY --chown=ctx:ctx --from=builder /deploy ./

# Storage directory — document as the mount point.
# NOTE: Do NOT declare VOLUME /storage here; that causes Docker to create
# anonymous volumes on every run, silently leaking disk space (see research/01 §8).
RUN mkdir -p /storage && chown ctx:ctx /storage

# CONTEXTRACTOR_STORAGE_DIR tells resolveStorageDir() where to read/write data.
# CONTEXTRACTOR_DOCKER=1 enables non-loopback serve mode with token enforcement.
ENV CONTEXTRACTOR_STORAGE_DIR=/storage \
    CONTEXTRACTOR_DOCKER=1 \
    PORT=8080 \
    NODE_ENV=production

EXPOSE 8080

USER ctx

ENTRYPOINT ["node", "/app/dist/cli.js"]
CMD ["--help"]
