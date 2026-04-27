# Step PURGE_CTX_TS: Delete Python from `contextractor-ts`

## TLDR

Delete the three `.py` scripts under `.claude/skills/skill-creator/scripts/` and prune their references from `SKILL.md`. The skill itself stays — it is upstream Anthropic tooling — but its Python helpers leave the repo.

## Skills

- `ts-pro` not required — filesystem deletes plus an Edit pass on `SKILL.md`

## Inventory before delete

Confirm the inventory matches:

```bash
find /Users/miroslavsekera/r/contextractor-ts -name '*.py' -not -path '*/node_modules/*'
```

Expected output (exactly three files):

```
/Users/miroslavsekera/r/contextractor-ts/.claude/skills/skill-creator/scripts/init_skill.py
/Users/miroslavsekera/r/contextractor-ts/.claude/skills/skill-creator/scripts/package_skill.py
/Users/miroslavsekera/r/contextractor-ts/.claude/skills/skill-creator/scripts/quick_validate.py
```

If any other `.py` shows up, stop and re-read `../purge-python-notes/contextractor-ts-python-inventory.md` before proceeding.

## Delete the scripts

```bash
rm /Users/miroslavsekera/r/contextractor-ts/.claude/skills/skill-creator/scripts/init_skill.py
rm /Users/miroslavsekera/r/contextractor-ts/.claude/skills/skill-creator/scripts/package_skill.py
rm /Users/miroslavsekera/r/contextractor-ts/.claude/skills/skill-creator/scripts/quick_validate.py
```

If `scripts/` becomes empty after the deletes, remove the empty directory too.

## Trim `SKILL.md`

Read `.claude/skills/skill-creator/SKILL.md` and `.claude/skills/skill-creator/references/workflows.md`. Use Edit (not Write) to remove every reference that points at the deleted scripts:

- Bootstrap / initialization steps that say `python scripts/init_skill.py` or `python utils/init_skill.py`
- Validation steps that say `python scripts/quick_validate.py` or refer to a "quick validation script"
- Packaging steps that say `python scripts/package_skill.py` or refer to a "package script"
- Any sentence in directory-layout examples (`scripts/` — Python scripts, etc.) that is now factually wrong because the scripts are gone

Where `SKILL.md` describes a process step that the script automated, replace it with a one-line manual instruction (for example, "create the skill folder and `SKILL.md` by hand following the structure in `references/workflows.md`"). Do not invent new automation.

Leave intact every section that does not depend on the deleted scripts (frontmatter, naming rules, what-is-a-skill explainer, references/ workflows that are not about scripting).

## Lineage references stay

Do **not** touch any of the lineage references listed in `../purge-python-notes/contextractor-ts-python-inventory.md` — `README.md`, `CLAUDE.md`, `apps/*/README.md`, `packages/contextractor-engine/**`, `docs/spec/**`, `.claude/agents/rust-pro.md`, `.claude/skills/apify-*` — those describe an immutable historical fact and the user explicitly confirmed they stay.

## Verify

- `find /Users/miroslavsekera/r/contextractor-ts -name '*.py' -not -path '*/node_modules/*'` returns no results
- `grep -rE 'init_skill\.py|package_skill\.py|quick_validate\.py|python scripts/' /Users/miroslavsekera/r/contextractor-ts/.claude/skills/skill-creator/` returns no results
- `git diff` shows only the three deletes and edits inside `skill-creator/SKILL.md` (and possibly `references/workflows.md`)
- `pnpm -r build && pnpm -r test && pnpm -r lint` from the repo root still pass
