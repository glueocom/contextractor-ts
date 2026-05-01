# Stub Autonomous Maintenance for Dry-Run Testing

Add `STUB_MODE=1` env var support to `dev-utils/autonomous-maintenance/lib/claude.sh` and `lib/opencode.sh`. When set, `claude_run` and `opencode_run` print `[STUB] would run: <cmd>` and return immediately — no LLM processes launched. All other orchestration logic (sequencing, directory cleanup, echo output) runs unchanged.

## Step READ: Confirm current state

Read before editing:

- `dev-utils/autonomous-maintenance/lib/claude.sh`
- `dev-utils/autonomous-maintenance/lib/opencode.sh`

## Step PATCH: Add STUB_MODE guard

Inside `claude_run()` in `lib/claude.sh`, immediately before `claude -p "$cmd"`, insert:

```bash
  if [[ "${STUB_MODE:-}" == "1" ]]; then
    echo "[STUB] would run: $cmd"
    return 0
  fi
```

Apply the identical guard inside `opencode_run()` in `lib/opencode.sh`, immediately before `opencode run "$cmd"`.

Use Edit tool. Do NOT modify any other `.sh` files. Do NOT stub `pnpm opencode:sync` — it is a fast file-copy, not a slash command.

## Step REVIEW: Verify correctness

After patching, check each item — autofix any that fail:

- Guard is inside the function body, not before the double-source guard (`[[ -n "${_AM_CLAUDE_LIB:-}" ]] && return 0`)
- Uses `${STUB_MODE:-}` (safe under `set -u`) not bare `$STUB_MODE`
- Uses `return 0` (exits function), not `exit 0` (would kill the shell)
- Indentation matches surrounding code (2-space)
- Only `lib/claude.sh` and `lib/opencode.sh` changed — no other `.sh` files touched

## Step TEST: Run stub pipeline and assert

From repo root:

```bash
STUB_MODE=1 bash dev-utils/autonomous-maintenance/run-all.sh 2>&1 | tee /tmp/stub-run-output.txt
echo "Exit: $?"
```

Assert all of the following — fix and re-run if any fail:

- Exit code is `0`
- `[STUB] would run:` lines appear for every slash command (`claude.sh` has 11 + 1 commit, `opencode.sh` has 11 + 1 commit, each meta script has 1 + 1 commit)
- No `[claude] Running` or `[opencode] Running` lines (real invocation slipped through)
- No unexpected `error` or `FAILED` output outside `[STUB]` lines

Also run an isolated unit test of the gate:

```bash
STUB_MODE=1 bash -c '
  source dev-utils/autonomous-maintenance/lib/claude.sh
  output=$(claude_run "/test-cmd" 2>&1)
  [[ "$output" == "[STUB] would run: /test-cmd" ]] && echo "PASS" || echo "FAIL: got: $output"
'
```

## Step REPORT

Report:
- Pass/fail for each assertion
- Full list of `[STUB] would run:` lines seen
- Any unexpected output
