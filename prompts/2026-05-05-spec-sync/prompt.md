# Set Up Automatic Spec Propagation

Audit and configure the Claude Code environment so that SPEC.md files are always updated in the same turn as any source file edit — without the user having to ask. Run this once to install or repair the setup.

## Goal

Every time Claude edits a `.ts` or `.rs` source file during any task, the relevant SPEC.md must be updated in the same response. A Stop hook enforces this: if Claude finishes a turn having touched source files but no spec files, the hook blocks completion and Claude must fix it before the session can end.

## Step AUDIT: Check current state

Verify each required component exists and is correct. Read each file if it exists.

- `.claude/hooks/spec-gate.sh` — executable Stop hook script
- `.claude/settings.json` → `hooks.Stop[]` entry pointing to spec-gate.sh
- `.claude/rules/spec-maintenance.md` — spec maintenance rule with explicit same-turn requirement
- `CLAUDE.md` → Rules section references spec-maintenance

## Step HOOK: Install spec-gate.sh

Create or overwrite `.claude/hooks/spec-gate.sh` with this exact content:

```bash
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

Run both cases and confirm output:

```bash
# Should output {"decision":"block",...}
echo '{"stop_hook_active":false,"tool_results":[{"tool_name":"Edit","tool_input":{"file_path":"/repo/packages/extraction/src/index.ts"}}]}' \
  | .claude/hooks/spec-gate.sh

# Should exit silently (loop guard)
echo '{"stop_hook_active":true,"tool_results":[]}' \
  | .claude/hooks/spec-gate.sh ; echo "exit $?"
```

Fix the hook if either test produces unexpected output.

## Completion

Report: which components were already correct, which were created or patched, and confirm both smoke tests passed.
