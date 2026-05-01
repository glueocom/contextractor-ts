# Step VERIFY — Run Stub Pipeline and Confirm Output

**TLDR**: Run `run-all.sh` with `STUB_MODE=1` from repo root. Assert exit 0, assert all expected `[STUB] would run:` lines appear, assert no real `claude` or `opencode` processes launched.

See `stub-autonomous-maintenance-notes/stub-mode-pattern.md` for expected output counts.

## Step RUN: Execute the full pipeline in stub mode

From repo root:

```bash
STUB_MODE=1 bash dev-utils/autonomous-maintenance/run-all.sh 2>&1 | tee /tmp/stub-run-output.txt
echo "Exit code: $?"
```

## Step ASSERT: Validate output

Check `/tmp/stub-run-output.txt`:

- Exit code is `0`
- Every slash command from `claude.sh`, `opencode.sh`, `claude-meta.sh`, `opencode-meta.sh` appears as a `[STUB] would run:` line — no line is missing
- No line contains `[claude] Running` or `[opencode] Running` (which would mean a real invocation slipped through)
- The words `Error`, `error`, `FAILED` do not appear (except inside a `[STUB]` line)

## Step REPORT: Summarize

Report:
- Pass/fail for each assertion above
- Full list of `[STUB] would run:` lines seen
- Any unexpected output

If any assertion fails, investigate the lib patch and fix before reporting done.
