# Step TEST USER INTENT — Full Regression Check

**TLDR**: Confirm that the production path (without STUB_MODE) is unaffected — running without the env var must still invoke the real binaries normally.

## Step CONFIRM: Production path still present

Read `lib/claude.sh` and `lib/opencode.sh`. Confirm that:
- `claude -p "$cmd"` is still present in `claude_run` (just guarded by the STUB_MODE check)
- `opencode run "$cmd"` is still present in `opencode_run`
- Neither function has been deleted or commented out

## Step DRY_RUN_GATE: Confirm STUB_MODE exits early

```bash
# Confirm the env var guard works in isolation
STUB_MODE=1 bash -c '
  source dev-utils/autonomous-maintenance/lib/claude.sh
  output=$(claude_run "/test-cmd" 2>&1)
  echo "$output"
  [[ "$output" == "[STUB] would run: /test-cmd" ]] && echo "PASS" || echo "FAIL"
'
```

## Step FIX

If any check fails, apply minimal fix and re-run.
