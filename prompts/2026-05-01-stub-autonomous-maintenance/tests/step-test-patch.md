# Step TEST PATCH — Run Stub Pipeline

**TLDR**: Run the full orchestration under `STUB_MODE=1`, assert exit 0, assert all expected stubs printed, autofix any failures.

See `implementation/step-patch.md` for what was changed.
See `stub-autonomous-maintenance-notes/stub-mode-pattern.md` for expected stub line counts.

## Step RUN

From repo root:

```bash
STUB_MODE=1 bash dev-utils/autonomous-maintenance/run-all.sh 2>&1 | tee /tmp/stub-run-output.txt
echo "Exit: $?"
```

## Step ASSERT

Run each check:

```bash
# 1. Confirm exit 0 from above

# 2. Count STUB lines — expect at least 24 (11+11 in claude/opencode + 2 meta + git commits)
grep -c '\[STUB\] would run:' /tmp/stub-run-output.txt

# 3. Confirm no real invocations slipped through
grep '\[claude\] Running\|^\[opencode\] Running' /tmp/stub-run-output.txt && echo "FAIL: real invocation found" || echo "OK"

# 4. Confirm no errors
grep -i 'error\|FAILED' /tmp/stub-run-output.txt | grep -v '\[STUB\]' && echo "WARN: errors found" || echo "OK"
```

## Step FIX

If any assertion fails:
- Re-read `lib/claude.sh` and `lib/opencode.sh`
- Apply the correct STUB_MODE patch per `implementation/step-patch.md`
- Re-run the assertions
