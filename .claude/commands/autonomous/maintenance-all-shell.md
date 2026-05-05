---
description: Run the full autonomous/maintenance pipeline, auto-fixing any failures and iterating until all steps pass
allowed-tools: Bash(bash:*), Bash(pnpm:*), Bash(cargo:*), Read, Edit, Write
model: sonnet
---

**Only run this command if you are Claude Code. If you are any other agent (opencode or otherwise), skip this command entirely and report it as skipped.**

Run the full autonomous/maintenance pipeline (`dev-utils/autonomous/run-all.sh`). If any step fails, diagnose the root cause, apply a targeted fix, and re-run. Repeat until all steps pass or 5 iterations are exhausted.

## Step PREPARE: Set up output directory

```bash
mkdir -p autonomous-task-output/claude-maintenance-all-shell/reports autonomous-task-output/claude-maintenance-all-shell/prompts
```

## Step RUN: Execute the full pipeline

```bash
bash dev-utils/autonomous/run-all.sh 2>&1
echo "EXIT:$?"
```

Capture all output for the DIAGNOSE step.

## Step DIAGNOSE: Identify failures

If `EXIT:0`, skip to Step REPORT.

Check the output for:
- Non-zero `EXIT:` code — find which sub-script failed (claude-meta, claude, sync, opencode)
- `jq: parse error` — stream-json output is malformed; fix `dev-utils/autonomous/maintenance/lib/claude.sh` (wrong flags or `2>&1` redirecting stderr into the pipe)
- `Error:` lines from `claude` or `opencode` — fix the flag in the relevant lib file
- `command not found` — a required binary is missing; record in report and skip to Step REPORT
- `bash: ...` errors — fix the responsible shell script

Files most likely to need fixing:
- `dev-utils/autonomous/maintenance/lib/claude.sh`
- `dev-utils/autonomous/maintenance/lib/opencode.sh`
- `dev-utils/autonomous/run-all.sh`
- `dev-utils/autonomous/maintenance/claude.sh`, `opencode.sh`, `claude-meta.sh`, `sync.sh`

## Step FIX: Apply targeted fix

Read the failing file, apply the minimal fix using Edit. Return to Step RUN. Fix only what caused the failure. Maximum 5 total iterations.

## Step REPORT: Save report and fix prompt

Save `autonomous-task-output/claude-maintenance-all-shell/reports/run-all-report.md` with:
- Date/time of run
- Total iterations needed
- Each sub-script result (claude-meta, claude, sync, opencode): pass / fail / skipped
- All fixes applied (file path, what changed, why)
- Final exit status

If any issues could not be auto-fixed, also save `autonomous-task-output/claude-maintenance-all-shell/prompts/run-all-fixup-prompt.md` with:
- Summary of each unresolved failure
- Relevant file paths and error excerpts
- Suggested manual steps to resolve them

## Step COMMIT: Commit and Push

Run `/git:commit` to commit and push all changes, including any fixes applied during the auto-fix loop.
