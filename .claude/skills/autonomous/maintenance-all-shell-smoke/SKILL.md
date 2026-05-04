---
name: autonomous:maintenance-all-shell-smoke
description: WHEN verifying the autonomous maintenance pipeline runs correctly in stub mode without making real changes. WHEN-NOT for actual maintenance runs or any task that should produce real output.
allowed-tools: Bash(bash:*), Read, Edit
model: sonnet
disable-model-invocation: true
---

**Only run this command if you are Claude Code. If you are any other agent (opencode or otherwise), skip this command entirely and report it as skipped.**

Run the autonomous/maintenance pipeline in STUB_MODE. If it fails, diagnose and fix the root cause, then re-run. Repeat until all steps pass or 5 iterations are exhausted.

## Step RUN: Execute the stub pipeline

```bash
STUB_MODE=1 bash dev-utils/autonomous/run-all.sh 2>&1
echo "EXIT:$?"
```

## Step DIAGNOSE: Identify failures

Check the output for:
- Non-zero `EXIT:` code
- `jq: parse error` — stream-json output is not valid JSON; fix `dev-utils/autonomous/maintenance/lib/claude.sh` (wrong flags or `2>&1` redirecting stderr into the pipe)
- `Error:` lines from `claude` or `opencode` — fix the flag causing the error in the relevant lib file
- `command not found` — a required binary is missing; report it
- Script-level `bash: ...` errors — fix the shell script responsible

## Step FIX: Apply targeted fix

Read the failing file, apply the minimal fix using Edit, then return to Step RUN. Do not fix more than what caused the failure.

Files most likely to need fixing:
- `dev-utils/autonomous/maintenance/lib/claude.sh` — claude invocation flags
- `dev-utils/autonomous/maintenance/lib/opencode.sh` — opencode invocation flags
- `dev-utils/autonomous/run-all.sh`, `dev-utils/autonomous/maintenance/claude.sh`, `opencode.sh`, `claude-meta.sh`, `sync.sh`

## Step VERIFY: Confirm success

When `EXIT:0` and no error lines appear, report: which iteration passed, and a one-line summary of any fixes applied.

## Step COMMIT: Commit and Push

Run `/git:commit` to commit and push any fixes applied during the auto-fix loop.
