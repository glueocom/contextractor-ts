# Test PURGE_TOOLS_SRC

## TLDR

Verify zero in-scope Python files remain in tools repo, the wheel directory contains only npm artifacts, and `skill-creator/SKILL.md` is internally consistent. Autofix any deviation.

## Inputs

- `../implementation/step-purge-tools-python-source.md`
- `../purge-python-notes/tools-repo-python-inventory.md`

## Checks

- ```bash
  find /Users/miroslavsekera/r/tools -name '*.py' \
    -not -path '*/node_modules/*' \
    -not -path '*/.venv/*' \
    -not -path '*/pythonescaper-redir/*'
  ```
  returns zero results
- `ls /Users/miroslavsekera/r/tools/distributed-packages/contextractor-engine/` shows only `dist`, `native`, `package.json`, `README.md` (no `pyproject.toml`, no `setup.py`, no `MANIFEST.in`, no `contextractor_engine/`, no `requirements*.txt`)
- `ls /Users/miroslavsekera/r/tools/apps/contextractor-api/` does not contain a `python/` subdirectory
- `grep -rnE 'init_skill\.py|package_skill\.py|quick_validate\.py' /Users/miroslavsekera/r/tools/.claude/skills/skill-creator/` returns zero results
- The `import:contextractor-engine` script in `tools/package.json` runs end-to-end (`pnpm import:contextractor-engine`) and produces only npm artifacts; verify by running it and checking the resulting `distributed-packages/contextractor-engine/` tree
- `pnpm -r build && pnpm -r test && pnpm -r lint` from `/Users/miroslavsekera/r/tools/` succeed
- Public-facing site articles under `apps/contextractor-site/content/automatic/{trafilatura,markdown,trafilatura-vs-*}` are unchanged (`git diff -- apps/contextractor-site/content/automatic/` shows nothing for those paths)

## Autofix

- If a stray `.py` survived, `rm` it after confirming the path matches the inventory note
- If wheel-publishing files (`pyproject.toml`, etc.) survived, delete them
- If `SKILL.md` still references a deleted script, Edit-tool removal as in the contextractor-ts test
- If `import:contextractor-engine` fails, debug and fix the root cause; do not silence the script
- If a public-facing article was accidentally edited, `git checkout` it

## Done when

All checks pass; `git status` shows only the intended deletes and the `SKILL.md` (and possibly `distributed-packages/contextractor-engine/README.md`) edits.
