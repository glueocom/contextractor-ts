#!/usr/bin/env bash
# Docker usage demonstration for contextractor.
#
# Prerequisites:
#   Docker Engine >= 24.0.6 (containerd snapshotter, see research/02 §2)
#
# Replace IMAGE with your actual image tag, e.g.:
#   IMAGE=contextractor:latest
# or pull from a registry (replace TAG with the actual release tag):
#   IMAGE=ghcr.io/glueo/contextractor-test:latest

set -euo pipefail

IMAGE="${IMAGE:-contextractor:latest}"
EXAMPLE_URL="https://blog.apify.com/what-is-web-scraping/"

# ── Volume path variants ──────────────────────────────────────────────────────
# Use the variant matching your OS and shell when mounting storage:
#
#   macOS / Linux bash:
#     -v "$(pwd)/storage:/storage"
#
#   Linux sh / CI:
#     -v "${PWD}/storage:/storage"
#
#   Windows cmd:
#     -v "%cd%/storage:/storage"
#
#   Windows PowerShell:
#     -v "${PWD}/storage:/storage"

mkdir -p storage

# ── Stdout mode (no volume required) ─────────────────────────────────────────
# Prints extracted content as a JSON record on stdout. Ephemeral — no data
# persists after the container exits.
docker run --rm "$IMAGE" extract "$EXAMPLE_URL"

# ── Volume-backed extract ─────────────────────────────────────────────────────
# Results persist in ./storage/datasets/default/ after the container exits.
docker run --rm -v "$(pwd)/storage:/storage" "$IMAGE" extract "$EXAMPLE_URL"

# ── Storage-only (batch, silent stdout) ──────────────────────────────────────
# Writes to /storage, no output on stdout. Useful in batch pipelines where
# only the persisted files matter.
docker run --rm -v "$(pwd)/storage:/storage" "$IMAGE" extract "$EXAMPLE_URL" --no-stdout

# ── Large outputs (avoid log-driver double-write) ────────────────────────────
# When stdout contains large JSON blobs the Docker log driver copies every byte
# twice (once to the container journal, once to your terminal). Pass
# --log-driver=none to skip the journal when you only care about stdout.
# See research/02 §7.
docker run --rm --log-driver=none "$IMAGE" extract "$EXAMPLE_URL"

# ── Linux UID safety ──────────────────────────────────────────────────────────
# Without --user the container runs as UID 1000 (ctx). Files written to the
# bind-mount will be owned by UID 1000. Pass --user to match the host user and
# avoid root-owned files on the host filesystem.
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$(pwd)/storage:/storage" \
  "$IMAGE" extract "$EXAMPLE_URL"

# ── Serve with token (non-loopback requires CONTEXTRACTOR_API_TOKEN) ──────────
# The Docker image allows binding to 0.0.0.0 when CONTEXTRACTOR_API_TOKEN is set.
# All /v2/* requests must carry "Authorization: Bearer <token>".
API_TOKEN="my-secret-token"

docker run -d \
  --name ctx-serve \
  -p 8080:8080 \
  -v "$(pwd)/storage:/storage" \
  -e CONTEXTRACTOR_API_TOKEN="$API_TOKEN" \
  "$IMAGE" serve --host 0.0.0.0

# Wait for the container to be ready.
sleep 3

# Health check — always unauthenticated, verifies container is up.
curl -sf http://localhost:8080/healthz

# List default dataset items (authenticated).
curl -sf \
  -H "Authorization: Bearer $API_TOKEN" \
  "http://localhost:8080/v2/datasets/default/items?limit=10"

# Trigger extraction (returns 501 — extraction runs via CLI, not the REST API).
curl -sf \
  -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -X POST http://localhost:8080/v2/extract \
  -d "{\"url\":\"$EXAMPLE_URL\"}" || true

docker stop ctx-serve && docker rm ctx-serve

# ── Token enforcement ─────────────────────────────────────────────────────────
# Starting serve with --host 0.0.0.0 and no CONTEXTRACTOR_API_TOKEN causes the
# process to print a clear error and refuse to start (exit code 1).
# The --insecure flag is the only escape hatch and is development-only.
docker run --rm -p 8080:8080 "$IMAGE" serve --host 0.0.0.0 || true
