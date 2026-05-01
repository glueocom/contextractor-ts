# STUB_MODE Pattern for Bash Lib Files

## Injection point

Both lib files define a single function and use a guard to prevent double-sourcing:

```bash
[[ -n "${_AM_CLAUDE_LIB:-}" ]] && return 0
_AM_CLAUDE_LIB=1
```

The `STUB_MODE` check must go **inside the function body**, not before the guard, so the guard runs normally and the function is still defined (even in stub mode — callers may be sourced before `STUB_MODE` is set).

## Patch shape (same for both lib files)

```bash
if [[ "${STUB_MODE:-}" == "1" ]]; then
  echo "[STUB] would run: $cmd"
  return 0
fi
```

Insert immediately before the real invocation (`claude -p "$cmd"` or `opencode run "$cmd"`).

## Scope of stubbing

Only `claude_run` and `opencode_run` are stubbed. These lines in `opencode.sh` are NOT stubbed because they are fast pnpm scripts, not slash commands:

```bash
pnpm opencode:sync
```

The `rm -rf autonomous-task-output && mkdir -p autonomous-task-output` in each script also runs normally in stub mode — this is orchestration, not LLM work.

## Verification

After patching, running `STUB_MODE=1 bash dev-utils/autonomous-maintenance/run-all.sh` from repo root should:

- Exit with 0
- Print one `[STUB] would run: /...` line per slash command (currently 11 in `claude.sh`, 11 in `opencode.sh`, 1 in `claude-meta.sh`, 1 in `opencode-meta.sh`, plus the `/git:commit` / `/git-commit` calls)
- Never launch a `claude` or `opencode` process
