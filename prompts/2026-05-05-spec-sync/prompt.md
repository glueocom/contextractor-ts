# Set Up Automatic Spec Propagation

Audit and configure the Claude Code environment so that SPEC.md files are always updated in the same turn as any source file edit — without the user having to ask. Run this once to install or repair the setup.

## Goal

Every time Claude edits a `.ts` or `.rs` source file during any task, the relevant SPEC.md must be updated in the same response. A Stop hook enforces this: if Claude finishes a turn having edited source files without updating the correct spec, the hook blocks completion and Claude must fix it before the session can end.

## Design rationale

**Why hooks and not CLAUDE.md rules**: Rules are advisory. Anthropic's own docs state: "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens." Real-world compliance rate for process rules (not style rules) is ~60–70%, and degrades further in long sessions as context compacts. Issue #43557 (May 2026) documents Claude correctly reciting rules but still skipping them during execution. The hook is the enforcement layer; the rule (`spec-maintenance.md`) is the guidance layer that tells Claude *which* spec to update.

**Why Stop hook and not PostToolUse**: PostToolUse fires after each individual Write/Edit call, before Claude has finished making all edits in a turn. It can inject a hint but cannot block anything — Claude may make 10 more source edits after the first reminder. Stop fires once at turn end with the full list of all edits, and `{"decision":"block"}` causes Claude to continue its turn and fix the issue. PostToolUse `additionalContext` is also of ambiguous status (issue #18427 closed "not planned"; issue #24788 still open as of May 2026).

**Why per-package mapping and not "any SPEC.md"**: Editing `packages/extraction/src/index.ts` and only touching `apps/apify-actor/SPEC.md` would pass a naive "was any spec touched?" check. The hook must verify the *correct* spec for the package that was modified.

## Step AUDIT: Check current state

Verify each required component exists and is correct. Read each file if it exists.

- `.claude/hooks/spec-gate.sh` — executable Stop hook with per-package mapping logic
- `.claude/settings.json` → `hooks.Stop[]` entry pointing to spec-gate.sh
- `.claude/rules/spec-maintenance.md` — spec maintenance rule with explicit same-turn requirement
- `CLAUDE.md` → Rules section references spec-maintenance

## Step HOOK: Install spec-gate.sh

Create or overwrite `.claude/hooks/spec-gate.sh` with this exact content:

```bash
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
```

After writing the file, run `chmod +x .claude/hooks/spec-gate.sh`.

## Step SETTINGS: Register the Stop hook

In `.claude/settings.json`, ensure `hooks.Stop` exists with this entry. If `hooks.Stop` is absent, add it; if already present and correct, skip.

```json
"Stop": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/spec-gate.sh",
        "timeout": 10,
        "statusMessage": "Checking spec files..."
      }
    ]
  }
]
```

Use the Edit tool — do not rewrite the whole file.

## Step RULE: Strengthen spec-maintenance.md

Ensure `.claude/rules/spec-maintenance.md` contains an explicit same-turn requirement. The rule must say that spec updates happen in the same response as source changes — not deferred to a follow-up. Add this sentence to the "When to update specs" section if absent:

> Update the relevant SPEC.md in the **same response** as the source change — never defer to a follow-up.

## Step CLAUDE_MD: Verify Rules reference

Ensure `CLAUDE.md` lists the spec-maintenance rule in its Rules section:

```
- [Spec maintenance](.claude/rules/spec-maintenance.md) — keep SPEC.md files in sync with code
```

If absent, add it. If already present, skip.

## Step VERIFY: Smoke test the hook

Run all three cases and confirm output:

```bash
# Case 1 — extraction source edited, extraction spec NOT touched → should block
echo '{"stop_hook_active":false,"tool_results":[{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/extraction/src/index.ts"}}]}' \
  | .claude/hooks/spec-gate.sh

# Case 2 — extraction source edited AND extraction spec touched → should exit 0 silently
echo '{"stop_hook_active":false,"tool_results":[{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/extraction/src/index.ts"}},{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/extraction/SPEC.md"}}]}' \
  | .claude/hooks/spec-gate.sh ; echo "exit $?"

# Case 3 — loop guard: stop_hook_active=true → should exit 0 silently
echo '{"stop_hook_active":true,"tool_results":[]}' \
  | .claude/hooks/spec-gate.sh ; echo "exit $?"

# Case 4 — extraction source edited but only apify-actor spec touched → should block (wrong spec)
echo '{"stop_hook_active":false,"tool_results":[{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/extraction/src/index.ts"}},{"tool_name":"Edit","tool_input":{"file_path":"/repo/apps/apify-actor/SPEC.md"}}]}' \
  | .claude/hooks/spec-gate.sh
```

Fix the hook if any test produces unexpected output.

## Completion

Report: which components were already correct, which were created or patched, and confirm all four smoke tests passed.
