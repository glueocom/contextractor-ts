#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "==> Building contextractor CLI..."
pnpm --dir "$REPO_ROOT" --filter @contextractor/standalone build

echo ""
echo "==> Running: contextractor --help"
node "$REPO_ROOT/apps/standalone/dist/cli.js" --help
