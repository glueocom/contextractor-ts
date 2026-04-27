# Test PURGE_CTX_TS

## TLDR

Verify zero Python files remain in contextractor-ts (outside `node_modules/`), `skill-creator/SKILL.md` no longer references the deleted scripts, and lineage notes are intact. Autofix any deviation.

## Inputs

- `../implementation/step-purge-contextractor-ts-python.md`
- `../purge-python-notes/contextractor-ts-python-inventory.md`

## Checks

- `find /Users/miroslavsekera/r/contextractor-ts -name '*.py' -not -path '*/node_modules/*'` returns zero results
- `grep -rnE 'init_skill\.py|package_skill\.py|quick_validate\.py|python\s+scripts/' /Users/miroslavsekera/r/contextractor-ts/.claude/skills/skill-creator/` returns zero results
- `git diff --name-only` shows only paths under `.claude/skills/skill-creator/` plus the three deletions
- `git diff -- .claude/skills/skill-creator/SKILL.md` is internally consistent — no orphan references to "Quick Validation script" / "Bootstrap script" / "Package script"
- Lineage references confirmed present (sample greps; all should still match):
  - `grep -F 'Python source supported them' /Users/miroslavsekera/r/contextractor-ts/README.md`
  - `grep -F 'mirrors the Python' /Users/miroslavsekera/r/contextractor-ts/packages/contextractor-engine/src/index.ts`
  - `grep -F 'Python port' /Users/miroslavsekera/r/contextractor-ts/.claude/agents/rust-pro.md`
- `pnpm -r build && pnpm -r test && pnpm -r lint` from `/Users/miroslavsekera/r/contextractor-ts/` succeed
- `cargo clippy --workspace --all-targets -- -D warnings` succeeds
- `biome check .` succeeds

## Autofix

- If any `.py` file remains, `rm` it (verify path is one listed in the inventory before deleting)
- If `SKILL.md` still references a deleted script, Edit-tool removal of that reference (replace the automation step with a one-line manual instruction)
- If a lineage reference was accidentally removed, `git checkout` that file or restore the exact original sentence
- If lint or build fails, fix the underlying issue rather than disabling the rule

## Done when

All checks pass and `git status` is clean except for the intended deletions and `SKILL.md` (and possibly `references/workflows.md`) edits.
