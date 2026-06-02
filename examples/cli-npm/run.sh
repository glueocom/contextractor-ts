#!/usr/bin/env bash
# Demonstrates the full npm CLI surface for contextractor.
# Requires: npm install -g contextractor (or npx contextractor)
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

# Named key-value store and request queue
contextractor extract "$URL1" --key-value-store my-blobs --request-queue my-queue

# Input file — reads URLs line by line
echo "$URL1" > /tmp/urls.txt
echo "$URL2" >> /tmp/urls.txt
contextractor extract --input-file /tmp/urls.txt

# Export stored content to a user-facing output directory (human-named files + manifest.json)
contextractor export --output-dir ./contextractor-output

# Export from a named dataset and key-value store
contextractor export --output-dir ./archive-output --dataset my-archive --key-value-store my-blobs

# Purge default dataset and key-value store
contextractor purge

# Purge all datasets and key-value stores
contextractor purge --all

# Save to dataset only (skip KVS)
contextractor extract "$URL1" --save txt --save-destination dataset

# Crawler type selection
contextractor extract "$URL1" --crawler-type adaptive
contextractor extract "$URL1" --crawler-type firefox
contextractor extract "$URL1" --crawler-type cheerio

# Rendering type detection ratio 0–1 (adaptive only)
contextractor extract "$URL1" --crawler-type adaptive --rendering-type-detection 0.2

# Custom storage directory via env var
CONTEXTRACTOR_STORAGE_DIR=./my-storage contextractor extract "$URL1"

# Write skipped-urls.json for auditing
contextractor extract "$URL1" --selector a --store-skipped-urls

# Block images, stylesheets, fonts, PDFs, and ZIPs (speeds up crawling)
contextractor extract "$URL1" --block-media

# Wait for a CSS selector before extracting (fails on timeout)
contextractor extract "$URL1" --wait-for-selector "article.content"

# Wait for a CSS selector before extracting (continues on timeout)
contextractor extract "$URL1" --soft-wait-for-selector ".dynamic-section"

# Wait for network idle up to 5 seconds after navigation (also sets selector wait timeout)
contextractor extract "$URL1" --wait-for-dynamic-content 5

# Discover and enqueue URLs from sitemap.xml at the start URL domain root
contextractor extract "$URL1" --use-sitemaps --max-requests-per-crawl 50

# Start with a fixed concurrency and let Crawlee scale up from there
contextractor extract "$URL1" --initial-concurrency 5 --max-concurrency 20

# Disable canonical URL deduplication — extract every loaded URL
contextractor extract "$URL1" --deduplication none
