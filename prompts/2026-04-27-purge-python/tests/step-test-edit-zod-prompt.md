# Test EDIT_ZOD_PROMPT

## TLDR

Verify the two surgical edits to `prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md` from `../implementation/step-edit-zod-prompt.md`. Autofix if the diff is wider than expected or missed either edit.

## Inputs

- `../implementation/step-edit-zod-prompt.md`
- `../purge-python-notes/update-markdown-prompt-edits.md`

## Checks

- `git diff --name-only` lists exactly one file: `prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md`
- `git diff -- prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md` shows two hunks:
  - The file list on what was line 60 no longer contains `pypi/pypi.md`
  - The "defunct Python repo" mapping bullet block is replaced with the condensed paragraph from `update-markdown-prompt-edits.md` Edit 2
- `grep -nF 'pypi/pypi.md' prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md` returns nothing
- `grep -nF 'contextractor_cli/main.py' prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md` returns nothing (the per-file mapping table is gone)
- `grep -nF 'if it still pulls the wheel' prompts/2026-04-27-zod-schema-unification/update-markdown-prompt.md` returns nothing
- The phrase "Zod schema's `.default(...)` calls" still appears (the GUI-defaults guidance was preserved)
- No file under `prompts/` other than `update-markdown-prompt.md` shows up in `git status`

## Autofix

- If the diff is missing edit 1: open the file, drop `pypi/pypi.md` from the list per `update-markdown-prompt-edits.md`
- If the diff is missing or partial on edit 2: replace the mapping block with the exact text in `update-markdown-prompt-edits.md` Edit 2
- If extra hunks landed (any other hand edits to the prompt), revert them with `git checkout -p` keeping only the two intended hunks
- If any other prompt file has been touched, `git checkout` it back

## Done when

`git diff` shows exactly the two intended hunks, every check above passes, and `git status` shows no other prompt files modified.
