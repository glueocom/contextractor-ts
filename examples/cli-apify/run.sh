#!/usr/bin/env bash
# Call glueo/contextractor-test via the Apify CLI.
#
# Prerequisites:
#   npm install -g apify-cli
#   apify login            # stores your token in ~/.apify/
#
# Usage:
#   bash run.sh
#   # or with a custom URL:
#   EXTRACT_URL=https://example.com bash run.sh

set -euo pipefail

ACTOR="glueo/contextractor-test"
EXTRACT_URL="${EXTRACT_URL:-https://blog.apify.com/what-is-web-scraping/}"

# Build the actor input JSON.
# saveDestination routes results to the Apify dataset in addition to the
# key-value store. Both destinations are Actor-only features.
INPUT=$(cat <<EOF
{
  "startUrls": [
    { "url": "${EXTRACT_URL}" }
  ],
  "save": ["markdown"],
  "saveDestination": ["dataset"],
  "maxPagesPerCrawl": 1,
  "maxConcurrency": 1
}
EOF
)

echo "Calling actor: ${ACTOR}"
echo "Input: ${INPUT}"

# Start the run and wait for it to finish.
# --json prints the run record as JSON on stdout.
# --wait-for-finish=300 blocks for up to 5 minutes.
apify call "${ACTOR}" \
  --input-string "${INPUT}" \
  --wait-for-finish=300
