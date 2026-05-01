---
description: Run the full autonomous-maintenance pipeline in STUB_MODE — each command invokes the real claude/opencode binary with a hello-world task to verify the tooling works end-to-end
allowed-tools: Bash(bash:*)
---

Run the autonomous-maintenance pipeline in stub mode:

```bash
STUB_MODE=1 bash dev-utils/autonomous-maintenance/run-all.sh
```

Each `claude_run` call runs `claude -p "ok"` and each `opencode_run` call runs `opencode run --model opencode/gpt-5-nano "ok"` — real binary invocations that verify connectivity, not the actual maintenance slash commands. All orchestration logic (sequencing, output directory cleanup, `pnpm opencode:sync`) runs unchanged.

Report the full output and flag any non-zero exit codes or unexpected errors.
