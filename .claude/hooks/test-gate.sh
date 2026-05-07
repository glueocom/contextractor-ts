#!/usr/bin/env bash
# Stop hook — blocks turn completion when TypeScript source files were edited but no test files were updated.
# Enforces: tests kept in sync with source changes.
# Rust is exempt: tests are inline in the source file, so editing .rs counts as updating tests.
set -euo pipefail

input=$(cat)

# Loop guard: when Claude re-enters after a block, stop_hook_active is true — let it finish.
if echo "$input" | jq -e '.stop_hook_active == true' > /dev/null 2>&1; then
  exit 0
fi

# Extract file paths from all Write and Edit calls made this turn.
edited=$(echo "$input" | jq -r '
  .tool_results[]? |
  select(.tool_name == "Write" or .tool_name == "Edit") |
  .tool_input.file_path // empty
' 2>/dev/null || true)

# TypeScript source files in packages/ or apps/ src directories (not test files, not declaration files).
ts_source=$(printf '%s\n' "$edited" | \
  grep -E '/src/.+\.ts$' | \
  grep -E '/(packages|apps)/' | \
  grep -v '\.test\.ts$' | \
  grep -v '\.d\.ts$' || true)

# Any .test.ts file edited this turn.
ts_tests=$(printf '%s\n' "$edited" | grep '\.test\.ts$' || true)

# If TypeScript source was changed without any test file being touched, block.
if [[ -n "$ts_source" && -z "$ts_tests" ]]; then
  files=$(printf '%s\n' "$ts_source" | sed 's|.*/packages/|packages/|; s|.*/apps/|apps/|' | head -3 | tr '\n' ' ' | sed 's/ $//')
  msg="Source changed without test updates ($files). Add or update the corresponding *.test.ts file in the same response. See .claude/rules/test-maintenance.md."
  printf '{"decision":"block","reason":"%s"}' "$msg"
  exit 0
fi

exit 0
