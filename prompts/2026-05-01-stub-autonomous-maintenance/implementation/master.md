# Implementation Master — Stub Autonomous Maintenance

**TLDR**: Add `STUB_MODE=1` dry-run support to `dev-utils/autonomous-maintenance/lib/claude.sh` and `lib/opencode.sh`. When set, `claude_run` and `opencode_run` echo the skipped command and return immediately — no LLM processes launched, all orchestration logic runs unchanged.

## Skills and Agents

- `code-reviewer` — review the patched lib files for correctness and bash hygiene

## Steps

- `step-patch.md` — Patch `lib/claude.sh` and `lib/opencode.sh` with `STUB_MODE` guard
- `step-verify.md` — Run `STUB_MODE=1 bash run-all.sh` and confirm expected output

## Shared Context

- Lib files: `dev-utils/autonomous-maintenance/lib/claude.sh`, `lib/opencode.sh`
- Orchestration entry point: `dev-utils/autonomous-maintenance/run-all.sh`
- See `stub-autonomous-maintenance-notes/stub-mode-pattern.md` for injection point rationale and expected output counts
- See `user-entry-log/entry-qa-stub-approach.md` for confirmed design decisions
