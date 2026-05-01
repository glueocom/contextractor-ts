---
description: Run the full autonomous/maintenance pipeline in STUB_MODE and autofix any failures, iterating until it passes
---

Run the autonomous/maintenance pipeline in STUB_MODE. If it fails, diagnose and fix the root cause, then re-run. Repeat until all steps pass or 5 iterations are exhausted.

## Step RUN: Execute the stub pipeline

```bash
STUB_MODE=1 bash dev-utils/autonomous/maintenance/run-all.sh 2>&1
echo "EXIT:$?"
```

## Step DIAGNOSE: Identify failures

Check the output for:
- Non-zero `EXIT:` code
- `jq: parse error` — stream-json output is not valid JSON; fix `lib/claude.sh` (wrong flags or `2>&1` redirecting stderr into the pipe)
- `Error:` lines from `claude` or `opencode` — fix the flag causing the error in the relevant lib file
- `command not found` — a required binary is missing; report it
- Script-level `bash: ...` errors — fix the shell script responsible

## Step FIX: Apply targeted fix

Read the failing file, apply the minimal fix using Edit, then return to Step RUN. Do not fix more than what caused the failure.

Files most likely to need fixing:
- `dev-utils/autonomous/maintenance/lib/claude.sh` — claude invocation flags
- `dev-utils/autonomous/maintenance/lib/opencode.sh` — opencode invocation flags
- `dev-utils/autonomous/maintenance/run-all.sh`, `claude.sh`, `opencode.sh`, `claude-meta.sh`, `opencode-meta.sh`

## Step VERIFY: Confirm success

When `EXIT:0` and no error lines appear, report: which iteration passed, and a one-line summary of any fixes applied.
