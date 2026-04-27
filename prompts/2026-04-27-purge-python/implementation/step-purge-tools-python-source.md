# Step PURGE_TOOLS_SRC: Delete Python source in `/Users/miroslavsekera/r/tools/`

## TLDR

Delete three categories of Python source in tools repo: the leftover wheel sources under `distributed-packages/contextractor-engine/contextractor_engine/`, the entire `apps/contextractor-api/python/` directory, and the three `.py` scripts under `.claude/skills/skill-creator/scripts/`. Updates to Dockerfile, supervisord, and start scripts live in the next step.

## Skills

- `ts-pro` not required — filesystem deletes plus an Edit pass on `skill-creator/SKILL.md`

## Inventory before delete

```bash
find /Users/miroslavsekera/r/tools -name '*.py' \
  -not -path '*/node_modules/*' \
  -not -path '*/.venv/*' \
  -not -path '*/pythonescaper-redir/*'
```

Expected output (eight files):

```
/Users/miroslavsekera/r/tools/distributed-packages/contextractor-engine/contextractor_engine/__init__.py
/Users/miroslavsekera/r/tools/distributed-packages/contextractor-engine/contextractor_engine/extractor.py
/Users/miroslavsekera/r/tools/distributed-packages/contextractor-engine/contextractor_engine/models.py
/Users/miroslavsekera/r/tools/distributed-packages/contextractor-engine/contextractor_engine/utils.py
/Users/miroslavsekera/r/tools/apps/contextractor-api/python/server.py
/Users/miroslavsekera/r/tools/.claude/skills/skill-creator/scripts/init_skill.py
/Users/miroslavsekera/r/tools/.claude/skills/skill-creator/scripts/package_skill.py
/Users/miroslavsekera/r/tools/.claude/skills/skill-creator/scripts/quick_validate.py
```

`pythonescaper-redir/` is excluded — different product, out of scope.

If any other `.py` file appears, stop and consult `../purge-python-notes/tools-repo-python-inventory.md` before proceeding.

## Delete

```bash
# Wheel residue — the distributed npm engine lives in `dist/` and `native/` siblings; only the Python folder goes
rm -rf /Users/miroslavsekera/r/tools/distributed-packages/contextractor-engine/contextractor_engine

# Python extraction server (the rest of contextractor-api/ stays — see step-deprovision-contextractor-api)
rm -rf /Users/miroslavsekera/r/tools/apps/contextractor-api/python

# skill-creator helper scripts (same handling as in contextractor-ts)
rm /Users/miroslavsekera/r/tools/.claude/skills/skill-creator/scripts/init_skill.py
rm /Users/miroslavsekera/r/tools/.claude/skills/skill-creator/scripts/package_skill.py
rm /Users/miroslavsekera/r/tools/.claude/skills/skill-creator/scripts/quick_validate.py
```

If `scripts/` becomes empty, drop the empty directory too.

## Trim `tools/.claude/skills/skill-creator/SKILL.md`

Apply the same edits as in `step-purge-contextractor-ts-python` — remove every reference that points at the three deleted `.py` files. The two repos likely share the skill's content; resolve any divergence file-by-file rather than copying one to the other.

## Wheel-folder leftovers

After `rm -rf .../contextractor_engine`, inspect `distributed-packages/contextractor-engine/` and verify only the npm engine artifacts remain (`dist/`, `native/`, `package.json`, `README.md`). Anything else (`pyproject.toml`, `setup.py`, `MANIFEST.in`, `CHANGELOG.md` that talks about wheel releases, `.python-version`, `requirements*.txt`) is wheel-publishing residue — delete it. Do **not** delete `package.json`, `README.md`, `dist/`, or `native/`. The `import:contextractor-engine` script in root `package.json` rebuilds the npm payload and depends on `package.json` being present.

If `README.md` describes the directory as "the Python wheel", rewrite it as a one-paragraph note explaining that the directory is the npm-engine drop target rebuilt by `pnpm import:contextractor-engine`.

## Lineage references stay

Do not touch any of the public-facing site articles listed in `../purge-python-notes/tools-repo-python-inventory.md` ("Public-facing content articles — KEEP unchanged"). They describe third-party Python libraries, not contextractor's distribution.

## Verify

- `find /Users/miroslavsekera/r/tools -name '*.py' -not -path '*/node_modules/*' -not -path '*/.venv/*' -not -path '*/pythonescaper-redir/*'` returns no results
- `ls /Users/miroslavsekera/r/tools/distributed-packages/contextractor-engine/` shows only npm engine artifacts (no `pyproject.toml`, no `setup.py`, no `contextractor_engine/`)
- `git -C /Users/miroslavsekera/r/tools diff` shows only the deletes plus the `skill-creator/SKILL.md` and (if needed) `distributed-packages/contextractor-engine/README.md` edits
