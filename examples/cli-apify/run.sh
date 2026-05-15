#!/usr/bin/env bash
# Demonstrates calling glueo/contextractor-test via the Apify CLI.
# Requires: npm install -g apify-cli && apify login
set -euo pipefail

# Extract a page and save to dataset only
apify call glueo/contextractor-test --input-string '{
  "startUrls": [{"url": "https://example.com"}],
  "save": ["txt"],
  "saveDestination": ["dataset"]
}'
