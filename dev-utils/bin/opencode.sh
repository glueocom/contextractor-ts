#!/usr/bin/env bash
# Loads .env from the repo root before launching opencode,
# so {env:VAR} placeholders in opencode.json resolve correctly.
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
set -a
# shellcheck source=../../.env
source "$REPO_ROOT/.env"
set +a
exec opencode "$@"
