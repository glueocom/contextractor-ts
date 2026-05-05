#!/usr/bin/env bash
# Stop hook — blocks turn completion when source files were edited but no SPEC.md was updated.
# Fires once per turn; stop_hook_active=true on the re-entry prevents an infinite loop.
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

src_files=$(printf '%s\n' "$edited" | grep -E '\.(ts|rs)$' | grep -v 'SPEC\.md' || true)
spec_files=$(printf '%s\n' "$edited" | grep 'SPEC\.md$' || true)

# Block only when source files were touched but no SPEC.md was updated.
if [[ -n "$src_files" && -z "$spec_files" ]]; then
  changed_list=$(printf '%s\n' "$src_files" | head -5 | paste -sd ', ')
  printf '{"decision":"block","reason":"Source files were modified (%s) but no SPEC.md was updated. Check .claude/rules/spec-maintenance.md — update the relevant SPEC.md or verify it is still accurate before finishing."}' \
    "$changed_list"
  exit 0
fi

exit 0
