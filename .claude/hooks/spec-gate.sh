#!/usr/bin/env bash
# Stop hook — blocks turn completion when source files were edited but the correct SPEC.md was not updated.
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

spec_files=$(printf '%s\n' "$edited" | grep 'SPEC\.md$' || true)

# Map each edited source file to the SPEC.md it requires.
required=""
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    */packages/extraction/src/*|*/packages/extraction/native/src/*)
      required+=$'\n'"packages/extraction/SPEC.md" ;;
    */packages/crawler/src/*)
      required+=$'\n'"packages/crawler/SPEC.md" ;;
    */packages/schema/src/*)
      required+=$'\n'"packages/schema/SPEC.md" ;;
    */apps/apify-actor/src/*)
      required+=$'\n'"apps/apify-actor/SPEC.md" ;;
    */apps/standalone/src/*)
      required+=$'\n'"apps/standalone/SPEC.md" ;;
  esac
done < <(printf '%s\n' "$edited" | grep -E '\.(ts|rs)$' | grep -v 'SPEC\.md' || true)

# Deduplicate.
required=$(printf '%s\n' "$required" | sort -u | grep -v '^$' || true)
[[ -z "$required" ]] && exit 0

# Check each required spec was actually touched.
missing=""
while IFS= read -r spec; do
  if ! printf '%s\n' "$spec_files" | grep -qF "$spec"; then
    missing+=" $spec"
  fi
done <<< "$required"

if [[ -n "$missing" ]]; then
  list="${missing# }"   # strip leading space
  list="${list// /, }" # space-separate → comma-separate
  printf '{"decision":"block","reason":"Source files were modified but the following SPEC.md files were not updated: %s. Check .claude/rules/spec-maintenance.md and update them before finishing."}' \
    "$list"
  exit 0
fi

exit 0
