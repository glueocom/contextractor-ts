# Step PATCH — Add STUB_MODE to Lib Files

**TLDR**: Edit two bash lib files. Add a `STUB_MODE` guard inside `claude_run` and `opencode_run` so that `STUB_MODE=1` makes them echo and return instead of invoking the real binary. No other files change.

See `stub-autonomous-maintenance-notes/stub-mode-pattern.md` for injection point rationale.
See `user-entry-log/entry-qa-stub-approach.md` for the confirmed design (env var, echo-only).

## Step READ: Confirm current state

Read both files before editing:
- `dev-utils/autonomous-maintenance/lib/claude.sh`
- `dev-utils/autonomous-maintenance/lib/opencode.sh`

## Step EDIT: Patch lib/claude.sh

Inside `claude_run()`, immediately before `claude -p "$cmd"`, insert:

```bash
  if [[ "${STUB_MODE:-}" == "1" ]]; then
    echo "[STUB] would run: $cmd"
    return 0
  fi
```

Use Edit tool (surgical change). Final `claude_run` body:

```bash
claude_run() {
  local cmd="$1"
  if [[ "${STUB_MODE:-}" == "1" ]]; then
    echo "[STUB] would run: $cmd"
    return 0
  fi
  echo ""
  echo "[claude] Running $cmd ..."
  claude -p "$cmd"
}
```

## Step EDIT: Patch lib/opencode.sh

Inside `opencode_run()`, immediately before `opencode run "$cmd"`, insert the same guard.

Final `opencode_run` body:

```bash
opencode_run() {
  local cmd="$1"
  if [[ "${STUB_MODE:-}" == "1" ]]; then
    echo "[STUB] would run: $cmd"
    return 0
  fi
  echo ""
  echo "[opencode] Running $cmd ..."
  opencode run "$cmd"
}
```

## Constraints

- Do NOT modify any other `.sh` files
- Do NOT stub `pnpm opencode:sync` — it is fast file-copy, not a slash command
- The guard (`[[ -n "${_AM_CLAUDE_LIB:-}" ]] && return 0`) must remain untouched
