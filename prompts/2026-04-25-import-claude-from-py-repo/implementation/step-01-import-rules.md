# Step 01 — Import Rules Verbatim

## TLDR

Create the `.claude/rules/` directory in target and copy two language-agnostic rule files from source verbatim. Skip the third (Python-keyed). Touches `.claude/rules/` — does not edit any existing file.

## Skills

None. Mechanical copy.

## Inputs

- `../user-entry-log/entry-qa-rules.md` — defines the two-of-three import.
- `../import-claude-from-py-repo-notes/inventory-diff.md`

## Source files

- `/Users/miroslavsekera/r/contextractor/.claude/rules/no-confirmation-prompts.md`
- `/Users/miroslavsekera/r/contextractor/.claude/rules/json-config-only.md`

## Target files

- `/Users/miroslavsekera/r/contextractor-ts/.claude/rules/no-confirmation-prompts.md` — new
- `/Users/miroslavsekera/r/contextractor-ts/.claude/rules/json-config-only.md` — new

## Actions

1. `mkdir -p /Users/miroslavsekera/r/contextractor-ts/.claude/rules/`
2. Copy each source file to its target path **verbatim** — no edits, no headers, no path rewrites.
3. Do not copy `rules/config-case-conventions.md`. Per `entry-qa-rules.md` it does not transfer.

## Constraints

- Use `cp` via Bash. Do not regenerate the file contents — the rules are language-agnostic and rewriting risks drift from the source convention.
- Do not create any other files in `.claude/rules/`. Future rules belong to future prompts.

## Done when

- Both target files exist
- `diff` between source and target for each file is empty
- `.claude/rules/config-case-conventions.md` does **not** exist in target
