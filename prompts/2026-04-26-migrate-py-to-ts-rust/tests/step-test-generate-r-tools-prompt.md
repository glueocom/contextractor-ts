# Test — generate-r-tools-prompt

## TLDR

Verify the cross-repo follow-up prompt at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite.md` was created, is well-formed, and covers every surface in `cross-repo-followup.md`. The prompt **must not have been executed**. Auto-fix any deviation in the prompt file.

## Inputs

- `../implementation/step-generate-r-tools-prompt.md`
- `../migrate-py-to-ts-rust-notes/cross-repo-followup.md`

## Review

- File exists at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite.md`.
- It covers: `apps/contextractor-site` (PyPI/npm messaging strip + `/help/pypi/` modify-not-delete + remove links), `apps/contextractor-api` (schema + fixture sync), `distributed-packages/contextractor-engine` (replace Python wheel with TS + napi-rs prebuilds, or remove), `.claude/commands/projects/contextractor/{sync-docs.md, sync-gui.md}` (source-of-truth path update), final action: run `sync-all.md`.
- Follows formatting guidelines (named steps, `#`/`##`/`###` headers, no numbered headers, no emojis).
- No code or files have been modified inside `r/tools/` other than the new prompt file.

## Verify

- `test -f /Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite.md` exits 0.
- From `/Users/miroslavsekera/r/tools/`: `git status --porcelain | grep -v 'prompts/2026-04-26-propagate-contextractor-rewrite.md'` returns nothing (no other modifications).
- `grep -E '^# |^## |^### ' /Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite.md | grep -E '^[#]+ [0-9]+' ` returns nothing (no numbered headers).

## Auto-fix

If a surface is missing, add it. If a numbered header slipped in, rename it to a descriptive one. If files in `r/tools/` were modified, revert them — this prompt only **creates** the follow-up file.
