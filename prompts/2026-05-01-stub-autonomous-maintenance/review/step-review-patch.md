# Step REVIEW PATCH — Review Lib File Changes

**TLDR**: Review the STUB_MODE patch in both lib files for bash correctness, guard ordering, and scope. Autofix any issues found.

See `implementation/step-patch.md` for what was changed.

## Step DIFF: Identify changes

```bash
git log --oneline -10
git diff HEAD~1 -- dev-utils/autonomous-maintenance/lib/
```

If the patch is not yet committed, use:

```bash
git diff -- dev-utils/autonomous-maintenance/lib/
```

## Step REVIEW: Check correctness

Verify each of the following — autofix any that fail:

- `STUB_MODE` guard is inside the function body, not before the double-source guard
- Guard uses `[[ "${STUB_MODE:-}" == "1" ]]` — the `:-` default prevents unbound variable errors under `set -u`
- `return 0` exits the function (not `exit 0` which would kill the shell)
- The double-source guard (`[[ -n "${_AM_CLAUDE_LIB:-}" ]] && return 0`) is untouched
- No other `.sh` files were modified
- `pnpm opencode:sync` in `opencode.sh` is NOT inside the guard (intentional — it is not a slash command)
- Indentation is consistent with surrounding code (2-space indent)
