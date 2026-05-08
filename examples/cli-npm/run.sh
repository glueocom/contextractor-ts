#!/usr/bin/env bash
# Full npm CLI surface demonstration for contextractor.
#
# Prerequisites:
#   npm install -g @contextractor/standalone
#   # or run from the repo root: pnpm build && node apps/standalone/dist/cli.js
#
# All commands write to ~/.contextractor-storage by default.
# Override the storage root with CONTEXTRACTOR_STORAGE_DIR or --storage-dir.

set -euo pipefail

EXAMPLE_URL="https://blog.apify.com/what-is-web-scraping/"
EXAMPLE_URL2="https://apify.com/about"

# ── Single URL extract ──────────────────────────────────────────────────────
# Writes the result to the default dataset and prints a JSON record to stdout.
contextractor extract "$EXAMPLE_URL" --save txt

# ── Single URL force NDJSON ─────────────────────────────────────────────────
# Forces NDJSON output on stdout even for a single URL (default is pretty JSON).
contextractor extract "$EXAMPLE_URL" --ndjson

# ── Multi-URL extract (NDJSON) ──────────────────────────────────────────────
# Two or more URLs always emit one JSON record per line on stdout.
contextractor extract "$EXAMPLE_URL" "$EXAMPLE_URL2" --save markdown

# ── Named dataset ───────────────────────────────────────────────────────────
# Routes results to datasets/my-archive/ instead of the default dataset.
contextractor extract "$EXAMPLE_URL" --dataset my-archive

# ── Storage-only (no stdout) ────────────────────────────────────────────────
# Writes to storage and produces no output on stdout.
contextractor extract "$EXAMPLE_URL" --no-stdout

# ── Input file ──────────────────────────────────────────────────────────────
# Reads one URL per line from a file.
printf '%s\n%s\n' "$EXAMPLE_URL" "$EXAMPLE_URL2" > /tmp/urls.txt
contextractor extract --input-file /tmp/urls.txt --save markdown

# ── List default dataset ─────────────────────────────────────────────────────
contextractor list --format json --limit 10

# ── List named dataset ──────────────────────────────────────────────────────
# Named dataset, NDJSON output, descending order.
contextractor list my-archive --format jsonl --desc

# ── Get a specific item ──────────────────────────────────────────────────────
# Index is 0-based.
contextractor get default 0

# ── KVS file write ───────────────────────────────────────────────────────────
echo '{"hello":"world"}' > /tmp/example.json
contextractor kvs put my-key /tmp/example.json

# ── KVS stdin write with explicit MIME ──────────────────────────────────────
echo '{"ok":true}' | contextractor kvs put my-key - --content-type application/json

# ── KVS get ──────────────────────────────────────────────────────────────────
contextractor kvs get my-key

# ── KVS list ─────────────────────────────────────────────────────────────────
contextractor kvs ls --limit 20

# ── KVS delete ───────────────────────────────────────────────────────────────
contextractor kvs rm my-key

# ── Print resolved storage path ──────────────────────────────────────────────
contextractor storage-dir

# ── Purge default storage ────────────────────────────────────────────────────
# Removes the default dataset and key-value store only.
contextractor purge

# ── Purge all storages ───────────────────────────────────────────────────────
# Removes all datasets and key-value stores including named ones.
contextractor purge --all

# ── Serve API (loopback only) ─────────────────────────────────────────────────
# The npm distribution only binds to 127.0.0.1. Run in background for demo.
contextractor serve --port 8080 &
SERVER_PID=$!
sleep 2

# Health check (unauthenticated).
curl -sf http://127.0.0.1:8080/healthz

# List default dataset items.
curl -sf "http://127.0.0.1:8080/v2/datasets/default/items?limit=10"

# Trigger extraction via the REST endpoint.
# NOTE: POST /v2/extract returns 501 (not yet implemented) — the CLI extract
# subcommand is the supported path for extraction in the npm distribution.
curl -sf -X POST http://127.0.0.1:8080/v2/extract \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"$EXAMPLE_URL\"}" || true

kill "$SERVER_PID" 2>/dev/null || true

# ── Show npm host rejection ───────────────────────────────────────────────────
# The npm distribution refuses to bind to non-loopback addresses.
# Use the Docker image to expose the API on the network.
contextractor serve --host 0.0.0.0 || true

# ── Custom storage dir ───────────────────────────────────────────────────────
CONTEXTRACTOR_STORAGE_DIR=./my-storage contextractor extract "$EXAMPLE_URL" --no-stdout
