#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"
TSX="$REPO_ROOT/node_modules/.bin/tsx"
"$TSX" "$DIR/lib/pkg.ts" ensureuninstalled
