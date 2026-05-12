#!/usr/bin/env bash
# Demonstrates the full npm CLI surface for @contextractor/standalone.
# Requires: npm install -g @contextractor/standalone (or npx contextractor)
# Set CONTEXTRACTOR_STORAGE_DIR to control where data is persisted.
set -euo pipefail

URL1="https://example.com"
URL2="https://www.iana.org/domains/reserved"

# Single URL extract — saves to default key-value store
contextractor extract "$URL1" --save txt

# Multi-URL extract — saves both records to default KVS
contextractor extract "$URL1" "$URL2" --save markdown

# Named dataset — routes to datasets/my-archive/
contextractor extract "$URL1" --dataset my-archive

# Input file — reads URLs line by line
echo "$URL1" > /tmp/urls.txt
echo "$URL2" >> /tmp/urls.txt
contextractor extract --input-file /tmp/urls.txt

# List default dataset (JSON, up to 10 items)
contextractor list --format json --limit 10

# List named dataset (NDJSON, descending order)
contextractor list my-archive --format jsonl --desc

# Get a specific item (0-based index)
contextractor get default 0

# KVS: write a JSON file
echo '{"hello":"world"}' > /tmp/file.json
contextractor kvs put my-key /tmp/file.json

# KVS: write from stdin with explicit content type
echo '{"ok":true}' | contextractor kvs put my-key - --content-type application/json

# KVS: read a value
contextractor kvs get my-key

# KVS: list keys (up to 20)
contextractor kvs ls --limit 20

# KVS: delete a key
contextractor kvs rm my-key

# Print the resolved storage directory
contextractor storage-dir

# Purge default dataset and key-value store
contextractor purge

# Purge all datasets and key-value stores
contextractor purge --all

# Save to dataset only (skip KVS)
contextractor extract "$URL1" --save txt --save-destination dataset

# Save to both KVS and dataset
contextractor extract "$URL1" --save-destination key-value-store --save-destination dataset

# Crawler type selection
contextractor extract "$URL1" --crawler-type adaptive
contextractor extract "$URL1" --crawler-type firefox
contextractor extract "$URL1" --crawler-type cheerio

# Rendering detection percentage (adaptive only)
contextractor extract "$URL1" --crawler-type adaptive --rendering-detection-pct 20

# Custom storage directory via env var
CONTEXTRACTOR_STORAGE_DIR=./my-storage contextractor extract "$URL1"

# Write skipped-urls.json for auditing
contextractor extract "$URL1" --link-selector a --store-skipped-urls

# Block images, stylesheets, fonts, PDFs, and ZIPs (speeds up crawling)
contextractor extract "$URL1" --block-media

# Wait for a CSS selector before extracting (fails on timeout)
contextractor extract "$URL1" --wait-for-selector "article.content"

# Wait for a CSS selector before extracting (continues on timeout)
contextractor extract "$URL1" --soft-wait-for-selector ".dynamic-section"

# Wait for network idle up to 5 seconds after navigation (also sets selector wait timeout)
contextractor extract "$URL1" --dynamic-content-wait 5

# Discover and enqueue URLs from sitemap.xml at the start URL domain root
contextractor extract "$URL1" --use-sitemaps --max-pages 50

# Start with a fixed concurrency and let Crawlee scale up from there
contextractor extract "$URL1" --initial-concurrency 5 --max-concurrency 20

# Disable canonical URL deduplication — extract every loaded URL
contextractor extract "$URL1" --ignore-canonical-url
