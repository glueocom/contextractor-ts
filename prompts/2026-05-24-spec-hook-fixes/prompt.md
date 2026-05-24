# Fix Stop Hook Input Parsing

## Problem

Both `spec-gate.sh` and `test-gate.sh` extract edited file paths by querying `.tool_results[]?` from their stdin JSON. Stop hooks receive only `{session_id, transcript_path, stop_hook_active}` — `tool_results` is not part of the stop hook input format. The jq query fails silently (due to `2>/dev/null || true`), leaving `edited` always empty. Both hooks never block.

The loop guard (`if echo "$input" | jq -e '.stop_hook_active == true'`) is correct — `stop_hook_active` is a real stop hook field. Only the `edited` extraction is broken.

## Fix

Replace the broken `edited` extraction with transcript file reading. The stop hook input provides `transcript_path`, which points to a JSONL file containing the full session history. Read Write/Edit tool calls from the current turn only (assistant messages after the last user message).

### Replacement block for both hooks

Replace this (in both hooks):

```bash
edited=$(echo "$input" | jq -r '
  .tool_results[]? |
  select(.tool_name == "Write" or .tool_name == "Edit") |
  .tool_input.file_path // empty
' 2>/dev/null || true)
```

With:

```bash
transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')
edited=""
if [[ -n "$transcript_path" && -f "$transcript_path" ]]; then
  last_user_line=$(jq -r 'if .role == "user" then input_line_number else empty end' \
    "$transcript_path" 2>/dev/null | tail -1 || true)
  if [[ -n "$last_user_line" ]]; then
    edited=$(awk "NR > ${last_user_line}" "$transcript_path" | jq -r '
      select(.role == "assistant") |
      .content[]? |
      select(.type == "tool_use") |
      select(.name == "Write" or .name == "Edit") |
      .input.file_path // empty
    ' 2>/dev/null || true)
  fi
fi
```

How it works: `input_line_number` in jq returns the current JSONL line number. `tail -1` gets the last user message's line. `awk "NR > N"` skips to the current turn. jq then filters assistant tool_use blocks for Write/Edit calls.

## Steps

### Step READ: Read hook files

- Read `.claude/hooks/spec-gate.sh`
- Read `.claude/hooks/test-gate.sh`

### Step FIX-SPEC: Patch spec-gate.sh

- Replace only the `edited=$(echo "$input" | jq -r '.tool_results[]?...')` block with the transcript-reading block above
- Leave all other logic unchanged: loop guard, case statement, `required_specs` logic, missing README check, block message format

### Step FIX-TEST: Patch test-gate.sh

- Apply the identical transcript-reading replacement
- Leave ts_source/ts_tests filtering, package name resolution, and `pnpm test` execution unchanged

### Step VALIDATE: Smoke-test the fix

- Verify `spec-gate.sh` returns exit 0 when `stop_hook_active` is true in the input JSON
- Verify `spec-gate.sh` returns exit 0 when the transcript has no Write/Edit calls (no source files changed)
- Verify `test-gate.sh` exits 0 when `stop_hook_active` is true
- Test the `last_user_line` jq expression manually: `echo -e '{"role":"user"}\n{"role":"assistant"}' | jq -r 'if .role == "user" then input_line_number else empty end'` should output `1`
