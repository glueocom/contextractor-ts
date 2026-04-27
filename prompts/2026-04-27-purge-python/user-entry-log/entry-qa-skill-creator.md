# Q&A — `skill-creator` skill

## Question

What should happen to the unused `skill-creator` skill at `.claude/skills/skill-creator/` in contextractor-ts (3 `.py` utility scripts, not in `Active Skills`)?

## Options offered

- Delete the entire skill directory
- Keep the skill, drop only the Python scripts
- Keep as-is — third-party tooling

## User answer

**Keep the skill, drop only the Python scripts.** Keep `SKILL.md` and any `references/`, delete `scripts/*.py`, and update `SKILL.md` to remove instructions that point at the deleted scripts.

## Implications for implementation

- `step-purge-contextractor-ts-python` deletes the three `.py` scripts and trims `SKILL.md`
- `step-purge-tools-python-source` applies the same handling to the parallel `.claude/skills/skill-creator/` in `/Users/miroslavsekera/r/tools/`
