#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
exec tsx "$DIR/lib/pkg.ts" uninstall
