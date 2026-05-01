# Step REVIEW USER INTENT — Verify Against Original Requirements

**TLDR**: Check every requirement from the initial prompt and QA answers against the implementation. Autofix gaps.

## Sources

- `user-entry-log/entry-initial-prompt.md` — raw requirements
- `user-entry-log/entry-qa-stub-approach.md` — confirmed design decisions

## Step CHECK: Requirements coverage

| Requirement | Where covered | Status |
|---|---|---|
| `.sh` files in `dev-utils/autonomous-maintenance/` must be runnable without launching real Claude/opencode | `lib/claude.sh`, `lib/opencode.sh` STUB_MODE patch | verify |
| Must not run actual slash commands (too slow) | `claude_run` / `opencode_run` stub returns early | verify |
| Stub implemented via env var (not file swap) | `STUB_MODE` env var | verify |
| Stub output: echo only, no files written | `echo "[STUB] would run: $cmd"; return 0` | verify |

For each row: read the patched lib files and confirm the requirement is met. Autofix any gap.

## Step FIX: Autofix gaps

If any requirement is not met, apply the minimal fix and re-run the review table.
