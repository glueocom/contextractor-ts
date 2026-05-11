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

# Custom storage directory via env var
CONTEXTRACTOR_STORAGE_DIR=./my-storage contextractor extract "$URL1"
